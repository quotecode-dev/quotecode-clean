// Task 34: the browser side of the "Improve this quote" snapshot - built from the OPEN form state at the moment the user clicks the review
// action (so unsaved edits are included), then strictly shaped by the shared sanitizer (supabase/functions/_shared/quoteDraftSnapshot.js).
// Only the subject and, per real item, description / active quantity / pricing unit / unit price / section name - nothing about the client.
import { sanitizeDraftSnapshot, DRAFT_SNAPSHOT_VERSION } from '../../supabase/functions/_shared/quoteDraftSnapshot.js';
import { getActiveQuantity } from './professionalQuoteItem';

export function buildQuoteDraftSnapshot({ items, subject, sections }) {
  const sectionName = new Map((Array.isArray(sections) ? sections : []).map((s) => [s.key ?? s.id, s.name]));
  const rows = (Array.isArray(items) ? items : [])
    .filter((it) => it && typeof it.description === 'string' && it.description.trim())
    .map((it) => ({
      description: it.description,
      quantity: getActiveQuantity(it) || null,
      unit: it.pricing_unit || null,
      unitPrice: it.unit_price === '' || it.unit_price == null ? null : it.unit_price,
      section: sectionName.get(it.section_key ?? it.section_id) || null,
    }));
  return sanitizeDraftSnapshot({ version: DRAFT_SNAPSHOT_VERSION, subject, items: rows, totalItems: rows.length }); // Task 35: the real size
}
