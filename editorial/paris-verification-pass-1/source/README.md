# Elsewhere Paris: verification pass 1

All 40 priority records have been preserved in the audit queue. **12 contain at least one source-checked claim; zero are fully approved for public publication.** This is an intentionally claim-scoped status.

Files:
- `priority_40_verification.csv` — exactly 40 ranked records with status, corrections and next checks.
- `source_backed_claims.csv` — publisher, platform, BFI, or originating podcast evidence for 12 items.
- `verified_place_edges.csv` — 9 supported geographic relationships (including 3 filming locations from BFI).
- `verification_report.json` — machine-readable counts.

Not completed: canonical provider IDs for all media, exhaustive year verification, edition-level audio verification, season episode IDs, matching geographic references to Copy My Trip IDs, Supabase apply or publishing. The source URLs support ONLY the specified claims.

Integration: import these review results into the earlier Supabase staging schema as internal editorial evidence. Do not set work status to `published` until record-level checks pass. A current author's byline may differ from the original publication byline; store aliases. Never treat a film shot in Paris as evidence of a current shop at that address.
