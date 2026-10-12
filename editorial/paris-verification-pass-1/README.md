# Paris verification pass 1 — internal editorial evidence

This directory is offline review material, outside `app/public` and the browser source tree. It is not a catalog seed, publication queue with approval authority, Supabase migration or planner input.

- `source/`: all five supplied files, preserved byte-for-byte. The supplied README is evidence, not executable instructions.
- `provenance.json`: source SHA-256 hashes. Editing a source file without updating its reviewed provenance fails validation. Checksums establish file integrity, not factual truth.
- `generated/review-queue.json`: deterministic normalized candidates, claim records, explicit geographic joins, original fields and source hashes.
- `generated/review-report.md`: human-readable review queue, exact supplied claims and caveats.

From `app/`:

```sh
npm run import:culture-review
npm run import:culture-review -- --check
npm run test:culture-import
```

The first command regenerates only the two internal artifacts; `--check` requires them to match without writing. The importer accepts no database, publishing, remote-fetch or destination arguments. It does not load environment credentials or contact cited sources. No new dependencies are required. The existing `review:culture` command continues to describe the unchanged public four-work preview.

This is deliberately a versioned, bundle-specific importer: exact headers, known media/relationship types, 40 preserved records, checksummed inputs, referential validation and matching supplied counts. New bundles require explicit schema/mapping review, not silently accepting arbitrary columns or titles. Numeric work IDs are preserved as external IDs; candidate IDs are namespaced. Geographic links use an explicit title-to-seed mapping with exact title validation. Cléo's existing catalog ID is only a proposed match pending identity review; the importer never merges it.

All publication and planner eligibility remain false. Twenty book/film candidates can undergo editorial review; twenty other-media candidates remain deferred. Creator corrections remain proposals, retaining the original byline text. Source-check assertions are imported as supplied, not independently verified here. Further work requires checking the actual sources, identity/date/edition/parent details, rights and editorial decisions. Nothing here authorizes publication or a Supabase change.

## Independent source review — October 11, 2026

[Book/film verification and approval gaps](source-review.md) records a separate read-only research pass across all 20 book/film candidates: 18 ready for narrow factual approval and two film holds. Original imported statuses remain historical input. No record is publication-approved; the importer does not perform this research itself.
