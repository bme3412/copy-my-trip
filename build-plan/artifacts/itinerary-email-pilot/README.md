# Itinerary delivery pilot — review copy

These review files were produced by the application's actual email renderer. The pilot was approved; its equivalent immediate test with a real private link has been delivered. The scheduled message and final pause are pending; current status is in [plan 17](../../17-scheduled-itinerary-email-preview.md).

- Recipient proposed for approval: `erhardbr@gmail.com` only.
- Sender: `Copy My Trip <itinerary@mail.copy-my-trip.com>`.
- Content: a labeled demonstration trip, seven Paris stops on 13 September 2026, notification zone America/New_York. Destination activity times stay in Europe/Paris.
- Messages: one immediate test and one scheduler-driven email, proposed for 20:00 America/New_York on 12 September (first eligible five-minute cron tick), then pause. If approval arrives after that window, prepare a new future date; do not backfill.
- [Test HTML](test.html), [test text](test.txt), [scheduled HTML](nightly.html), [scheduled text](nightly.txt), [frozen briefing](briefing.json).
- Private-link UUIDs are placeholders in these review files. Real messages get job-specific authenticated links.
- No weather or verified current operational alert is promised. Historical archive labels remain visible.

Verified preview: https://copy-my-trip-84cmhj6kg-bme3412.vercel.app (`dpl_EVdve1namNN64mcw7KSm897xyQ8y`). The same runtime is now published at https://copy-my-trip.com as production deployment `dpl_89RPFFNBN8sTGb6LGQqUtTyRT2cW`. The user approved publication, the temporary pilot account/demo trip, and exactly two itinerary emails. The earlier two account-email tests are complete and separate.

Activation should retain the single-owner restriction and use a two-submission daily cap for this bounded pilot. After the scheduled message is recorded, pause its preference/global delivery and verify duplicate ticks do not resend. Confirm provider events, exact-version access, and pause behavior before removing only the tagged temporary account and its fixture data. Do not mutate an existing account if one appears before setup.

Regenerate from `app`: bundle `scripts/mail-pilot-preview.ts` with esbuild (Node CJS, `import.meta.env={}`), then run the output with an optional YYYY-MM-DD argument. The script only writes these local artifacts.
