# 2026 seed-data leads (perishable — re-verify before use)

The superseded docs in this directory embed several date-specific claims as if they
were durable facts. They are indexed here so the frozen originals stay untouched and
nothing dated leaks into the living plan docs. All were collected **~mid-2026** by the
LLM that drafted the originals and have **not** been independently verified.

Their only intended use: candidate seed rows and test fixtures for the Phase 2
`exceptions` model in `02-roadmap.md`. Re-verify against official sources before
shipping any of them as data.

| Claim | Where stated | Use |
|---|---|---|
| Eiffel Tower exceptional closure July 13, 2026 (instead of July 14) | `logic.md` §8 (~line 429) | Example `exceptions` row: date-specific closure overriding weekly hours |
| Louvre galleries may close during high heat (not all spaces air-conditioned) | `logic.md` §8 (~line 429) | Example of a contextual/partial closure state |
| RER C closed July 15 – Aug 22, 2026; Versailles reachable via alternative Transilien routes | `logic.md` §12 (~line 599) | Example of date-bounded transit disruption affecting a day trip |
| European Heritage Days Sept 19–20, 2026 | `logic.md` §7 (~lines 346–363) | Example of a date-specific event that changes what a day is for |

Durable weekday facts (Louvre closed Tuesdays, Orsay/Versailles/Rodin/Carnavalet
closed Mondays, Pompidou/Orangerie closed Tuesdays) are already encoded in
`app/src/cities/paris/places.ts` via `closedOn` and do not belong in this file.
