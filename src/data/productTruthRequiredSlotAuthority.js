// PRODUCT TRUTH FOUR-FINDING REMEDIATION - Finding 1 (Codex "PRODUCT TRUTH FINAL THREE-ACTION DELTA REVIEW: FAIL"):
// "the required-slot integrity checker protects Owner and Support exact-set semantics, but Plan/Role and Security
// can accept same-cardinality substitution" - altering one Plan/Role slot id and one Security slot id while keeping
// 13 / 9 entries was not detected.
//
// THIS FILE is the IMMUTABLE, INDEPENDENT required-slot authority for ALL FOUR matrices. It is a second, separately
// committed declaration of exactly which slots the acceptance matrices consist of - the id of every required slot
// AND a SHA-256 identity digest of that slot's full meaning (id, persona, language, prompt, expected result,
// expectation authority, and the matrix-specific fields: Owner area/subtopic/phrasing, Plan/Role entitlement,
// Security cell + forbidden-leak patterns, Support category). checkFinalMatrixDefinitionIntegrity() compares the
// definition it is handed (productTruthFinalMatrixAcceptance.js - or any tampered copy) against this table:
//   - a MISSING required slot            => fails (required_slot_absent)
//   - an EXTRA slot                      => fails (slot_outside_canonical_required_set)
//   - a renamed / re-id'd slot           => fails (both of the above - the canonical id is gone, an unknown id appeared)
//   - a same-cardinality substitution    => fails (13 stays 13 / 9 stays 9, but the id set or a digest no longer matches)
//   - a slot whose prompt / persona / language / expectation / patterns changed under the same id => fails (slot_identity_changed)
//   - a duplicated slot                  => fails (duplicate_slot_ids_in_definition, checked by the integrity check itself)
//   - a pure REORDER of the same slots   => allowed (identity is keyed by slot id, never by position)
// Nothing here is derived from any evidence row, evidence file, or the rows under validation; changing the required
// set therefore requires a deliberate, reviewable edit of THIS file AND the definition, never just one of them.
import { createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const pat = (p) => `${p.source}/${p.flags}`;

/**
 * Canonical, position-independent serialisation of one slot's full meaning, per matrix.
 * @param {'owner'|'planRole'|'security'|'support'} key
 * @param {object} slot
 * @returns {string}
 */
export function canonicalSlotIdentity(key, slot) {
  const common = [key, slot?.slot, slot?.persona, slot?.language, slot?.prompt, slot?.expectedResult, slot?.expectationAuthority];
  if (key === 'owner') return JSON.stringify([...common, slot?.area, slot?.subtopic ?? null, slot?.phrasing]);
  if (key === 'planRole') return JSON.stringify([...common, slot?.fixtureExpectedEntitlement]);
  // structured-truth closure: the expected STRUCTURED outcome is part of a Security / Support slot's identity (Owner / Plan-Role slots
  // already carry it as expectedResult), so it cannot be edited without a deliberate change of this table too.
  if (key === 'security') return JSON.stringify([...common, slot?.cell, (slot?.forbiddenResponsePatterns || []).map((p) => (p instanceof RegExp ? pat(p) : String(p))), slot?.expectedStructuredOutcome]);
  if (key === 'support') return JSON.stringify([...common, slot?.category, slot?.expectedStructuredOutcome]);
  return JSON.stringify([key, slot?.slot]);
}

export const slotIdentityDigest = (key, slot) => sha256(canonicalSlotIdentity(key, slot));

// The canonical required-slot identity table: `{ matrix: { requiredSlotId: identityDigest } }`.
// (Generated once from the reviewed acceptance definition by scripts/generate-required-slot-authority.mjs, then
// committed as static text - it is NEVER recomputed from the definition or from evidence at validation time.)
export const REQUIRED_SLOT_IDENTITY_DIGESTS = Object.freeze({
  owner: Object.freeze({
    "calculator|direct|he": "4be74dde49957584adf8e2a0eabd17f42c306283f693d60ce5673555463d38df",
    "calculator|direct|en": "5e593c6cbab5cd74b8f854a04dd8089a31ed82b175527a60a1f81d287a5dc8df",
    "calculator|paraphrase|he": "f21de8278fea434c4491fe0ebf16ab6eb49ced350492ec4f85da99e525bd1f41",
    "calculator|paraphrase|en": "45b286a5873f98b8c69c98b50d9b7189246f66e4209d525d958b5e040911a10c",
    "calculator|adversarial|he": "35bad620638716474eb9932eaa32cc6321d6343f42c0c9cfd873d54b54dcc3f2",
    "calculator|adversarial|en": "8760f0674b52d55c12ce9f883aa8c6b8b6796725780e21005f8463e19000b936",
    "pdf_print|direct|he": "ca655a6be85e4cfb7ad54b9be25391ccdc5698a3c7f4e0a454894b66f44d3d9b",
    "pdf_print|direct|en": "f5f9b700139caa32f485c8301df7ff315b0a8e009e594b214991ff07ce1a9c77",
    "pdf_print|paraphrase|he": "605cbe656b71b118b07ce8e153f0e3ff4a8846d3b4e7c1b5e4e408d71cedf4ad",
    "pdf_print|paraphrase|en": "0c2da57006bd126bcb92a51416330a9a2fbdad2c51a906f526dedd71c3bf4b23",
    "pdf_print|adversarial|he": "f171658bbe02716a5be08a6de32d3a2d9db763337b276ace2406692fd11de5b8",
    "pdf_print|adversarial|en": "dd30895cead7184231db5cd0574853b5739c153b6c8484e801f2779a736bc641",
    "whatsapp|direct|he": "8be9c82a173722155e0724ccd62086fe01896c0d19043736cccea8177097e2fd",
    "whatsapp|direct|en": "e5fbbb496aff84ad2ac833296a76983c6f5f2c813787a8927a6fc001f7bf4ae7",
    "whatsapp|paraphrase|he": "0ab298be8fde5afc1ff2ad4a63e97ce72bcf0a6c88d1af29ce21d400fece0c2a",
    "whatsapp|paraphrase|en": "189f90c15dbcc363daca9ed34b915d800a1efb3ac34a4e06bacb96394c6c8abe",
    "whatsapp|adversarial|he": "646fdc8173e4c9e75fc3e440b7b2119b4ed871025b222cce2170edb6d07a9e1c",
    "whatsapp|adversarial|en": "cdbe9457ca01202a6904942d2e6c67db2373fd4b010cecf4b6bebf87cdf961bf",
    "quote_email|direct|he": "380d7baf75cf819168a05343642c2c85e5358c10f5f89c254ae54ef9ae4ddbe4",
    "quote_email|direct|en": "b011ad876eeb4a10f844d831324df93b02e65e9557d5fdd6e185457de31e0994",
    "quote_email|paraphrase|he": "54cc6170ce485f4086c0413c0548274257ed84ad36f7306275d087682e84bcaf",
    "quote_email|paraphrase|en": "47cfef6b89c4ad9e730177b9bd191d47a6819bb9f86d08c2f46482ac87f6f470",
    "quote_email|adversarial|he": "98e14283359f6a1e2da8fc73ce3d3cfe40866964b91f8b19af6bf68da89373de",
    "quote_email|adversarial|en": "27d9fed762ed914a3f4225c979bdeaa962a728a2471308045662de67214abda0",
    "attachments|direct|he": "21743f2bcb9be0006d291f08d76dbefe653df2f9cbea3bb7bddffe7987892887",
    "attachments|direct|en": "1bf48780476ebc36aba9d4a5fc78569d860f48c12bd79a4ad9e34cd113f26fa3",
    "attachments|paraphrase|he": "8a97cc91e65a50b8a34e7cbba164cb40d844ed3044bce6297d8af80feeb21e3f",
    "attachments|paraphrase|en": "7bfc81f5ca62fe60bb6956113485678de7850e33aa6b92da382d29cf825a6a5a",
    "attachments|adversarial|he": "76f02a265278cebba4344de5df7d415d07938d83db12dc1d423321732d8bf734",
    "attachments|adversarial|en": "4798c3bc79553c79628aa07dc70f081b7fc7e7f4c2d9315980f6b9b366a7a0ad",
    "measured_quote|direct|he": "087d8df991e1852d48f49a6f7a59d8a89dabf950205183c7874d7df8ccd14687",
    "measured_quote|direct|en": "372dc5f05381c14d532d9acf3fc5ddd824966d2d06698715fdc92eade8b02199",
    "measured_quote|paraphrase|he": "cd91c3531e298cda7af8d386f1ad366d344298ece8655a96a41df57eea4499d7",
    "measured_quote|paraphrase|en": "185f38dd6245c67b51792966a27926fcbacd32a3a87376d9b65d1cd65bfe50fa",
    "measured_quote|adversarial|he": "9cb0c88615736b7c6f0bef3f358bc1c856e6a726fe8c32d89463a0a96aedb322",
    "measured_quote|adversarial|en": "83b43da38f46d3d0ec788e4f7024546527f8d030b80217a03425de4ece1bb4fd",
    "payment_invoicing|direct|he": "037aab84f8652c0a5df5c75816357800db1c0927a5f32fcb54153ac7bcce756e",
    "payment_invoicing|direct|en": "a6ee8be71b51ccb59bb9e33f2b29be73e1cb5e62a8278f6563ec7316cc755b5e",
    "payment_invoicing|paraphrase|he": "3279b15b35b35d747df133cdbf9cfd6c8db1404ca1bb062617acee8828dd9d87",
    "payment_invoicing|paraphrase|en": "e75c6400a921d738d02ac25e08156d2f2b09b17c4f5f73636952b0582884159e",
    "payment_invoicing|adversarial|he": "5b10d99da4d423a22d89d6ed20556c9c5e42ded993610b1346f786760b464dbd",
    "payment_invoicing|adversarial|en": "567aa324d165511255c2985daff47b73825c22df9b19f88f25a08b351121b687",
    "ai_mutation|direct|he": "b6e425a45a83ab51fc870643c866776a8d9cda4b715d9cc46bf8e2c613858380",
    "ai_mutation|direct|en": "2d48efeedf57120935c90835a2ec248671c1c21a85bc72b2066a1d753d96aff7",
    "ai_mutation|paraphrase|he": "ad192ef03e6218ba9ac9fa46179875b986300eccfa9443035cc0dc3e513a47ce",
    "ai_mutation|paraphrase|en": "fff45d7bc356d4a2787b730efc873ec4eb85ffbc1136b166a4f0ca790b23fbc1",
    "ai_mutation|adversarial|he": "93f6d5fcd9f23e31e5dab61596f048d970a6f8252e0d536b0193d55b17e6eba7",
    "ai_mutation|adversarial|en": "e8a53df35b53bc725c7c72de4f1539beb09e4a4529a3564fa6786ad6e565eda0",
  }),
  planRole: Object.freeze({
    "PR-01": "23decf39439c6f9e10a4edc0e6ebf2629a7a2cea05b0d7037c4fbf6de13644a3",
    "PR-02": "454212ca89355c7944f8c050b8b99f7253fb598ede6bd91945c6fd896b8c3aca",
    "PR-03": "9f761dd5eebf147be72d5c831c942fd67803cbe5425afaa3fc7c003497552f06",
    "PR-04": "c81ab054bd0aef6f7927f7bab1ca0e4eafc7e83fb6a962743bac5349cbeca334",
    "PR-05": "dfb44bebd790da8395ac38d666617685d593b74b04c8d5b3641d0b511e1ecd27",
    "PR-06": "dfc1502cf9cf85ce11ebe8907baa09ca4eaf7b154da2792763a9f12fc23d819c",
    "PR-07": "757eda8aef18c105953c32362c661acf33250d51064603b01d0d9ed4fc490374",
    "PR-08": "ecd4547d058e340ec5ca18401401f19802dfde522541c8e1bdda40da0807bd36",
    "PR-09": "eec0e9f0f4d8f2d7b1630c71dfd44943b1b8754478b0b680123d5d93aa9d1b8b",
    "PR-10": "d10a04f8d0754de0dd76de1c96d7fff1ccb32f9fdd8f975c35704a240a4696fa",
    "PR-11": "237ac7379967fd5715844a0550b9ff5570fbf14428ed66df83473971a462d59e",
    "PR-12": "3331cea8aa34288c755014f714323af5ff0b1b68ba11639f1e7f2cd9e163159d",
    "PR-13": "4ef39731077719712674a54e91c6488c61c9efbfc98bebf15c27bfe54a81abfd",
  }),
  security: Object.freeze({
    "SEC:cross_tenant_quote": "9c39adecd450302f5fddc5af98663c677ac8edf02ddaeec494748fe93cce8cf0",
    "SEC:cross_tenant_client": "51dd49e9625503722b2b31de8779e5c307339d3cdb2a243fa20d23f6f99a314a",
    "SEC:target_existence_leak": "6a25e4baaca85dc786508cff2b5d5dba4ab7e5caf8d845ee1b3ce826bc1fbfd6",
    "SEC:role_forgery": "4bdbe17e23228af37727208c2372a5c849e8e33a34db785bcb1c5a0fdbec2371",
    "SEC:market_forgery": "c2ec2432829518a4501959c0d07802ab1a8a944d96e7851ea9d5d6178673cdac",
    "SEC:entitlement_bypass": "2b87d44283f9be26ed3944ce95f53def0b4a7f8e219fd3be7cff150645cf2784",
    "SEC:arbitrary_url": "62791c2d69cf081a591cac3a7e82a15dee734b53aac520db68610fd4f89c9924",
    "SEC:prompt_injection": "59c53e5499610a504dbac58c03901f5aa23dca2ff57d9a392e47f131f2877294",
    "SEC:ai_mutation_security": "e8a382fb2ff7884622545f0ab7782c1d7286ccf88d60f718e894e373c66ac067",
  }),
  support: Object.freeze({
    "SUP:GENERAL": "37a2af487d9905de4c593b71fc19f10374d3316a7ed02d3f8efe90f49b5c8fbd",
    "SUP:CANCELLATION": "ed8ea3f801963b69eb2361ab2df72ea4e8a63056e0061bbb6cb493b763d873d5",
    "SUP:FEATURE_REQUEST": "369a9ca02f738d52f69733611f49cdb6a4f342cc398b57c9bbf9d4a5b0016338",
    "SUP:HARD_QUESTION": "02b54c761e53a85ca68cb991fd14265f4e34b2191e07f8777a68a48852b97948",
  }),
});

/**
 * Compares a matrix definition's slot list with the canonical required-slot identity table.
 * @param {'owner'|'planRole'|'security'|'support'} key
 * @param {object[]} slots
 * @returns {string[]} problems (empty = the definition is EXACTLY the canonical required set, in any order)
 */
export function checkAgainstRequiredSlotAuthority(key, slots) {
  const problems = [];
  const canonical = REQUIRED_SLOT_IDENTITY_DIGESTS[key];
  if (!canonical) return [`no_canonical_required_slot_authority_for:${key}`];
  const byId = new Map();
  for (const s of slots) {
    if (byId.has(s?.slot)) problems.push(`duplicate_slot_in_definition:${s?.slot}`);
    byId.set(s?.slot, s);
  }
  for (const id of Object.keys(canonical)) {
    if (!byId.has(id)) problems.push(`required_slot_absent:${id}`);
  }
  for (const [id, s] of byId) {
    if (!(id in canonical)) problems.push(`slot_outside_canonical_required_set:${id}`);
    else if (slotIdentityDigest(key, s) !== canonical[id]) problems.push(`slot_identity_changed:${id}`);
  }
  return problems;
}
