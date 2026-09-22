// IRON-QUOTE-001 / IRON-QUOTE-002 / IRON-QUOTE-005 - the persistence half of the quote save, extracted from Dashboard so every
// stage can be failure-injected in tests. It never formats, calculates or decides business values: the caller hands it a fully
// computed plan and it reports EXACTLY what was written.
//
// Two paths, chosen by a capability probe (never by guessing):
//   ATOMIC  (migration 20260922000000 applied): files are uploaded first, then ONE transaction (save_quote_atomic) writes client +
//           quote header (project_name, attn_*) + structure + attachment metadata + removals. Any DB failure rolls everything back and
//           the uploaded objects are removed. A retry of a committed new-quote save is idempotent (client-generated quote id).
//           Storage objects of removed attachments are deleted only after commit, from the quote_storage_gc queue.
//   PHASED  (current shared TEST schema): client -> quote row -> structure RPC -> attachments -> removals. This path is NOT atomic;
//           it compensates where it can (new client / new quote shell removed on failure, orphan upload removed) and reports every
//           stage that did or did not complete. It never drops a user-entered field silently.
//
// Outcomes: 'ok' (every stage completed), 'partial' (the quote exists but named stages did not complete), 'failed' (the quote was not
// saved; `wrote` lists anything that nevertheless remains written).

export const QUOTE_FILES_BUCKET = 'quote-files';

// RFC 4122 v4 from getRandomValues (crypto.randomUUID needs a secure context; the Owner test URL is plain http on the LAN).
export function newUuid(cryptoImpl = globalThis.crypto) {
  const b = new Uint8Array(16);
  cryptoImpl.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// The extension must satisfy get-public-quote's path check (<owner>/<quote>_<digits>.<1-10 alnum>); the old "last segment after a dot" logic
// turned a dot-less name such as "site plan" into the extension "site plan", so the attachment was silently hidden from customers.
export function safeFileExtension(name) {
  const n = String(name || '');
  const dot = n.lastIndexOf('.');
  const ext = dot > 0 ? n.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 10) : '';
  return ext || 'bin';
}

// digits only (the public path check allows no extra separators); callers pass a distinct stamp per file
export function buildAttachmentPath(userId, quoteId, fileName, stamp) {
  return `${userId}/${quoteId}_${Math.trunc(stamp)}.${safeFileExtension(fileName)}`;
}

const isMissingFunctionError = (err) => {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code === 'PGRST202' || code === '42883' || /could not find the function|function .* does not exist/i.test(msg);
};

const capabilityCache = new WeakMap();
export async function detectAtomicSave(supabase) {
  if (capabilityCache.has(supabase)) return capabilityCache.get(supabase);
  let available = false;
  try {
    const { data, error } = await supabase.rpc('save_quote_atomic_version');
    available = !error && Number(data) >= 1;
    if (error && !isMissingFunctionError(error)) console.warn('[quote-save] capability probe failed; using the phased save', error);
  } catch (e) {
    console.warn('[quote-save] capability probe threw; using the phased save', e);
  }
  capabilityCache.set(supabase, available);
  return available;
}
export function resetAtomicSaveCapability(supabase) { capabilityCache.delete(supabase); }

async function removeObjects(supabase, paths) {
  if (!paths.length) return { removed: [], failed: [] };
  try {
    const { data, error } = await supabase.storage.from(QUOTE_FILES_BUCKET).remove(paths);
    if (error) return { removed: [], failed: [...paths] };
    // Storage returns the objects it actually deleted; RLS-hidden or missing objects are silently absent from the list.
    const done = new Set((data || []).map((o) => o?.name).filter(Boolean));
    return { removed: paths.filter((p) => done.has(p)), failed: paths.filter((p) => !done.has(p)) };
  } catch {
    return { removed: [], failed: [...paths] };
  }
}

// Deletes queued objects (atomic path) and acknowledges only the ones storage confirmed; the rest stay queued for the next flush.
export async function flushStorageGc(supabase) {
  const { data: rows, error } = await supabase.from('quote_storage_gc').select('storage_path').limit(200);
  if (error) return { removed: [], pending: [], error };
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  const { removed, failed } = await removeObjects(supabase, paths);
  if (removed.length) {
    const { error: ackErr } = await supabase.from('quote_storage_gc').delete().in('storage_path', removed);
    if (ackErr) return { removed, pending: failed, error: ackErr };
  }
  return { removed, pending: failed };
}

async function uploadAll(supabase, plan) {
  const uploaded = [];
  const failures = [];
  const base = plan.now();
  for (let i = 0; i < plan.newFiles.length; i += 1) {
    const file = plan.newFiles[i];
    const path = buildAttachmentPath(plan.userId, plan.quoteId, file.name, base + i);
    let error;
    try {
      ({ error } = await supabase.storage.from(QUOTE_FILES_BUCKET).upload(path, file, { upsert: false }));
    } catch (e) { error = e; }
    if (error) failures.push(file.name);
    else uploaded.push({ path, file });
  }
  return { uploaded, failures };
}

// ------------------------------------------------------------------------------------------------------------------------------
// ATOMIC
// ------------------------------------------------------------------------------------------------------------------------------
export async function persistQuoteAtomic(supabase, plan) {
  const result = { path: 'atomic', outcome: 'failed', quoteId: plan.quoteId, wrote: [], attachmentFailures: [], orphanedUploads: [], cleanupPending: [] };

  const { uploaded, failures } = await uploadAll(supabase, plan);
  if (failures.length) {
    const { failed } = await removeObjects(supabase, uploaded.map((u) => u.path));
    return { ...result, stage: 'upload', attachmentFailures: failures, orphanedUploads: failed };
  }

  const { data, error } = await supabase.rpc('save_quote_atomic', {
    p_quote_id: plan.quoteId,
    p_is_new: plan.isNew,
    p_client: { id: plan.existingClientId || null, ...plan.clientPayload },
    p_quote: { ...plan.header, ...plan.attnFields, project_name: plan.projectName },
    p_financial: plan.structured.financial,
    p_sections: plan.structured.sections,
    p_items: plan.structured.items,
    p_removed_section_ids: plan.structured.removedSectionIds,
    p_removed_item_ids: plan.structured.removedItemIds,
    p_description_updates: plan.descriptionUpdates || [],
    p_new_attachments: uploaded.map((u) => ({ file_name: u.file.name, file_size: u.file.size, storage_path: u.path })),
    p_removed_attachment_ids: plan.removedAttachments.map((a) => a.id),
  });
  if (error) {
    const { failed } = await removeObjects(supabase, uploaded.map((u) => u.path));
    return { ...result, stage: 'transaction', error, orphanedUploads: failed };
  }

  // idempotent replay: the committed quote does not reference this attempt's uploads -> remove them
  const referenced = new Set(data?.attachment_paths || []);
  const unreferenced = uploaded.map((u) => u.path).filter((p) => !referenced.has(p));
  const { failed: orphanFail } = await removeObjects(supabase, unreferenced);

  const gc = await flushStorageGc(supabase);
  return {
    ...result,
    outcome: 'ok',
    idempotentReplay: Boolean(data?.idempotent_replay),
    quoteId: data?.quote_id || plan.quoteId,
    clientId: data?.client_id || null,
    wrote: ['client', 'quote', 'structure', 'attachments'],
    orphanedUploads: orphanFail,
    cleanupPending: gc.pending || [],
  };
}

// ------------------------------------------------------------------------------------------------------------------------------
// PHASED (current TEST schema) - not atomic; compensates and reports.
// ------------------------------------------------------------------------------------------------------------------------------
const mentionsColumn = (err, col) => String(err?.message || '').includes(col);
const omitKeys = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

export async function persistQuotePhased(supabase, plan) {
  const result = { path: 'phased', outcome: 'failed', quoteId: plan.isNew ? null : plan.quoteId, wrote: [], attachmentFailures: [], orphanedUploads: [], cleanupPending: [] };
  const fail = (stage, error, extra = {}) => ({ ...result, stage, error, ...extra });

  // 1. client
  let clientId = plan.existingClientId || null;
  let createdClientId = null;
  if (clientId) {
    const { error } = await supabase.from('clients').update(plan.clientPayload).eq('id', clientId);
    if (error) return fail('client', error);
    result.wrote.push('client');
  } else {
    const { data, error } = await supabase.from('clients').insert([plan.clientPayload]).select();
    if (error || !data?.[0]?.id) return fail('client', error || new Error('client insert returned no row'));
    clientId = data[0].id;
    createdClientId = clientId;
    result.wrote.push('client');
  }
  result.clientId = clientId;
  const compensateNewClient = async () => {
    if (!createdClientId) return;
    const { error } = await supabase.from('clients').delete().eq('id', createdClientId);
    if (!error) result.wrote = result.wrote.filter((w) => w !== 'client');
  };

  // 2. quote row. An optional column that this environment lacks may be dropped ONLY when the user left it empty.
  let row = { ...plan.header, client_id: clientId, user_id: plan.userId, ...plan.attnFields, project_name: plan.projectName };
  const write = () => (plan.isNew
    ? supabase.from('quotes').insert([{ id: plan.quoteId, ...row }]).select()
    : supabase.from('quotes').update(row).eq('id', plan.quoteId));
  let { error: qErr } = await write();
  for (let attempt = 0; qErr && attempt < 2; attempt += 1) {
    if (mentionsColumn(qErr, 'project_name') && 'project_name' in row) {
      if (plan.projectName) break; // a typed project name must never be dropped silently
      row = omitKeys(row, ['project_name']);
    } else if ((mentionsColumn(qErr, 'attn_name') || mentionsColumn(qErr, 'attn_role')) && 'attn_name' in row) {
      if (plan.attnUserEntered) break;
      row = omitKeys(row, ['attn_name', 'attn_role']);
    } else break;
    ({ error: qErr } = await write());
  }
  if (qErr) {
    const missing = mentionsColumn(qErr, 'project_name') ? 'project_name' : (mentionsColumn(qErr, 'attn_name') || mentionsColumn(qErr, 'attn_role')) ? 'attn' : null;
    if (plan.isNew) await compensateNewClient();
    return fail('quote', qErr, { missingColumn: missing });
  }
  result.quoteId = plan.quoteId;
  result.wrote.push('quote');

  // 3. description-only updates (non-structural edit)
  for (const upd of plan.descriptionUpdates || []) {
    const { error } = await supabase.from('quote_items').update({ description: upd.description }).eq('id', upd.id).eq('quote_id', plan.quoteId);
    if (error) return { ...result, outcome: 'partial', stage: 'items', error };
  }

  // 4. structure (atomic on its own)
  const { error: sErr } = await supabase.rpc('save_quote_structured', {
    p_quote_id: plan.quoteId,
    p_financial: plan.structured.financial,
    p_sections: plan.structured.sections,
    p_items: plan.structured.items,
    p_removed_section_ids: plan.structured.removedSectionIds,
    p_removed_item_ids: plan.structured.removedItemIds,
  });
  if (sErr) {
    if (plan.isNew) {
      const { error: delErr } = await supabase.from('quotes').delete().eq('id', plan.quoteId);
      if (delErr) return fail('structure', sErr, { compensationFailed: true });
      result.wrote = result.wrote.filter((w) => w !== 'quote');
      await compensateNewClient();
      return fail('structure', sErr);
    }
    return { ...result, outcome: 'partial', stage: 'structure', error: sErr };
  }
  result.wrote.push('structure');

  // 5. new attachments: upload, then metadata; a metadata failure removes the just-uploaded object
  const { uploaded, failures } = await uploadAll(supabase, plan);
  result.attachmentFailures.push(...failures);
  for (const u of uploaded) {
    const { error } = await supabase.from('quote_attachments').insert([{
      quote_id: plan.quoteId, file_name: u.file.name, file_url: u.path, file_size: u.file.size, storage_path: u.path,
    }]);
    if (error) {
      result.attachmentFailures.push(u.file.name);
      const { failed } = await removeObjects(supabase, [u.path]);
      result.orphanedUploads.push(...failed);
    }
  }

  // 6. removed attachments: rows first (authoritative), then their objects
  let removalFailed = false;
  if (plan.removedAttachments.length) {
    const ids = plan.removedAttachments.map((a) => a.id);
    const { error } = await supabase.from('quote_attachments').delete().in('id', ids).eq('quote_id', plan.quoteId);
    if (error) removalFailed = true;
    else {
      const paths = plan.removedAttachments.map((a) => a.storage_path).filter(Boolean);
      const { failed } = await removeObjects(supabase, paths);
      result.cleanupPending.push(...failed);
    }
  }
  result.removalFailed = removalFailed;
  if (result.attachmentFailures.length || removalFailed) return { ...result, outcome: 'partial', stage: 'attachments' };
  result.wrote.push('attachments');
  return { ...result, outcome: 'ok' };
}

export async function persistQuote(supabase, plan) {
  const atomic = await detectAtomicSave(supabase);
  return atomic ? persistQuoteAtomic(supabase, plan) : persistQuotePhased(supabase, plan);
}

// Quote deletion: the quote row (and, by cascade, its attachment rows) first; storage objects only afterwards.
export async function deleteQuoteWithAttachments(supabase, quoteId) {
  const { data: atts, error: listErr } = await supabase.from('quote_attachments').select('storage_path').eq('quote_id', quoteId);
  if (listErr) return { ok: false, stage: 'list', error: listErr };
  const { error: delErr } = await supabase.from('quotes').delete().eq('id', quoteId);
  if (delErr) return { ok: false, stage: 'delete', error: delErr };
  if (await detectAtomicSave(supabase)) {
    const gc = await flushStorageGc(supabase);
    return { ok: true, cleanupPending: gc.pending || [] };
  }
  const { failed } = await removeObjects(supabase, (atts || []).map((a) => a.storage_path).filter(Boolean));
  return { ok: true, cleanupPending: failed };
}

// Authorized, short-lived access to a private attachment (OD-2). Historical rows without a storage path fall back to their URL.
export async function createAttachmentAccessUrl(supabase, attachment, expiresInSeconds = 60) {
  if (attachment?.storage_path) {
    const { data, error } = await supabase.storage.from(QUOTE_FILES_BUCKET).createSignedUrl(attachment.storage_path, expiresInSeconds);
    if (error || !data?.signedUrl) return { url: null, error: error || new Error('no signed url') };
    return { url: data.signedUrl };
  }
  return { url: /^https?:\/\//.test(String(attachment?.file_url || '')) ? attachment.file_url : null };
}
