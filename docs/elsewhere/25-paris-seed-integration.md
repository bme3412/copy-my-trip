# Paris seed catalog: implementation and review

Completed locally on 2026-10-12. No deployment, Supabase changes, Spotify integration, itinerary redesign or trip-input changes.

## Result

- Preserved all 120 supplied entries and their source bytes; explicit reconciliation finds 27 existing identities.
- Reviewed the 24-candidate first batch: 22 accepted for local source-attributed display; 2 held. The remaining 71 unmatched entries stay queued.
- The app now contains 55 works: 53 Paris and 2 Rome. All 33 previous records and their original fields remain intact; v3 adds evidence-linked metadata.
- Added 6 books, 5 films, 3 TV shows, 3 songs, 4 podcast episodes and 1 essay. Poem support is validated, but no poem has passed the selected-edition check yet.
- Paris adds five available More to discover highlights. The existing photography, archive, playlist, story content and Before Sunset connection remain. Browse contains the complete reviewed collection.
- Added three free editorial collections: Work and everyday life; Walking and observation; The Seine. Connections are editorial pairings, not historical, adaptation or filming claims.

## Reconciliation and evidence

[All 120 decisions](../../editorial/paris-atlas-120/generated/review-report.md) · [Machine-readable review queue](../../editorial/paris-atlas-120/generated/review-queue.json) · [Original draft](../../editorial/paris-atlas-120/source/catalog.md) · [Decisions and source facts](../../editorial/paris-atlas-120/decisions.json).

Supplied titles, creator credits, dates, priorities and association descriptions remain in the queue’s original fields. Proposed corrections and publication decisions are separate. No fuzzy title merging or existing-ID replacement occurs. Matches to earlier review records use explicit IDs. Existing items absent from the draft—including the playlist and Miles Davis recording—remain available.

Known corrections: Impossible City keeps its publisher-documented 2024 edition, rather than the supplied 2022; The Other Paris retains Lucy Sante. The Flâneur’s selected 2026 reissue is not presented as its original publication. Dutronc and Baker seed composition dates never overwrite existing INA performance identities.

### Accepted first-batch evidence

All linked metadata was checked on 2026-10-12. Publisher descriptions are summarized and attributed; no timestamps, full listening review or artwork permission are inferred. Original-publication years are supplied only when established separately from the selected edition. Unknown composition/recording dates remain absent.

| Candidate | Included identity / date distinction | Sources |
|---|---|---|
| A Moveable Feast | book; selected 1996 Classic edition hardcover; ISBN 9780684833637 | [Scribner · A Moveable Feast](https://www.simonandschuster.com/books/A-Moveable-Feast/Ernest-Hemingway/9780684833637) |
| The Belly of Paris | book; original 1873; selected 2009 Paperback; Mark Kurlansky; ISBN 9780812974225 | [Modern Library · The Belly of Paris](https://www.penguinrandomhouse.com/books/196067/the-belly-of-paris-by-emile-zola/) |
| The Hunchback of Notre-Dame | book; selected 2019 Paperback; Isabel F. Hapgood; ISBN 9789389567793 | [Fingerprint / Penguin Random House · The Hunchback of Notre-Dame](https://www.penguinrandomhouse.com/books/831775/the-hunchback-of-notre-dame-by-victor-hugotranslated-by-isabel-f-hapgood/) |
| The Elegance of the Hedgehog | book; selected 2008 Paperback; Alison Anderson; ISBN 9781933372600 | [Europa Editions · The Elegance of the Hedgehog](https://www.europaeditions.com/book/9781933372600/the-elegance-of-the-hedgehog) |
| The New Parisienne | book; selected 2020 Hardcover; ISBN 9781419742811 | [Abrams · The New Parisienne](https://www.abramsbooks.com/product/new-parisienne_9781419742811/) |
| An Attempt at Exhausting a Place in Paris | book; selected 2010 Paperback; Marc Lowenthal; ISBN 9781939663836 | [Wakefield Press · An Attempt at Exhausting a Place in Paris](https://wakefieldpress.com/products/an-attempt-at-exhausting-a-place-in-paris) |
| Paris, 13th District | film; 2021 | [Festival de Cannes · Paris, 13th District](https://www.festival-cannes.com/en/f/les-olympiades/) |
| Full Time | film; 2021 | [Music Box Films · Full Time](https://www.musicboxfilms.com/film/full-time/) |
| Les Misérables | film; 2019 | [Festival de Cannes · Les Misérables](https://www.festival-cannes.com/en/2019/meeting-the-team-of-les-miserables-by-ladj-ly/) |
| La Haine | film; 1995 | [Criterion · La Haine](https://www.criterion.com/films/216-la-haine) |
| The Red Balloon | film; 1956 | [Criterion · The Red Balloon](https://www.criterion.com/films/886-the-red-balloon) |
| Call My Agent! | tv show; 2015–2020 | [Netflix · Call My Agent!](https://www.netflix.com/gb/title/80133335); [France Télévisions · Dix pour cent credits and dates](https://www.francetelevisions.fr/et-vous/notre-tele/a-ne-pas-manquer/dix-pour-cent-3785) |
| The Eddy | tv show; 2020–2020 | [Netflix Media Center · The Eddy](https://media.netflix.com/en/only-on-netflix/80197844); [Netflix · The Eddy credits and 2020 release](https://www.netflix.com/gb/title/80197844) |
| Lupin | tv show; 2021 start; no asserted end | [Netflix · Lupin creator and 2021 release](https://about.netflix.com/fr/news/netflix-today-confirms-original-french-series-lupin-will-return-summer-2021); [Visit Paris Region · Lupin](https://www.visitparisregion.com/fr/parcours-cine-tourisme/lieux-tournage-lupin) |
| Paname | song; Official music video for Paname, Slimane’s 2016 single. | [Official artist channel · Paname](https://www.youtube.com/watch?v=Xs90a3K9aIU); [Paroles.net · song subject (licensed lyrics; not reproduced)](https://www.paroles.net/slimane/paroles-paname); [Apple Music · Paname release metadata](https://music.apple.com/us/music-video/paname/1445012827) |
| Je connaissais pas Paris le matin | song; Midi 20 album recording; official artist-channel audio supplied by Universal, release date 27 March 2006. | [Official artist channel · Je connaissais pas Paris le matin](https://www.youtube.com/watch?v=r-8m6CC3Yvs); [Paroles.net · song subject (licensed lyrics; not reproduced)](https://www.paroles.net/grand-corps-malade/paroles-je-connaissais-pas-paris-le-matin) |
| Paris va bien | song; Les Chroniques Du 75, En Attendant L’Apogée album recording; official artist-channel audio supplied by Jive Epic, release date 4 April 2011. | [Official artist channel · Paris va bien](https://www.youtube.com/watch?v=vTqplgREdsM); [Paroles.net · song subject (licensed lyrics; not reproduced)](https://www.paroles.net/sexion-d-assaut/paroles-paris-va-bien) |
| The Seine River’s Past & Present with Mary Winston Nicklin | podcast episode; 2024-11-23; publisher GUID retained | [The New Paris Podcast · publisher RSS](https://anchor.fm/s/1d906628/podcast/rss) |
| On bikes, the Olympics, & the Transforming City with Brent Longley | podcast episode; 2024-03-11; publisher GUID retained | [The New Paris Podcast · publisher RSS](https://anchor.fm/s/1d906628/podcast/rss) |
| Documenting the everyday in Paris with Seb Emina | podcast episode; 2024-06-10; publisher GUID retained | [The New Paris Podcast · publisher RSS](https://anchor.fm/s/1d906628/podcast/rss) |
| The Changing Urban Landscape of Paris with Alice Cabaret | podcast episode; 2018-04-11; publisher GUID retained | [The New Paris Podcast · publisher RSS](https://anchor.fm/s/1d906628/podcast/rss) |
| The Painter of Modern Life | essay; original 1863; selected 2010 Penguin Great Ideas ebook; P. E. Charvet; ISBN 9780141956435 | [National Gallery of Art · Picturing France, Paris and the Painters of Modern Life](https://www.nga.gov/sites/default/files/migrate_images/content/dam/ngaweb/education/learning-resources/teaching-packets/pdfs/picturing_france.pdf); [Penguin · The Painter of Modern Life, P. E. Charvet translation](https://www.penguin.co.uk/books/177555/the-painter-of-modern-life-by-baudelaire-charles/9780141956435) |

### Held and unresolved

- **PAR-062 · Adieu Paris:** artist/release identity found, but a sufficiently strong Paris-subject justification remains unresolved. This is not included just because Paris appears in its title.
- **PAR-114 · Zone:** the poem and the NYRB Selected Poems volume of the same name need distinct identities. A selected translation and exact publication attribution remain unresolved. No anthology is mislabeled as the standalone poem, and no empty highlight card appears.
- **Seb Emina episode:** publisher title says episode 132 while the RSS episode-number field says 125. The stable GUID, title, guest, date and duration identify the episode; its episode number is intentionally absent.
- New covers/posters/audio artwork remain unapproved and use intentional typography. Existing approved photography and previous cover handling are retained.
- Metadata review is not firsthand immersion review. Composition dates, exact recording sessions, translations and original dates remain absent where evidence did not establish them.

## Contract and architecture

- Catalog v3 adds tv_show, essay and poem; versions 1 and 2 still parse. Shared format definitions drive filter options, cards and applicable read/watch/listen actions. A TV watched action refers to the show, not episode progress.
- Structured publication/edition, TV spans, parent-publication, external identifiers and music-date fields have strict key/date/source validation. Capacities are independently bounded at 500 works, 2,000 sources and 20 destinations.
- Paris geography is evidenced per new record; both matches either area filter. Existing city-level facts receive additive labels, with explicit wider-France/suburb notes where supported. Geography creates no new pins.
- API and Browse accept area=paris_city|greater_paris. Counts apply search, city and area but ignore the selected format. Search includes podcast show and guest names. Existing q/destination/kind/work URLs, result selection and history remain.
- The public batch JSON is a reviewed artifact, separate from the offline review inventory. A regression test checks it against the approved decision subset. Publication is an intentional file change, never an import side effect.
- The Node ESM runtime smoke fixture now copies imported JSON with its original filename; the build caught and verified this packaging requirement.
- Existing shelf/personal-store schemas and storage keys are unchanged. Saves and explicit activities use stable existing work IDs. A playlist save does not save tracks; no cultural content becomes planner input.
- Empty connection diagrams now render a concise recovery section. No relationship is manufactured for new works that have no independently reviewed edge.

### Assumptions to revisit before a later batch

- A flat work record currently combines a work and one selected edition/recording. Multiple translations, editions or recordings will need explicit parent-work/edition entities rather than additional title-based matches.
- Paris-area labels express evidenced coverage, not exclusive setting and not geocoding. More complex multi-region works may eventually require a geography list.
- Review checks establish attached evidence and explicit eligibility, but cannot establish a source’s truth automatically. Human/editorial decisions remain necessary.
- The larger catalog is still small enough for deterministic in-memory filtering. Revisit fetching/pagination when content volume or source metadata becomes materially larger; do not make the Paris hub a catalog dump.
- New artwork clearance and Spotify recording matching remain independent later tasks.

## Validation

Passed:

- `npm run test:culture-import`: earlier adapter’s 8 groups plus new 4 groups; unchanged source checksum, inventory, explicit matches, publication gates and current generated output.
- `npm run test:culture`: legacy golden queries, schema/source validation, API, saves, corrupt/quota/conflict handling, playlist integrity and audio contracts.
- `npm run test:paris-batch`: exact approved artifact, all old fields/IDs, v1/v2 compatibility, v3 kinds, date/identifier/source failure cases, capacities above 100, geography/API filters, pending exclusion, collection paths, activity undo, backup round-trip and trip isolation.
- `npm run test:paris-discovery`: evidence, graph/list data, branching, invalid paths, daily rotation, state/recovery and unavailable items.
- `npm run smoke`: existing routes plus new TV/essay/book details, geography filter and Seine collection; invalid selections and catalog-failure recovery.
- `npm run test:preservation`: frozen Paris/Rome planner/catalog hashes, storage keys, replay, historical releases and recovery.
- `npm run build`: TypeScript, API checking, unbundled Node ESM runtime checks, Vite production output and media checks. All 282 images, 40 videos and 1 document passed; audiovisual stream hashes and original media remain unchanged.
- Production JavaScript checked for offline review markers and blocked identities. No offline queue or pending records are imported.

Browser checks: Paris, Browse and the essay detail fit 390, 768, 1280 and 1600px without horizontal overflow. Checked desktop/mobile selected-result behavior, reload, Back/Forward, filtered-out selection recovery, zero results, guest search, geography counts, Save/reload/remove in Saved, watched/read undo, keyboard selection and visible focus restoration. Test saves/statuses were removed afterward. New artwork-free records render typographic covers.

A 200%-equivalent reflow check used an 800 CSS-pixel viewport for a 1600px screen and passed. The in-app browser zoom shortcut did not change the zoom factor, so actual browser 200% zoom is not claimed. No new animation was introduced; existing reduced-motion styles remain. This was a targeted keyboard/contrast/layout review, not a complete assistive-technology audit.

Used the Vercel React best-practices checklist for the changed components: hooks remain unconditional, keys stable, forms labeled, state updates functional, URL state preserved, and no new network waterfall or dependency introduced. Existing large Mapbox/application chunk warnings remain nonfatal.

## Local review

- [Paris hub](http://127.0.0.1:5173/discover/place/paris#more-discover-title)
- [Paris Browse](http://127.0.0.1:5173/discover/browse?destination=paris)
- [Greater Paris films](http://127.0.0.1:5173/discover/browse?destination=paris&area=greater_paris&kind=film)
- [TV detail](http://127.0.0.1:5173/discover/work/call-my-agent)
- [Essay and selected edition](http://127.0.0.1:5173/discover/work/the-painter-of-modern-life)
- [The Seine collection](http://127.0.0.1:5173/discover/place/paris/collections/the-seine)

Screenshots are in [paris-seed-screenshots](paris-seed-screenshots/): Paris, Browse and essay at all four widths, a mobile selected result, the desktop highlights and reflow check.

## Workspace delivery

Implementation and builds used the established non-iCloud workspace because source reads in iCloud still time out. Changed source/report/evidence files are copied back individually, then byte hashes compared. No node_modules, build output, media originals or environment files are mirrored. See paris-seed-delivery-manifest.json for the exact changed-file checksums.
