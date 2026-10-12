# 11 — Offline Paris editorial import

Implemented October 11, 2026 (America/New_York), following explicit authorization for an offline importer, validation tests and review report. No records were published, no Supabase operations were performed, and nothing was deployed.

## Delivered

The supplied five-file bundle is preserved byte-for-byte under `editorial/paris-verification-pass-1/source/`, with SHA-256 provenance. The bundle and generated artifacts live outside browser source/public assets. Instructions inside the supplied README are treated as source text; its proposed Supabase import is not executed.

`app/scripts/culture/import-review.mjs` parses BOM/quoted/multiline CSV, checks exact headers, validates candidate IDs, claim references, source URLs, dates, caveats and report counts, and normalizes all 40 candidates with stable namespaced IDs. Numeric work IDs remain external IDs. Geographic records receive explicit seed references; there is no fuzzy title merge or planner-place mapping. The existing Cléo record is a pending identity-match proposal only. Creator corrections remain proposals.

The output contains 40 candidates, 12 supplied source-checked claims covering 12 candidates, and nine geographic edges. All candidates remain pending with publication eligibility false. Twenty book/film candidates enter the current review queue; twenty other-media candidates are deferred. The importer does not independently recheck sources or treat claim-level checks as whole-record approval.

Generated artifacts:

- [Review report](../../editorial/paris-verification-pass-1/generated/review-report.md): full candidate queue, exact supplied claims, source links/dates, geographic caveats and remaining review gates.
- [Normalized queue](../../editorial/paris-verification-pass-1/generated/review-queue.json): original fields, source hashes, deterministic IDs and explicit non-publication flags.
- [Workflow instructions](../../editorial/paris-verification-pass-1/README.md).

## Commands

Run from `app/`:

```sh
npm run import:culture-review
npm run import:culture-review -- --check
npm run test:culture-import
```

Generation changes only the two internal artifacts. Check mode is read-only and fails on stale generated content. There are no provider, database, publication or deployment commands. The existing `review:culture` command and four-work public catalog remain unchanged. No dependencies were added. A separate small `culture-review.yml` CI workflow runs `test:culture-import` with Node 22 and no dependency install or credentials; it has not been run on GitHub here. The existing quality workflow remains untouched because iCloud offloaded its local contents during copy-back.

## Validation

- Eight importer test groups passed, including malformed CSV, duplicate/orphan identities, inconsistent claim scopes/statuses, unsafe URLs, invalid dates, unsupported relations/media, missing historical caveats, promotion attempts, checksum tampering, stale output detection, deterministic regeneration and safe report rendering.
- Existing `test:culture`, route `smoke`, and `test:preservation` passed.
- Production `build` passed, including TypeScript/API runtime checks and all 323 release-media checks. All 40 audiovisual stream hashes remain preserved. Existing large-bundle warnings remain.
- Public catalog seed/schema, catalog API and app routes match their pre-change SHA-256 hashes. All five supplied files match their source bytes. No internal evidence markers appear in built public HTML/JavaScript/JSON.
- Scoped Git whitespace checks passed. Validation ran from the established non-iCloud copy; the tested files were mirrored back into the original workspace and compared byte-for-byte.

## Limits and next gate

This importer is intentionally specific to this versioned bundle. A new schema, bundle or identity mapping requires explicit review. Checksums prove integrity, not truth. No canonical external IDs, record-level approval, edition/parent resolution, source rights review, geographic POI matching or factual re-verification is claimed. Publication and broader media support require a separate authorized task. The public discovery experience is unchanged.

## Follow-up source verification — October 11, 2026

[Independent source review](../../editorial/paris-verification-pass-1/source-review.md) documents all 12 books and eight films with authoritative source links, supported facts and remaining gaps. Eighteen candidates are ready for scoped factual approval; *Paris, je t’aime* needs final director-credit reconciliation and *The Intouchables* needs explicit Paris-setting evidence. No candidate is publication-approved. Edition dates, current creator aliases and historical filming context are documented without changing supplied source files or normalized candidate flags.

The generated review report links to the supplement; regeneration preserves that reference. The earlier limitations describe the original import: this follow-up supplies limited factual re-verification, not full rights clearance, canonical registry matching, POI matching or publication approval. The discovery experience remains unchanged.

Validation for this follow-up: all eight importer test groups and deterministic artifact checks passed; all seven culture golden queries plus API/bookmark/trip-isolation checks passed. The existing culture check initially encountered a sandbox restriction writing its temporary compiled file and passed when rerun with cache write access. No production build was rerun for this documentation/report-link-only update; the preceding importer implementation build remains the latest build result.
