// GENERATED FILE - DO NOT EDIT BY HAND.
// Generator: tkrtool-iron:scripts/mirror/build-aqp-production-bundle.mjs
//   regenerate: node scripts/mirror/build-aqp-production-bundle.mjs --prestate <PRODUCTION aqp-1 pre-state artifact.json>
//   verify:     node scripts/mirror/build-aqp-production-bundle.mjs --prestate <same artifact> --check
//   (READY: generation and --check require clean, tracked generation sources at the tooling commit META.generatorCommit)
// PRODUCTION_BUNDLE_SHA256 = sha256 of the UTF-8 bytes of PRODUCTION_BUNDLE_SQL. The broker sends these exact bytes, once.
// STATUS: PENDING - FAIL CLOSED. No PRODUCTION pre-state artifact exists yet; the SQL is empty and the sha is "PENDING".
// The broker must refuse every request unless PRODUCTION_BUNDLE_META.status === "READY" and the sha256 verifies.

export const PRODUCTION_BUNDLE_SQL: string = "";

export const PRODUCTION_BUNDLE_SHA256: string = "PENDING";

export const PRODUCTION_BUNDLE_META = Object.freeze({
  status: "PENDING_PRODUCTION_PRESTATE_CAPTURE",
  profileId: "aqp-drop-20260929000000",
  migrationFile: "20260929000000_drop_legacy_approve_quote_public.sql",
  migrationSha256: "7c9c1fb54e7ce99896b9ba49f17b0608c686c340faa65ecefbb78ef949929ef4",
  candidateCommit: "623ac1ee01995b071b5f0d9a8f3d6f1cef87cc23",
  targetKind: "PRODUCTION",
  targetRef: "ixabnzhjeqevtbhdfswv",
  prestateSchema: "tekango-migration-prestate/aqp-1",
  prestateArtifactSha256: "PENDING",
  prestateCapturedAtUtc: "PENDING",
  nonce: "PENDING",
  dollarTag: "PENDING",
  missing: "a tekango-migration-prestate/aqp-1 artifact built by buildAqpPreStateArtifact from ONE separately-authorized read-only PRODUCTION capture of AQP_SNAPSHOT_SQL (scripts/migration-executor-profiles.js); no such capture exists yet",
  generator: "tkrtool-iron:scripts/mirror/build-aqp-production-bundle.mjs",
  generatorCommit: "PENDING",
});
