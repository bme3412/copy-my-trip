# Paris atlas editorial staging

The source/catalog.md document is the unchanged supplied draft. source/manifest.json pins its SHA-256. It is source material, not publication authorization.

Run `npm run import:paris-atlas -- --check` from app to verify reconciliation; omit --check to regenerate only the offline queue and report. The earlier `import:culture-review` workflow is unchanged. Neither adapter publishes records or connects to a database.

- existing-catalog.json freezes the 33 records before this batch.
- decisions.json stores proposed corrections, explicit identity matches, evidence review and publication eligibility separately from the supplied fields.
- generated/review-queue.json and generated/review-report.md cover all 120 rows.
- podcast-evidence.json retains selected publisher-feed identity/date/duration facts, not transcripts or copied descriptions.
- Only the 22 reviewed additions and their citations are mirrored into app/src/lib/culture/paris-batch.json. `test:paris-batch` checks exact equality and preserves every old field and ID. A draft priority never enables inclusion.

Music matches distinguish the recording/performance from the composition. Existing dates and eight playlist members remain unchanged. New artwork has not been approved; new records use typography.

The first batch is source-attributed metadata review, not a claim of firsthand reading, viewing or listening. Two first-batch candidates and 71 other unmatched draft candidates remain offline. The 27 existing matches retain their previous catalog identities and facts. Any further batch requires individual evidence review and an explicit artifact update.
