# Paris music, playlist and podcast episodes

Implemented locally on 2026-10-12. No deployment, Supabase changes, provider-account connection or itinerary changes.

## Review screens

- Paris hub: http://127.0.0.1:5173/discover/place/paris
- Paris songs: http://127.0.0.1:5173/discover/browse?destination=paris&kind=song
- Playlist: http://127.0.0.1:5173/discover/work/paris-playlist
- Episodes: http://127.0.0.1:5173/discover/browse?destination=paris&kind=podcast_episode
- Example song: http://127.0.0.1:5173/discover/work/la-seine

Screenshots are in `paris-audio-screenshots/`: hub, playlist and library at 390, 768, 1280 and 1600 pixels; mobile selected detail, keyboard focus and a desktop music-section view.

## What changed

The Paris hub retains its existing stories, places, themes and collections, adding one photographic playlist card, three song previews and three specific podcast episodes. Labels are Music, Playlists and Podcast episodes. All eight tracks are independently explorable through existing work URLs; the playlist preserves the requested order. Listening links open identified external providers; there is no autoplay, embedded player or misleading whole-playlist playback button.

The catalog now contains 33 works: 14 books, 7 films, 8 songs, 1 playlist and 3 podcast episodes. Paris has 31, Rome 2. Existing 21 book/film records and both destination records compare exactly equal to the pre-change baseline.

Catalog contract version 2 adds song, podcast_episode and playlist, optional recording/release labels, publication dates, verified durations, show/guest attribution, source-linked listening URLs and ordered track IDs. Version 1 book/film envelopes remain supported. API and UI share `CULTURE_FORMATS` and `isCultureKind`. Full-catalog validation checks unique, existing song members in the same destination; filtered API envelopes may omit track records. The UI fetches the full catalog before filtering and resolving playlist rows.

Library format counts use city and search while ignoring the selected format. Show and guest names participate in deterministic search. Existing q/destination/kind/work URL behavior, selected details, direct links and browser navigation remain intact. Audio uses typography when approved artwork is unavailable and the existing original river photograph for the playlist. No cover images, lyrics or audio were copied from providers.

The relationship model includes eight explicitly editorial playlist-membership edges, a sourced jazz-episode/bookshop connection, a sourced La Seine/river subject connection and labeled editorial paths to existing stories/themes. Soundtrack association is distinct from subject and editorial curation. No new place coordinates or invented pins were introduced. Graph labels wrap to accommodate audio titles.

Saving uses the unchanged `elsewhere-shelf-v1` store. Saving a playlist does not save its tracks. Songs and episodes support explicit listened-to activity and undo in the existing Paris personal store; playlists do not receive that status. Backup/recovery uses the existing stores and preserves independent saves. Opening a page records no activity.

## Verified content and evidence decisions

Publisher, archive and official artist pages checked on 2026-10-12. Summaries are original paraphrases of attributed publisher notes. These checks are metadata/source reviews, not claims of listening through the episodes or verifying every lyric.

| Order | Selection | Version and primary evidence |
| --- | --- | --- |
| 1 | Jacques Dutronc — Il est cinq heures, Paris s’éveille | [INA](https://www.ina.fr/ina-eclaire-actu/video/i08069434/jacques-dutronc-il-est-cinq-heures-paris-s-eveille): Tilt magazine performance, broadcast 27 March 1968, 2:51. Labeled performance broadcast, not original release. |
| 2 | Édith Piaf — Sous le ciel de Paris | [Official artist audio](https://www.youtube.com/watch?v=SC06NyI6KKU), with Paris context supported by [France Télévisions](https://www.francetvpro.fr/contenu-de-presse/67089218). No uncertain recording year/duration displayed. |
| 3 | Charles Aznavour — La Bohème | [Official video](https://www.youtube.com/watch?v=fVfnEyLOkrM), [INA](https://www.ina.fr/ina-eclaire-actu/charles-aznavour-biopic-monsieur-aznavour-chanson-la-boheme), [18th arrondissement](https://mairie18.paris.fr/pages/un-belvedere-de-la-boheme-a-montmartre-31129). Montmartre story distinguished from literal autobiography. |
| 4 | Joséphine Baker — J’ai deux amours | [INA](https://www.ina.fr/ina-eclaire-actu/video/i06278690/josephine-baker-j-ai-deux-amours): Palmarès des chansons, broadcast 18 April 1968, 2:38. This archival performance is explicitly distinguished from the original release. |
| 5 | Joe Dassin — Les Champs-Élysées | [Official artist audio](https://www.youtube.com/watch?v=tDWeLlvYyYU), [Sony Music](https://www.sonymusic.fr/news/joe-dassinles-champs-elyseesle-clip-danimation-enfin-disponible/) and France Télévisions. No upload date presented as original release. |
| 6 | Vanessa Paradis & -M- — La Seine | [EuropaCorp official film video](https://www.youtube.com/watch?v=vlPZLE2g0Kc): French duet associated with Un monstre à Paris, 2011. Soundtrack relationship identified. |
| 7 | Zaz — Paris sera toujours Paris | [Official video](https://www.youtube.com/watch?v=tmiI98EG1Fo): Paris album, 2014. Notes distinguish Chelles video location from the song’s Paris subject. |
| 8 | Miles Davis — Florence sur les Champs-Élysées | [Official track/player](https://www.milesdavis.com/track/florence-sur-les-champs-elysees-bof-ascenseur-pour-lechafaud/) and [official album notes](https://www.milesdavis.com/albums/the-original-mono-recordings/): 1957 Paris recording sessions; French soundtrack release 1958. Instrumental, not a lyrical city portrait. |

| Episode | Verified metadata and source |
| --- | --- |
| An intro to jazz in Paris | The Earful Tower; Oliver Gee with Alex Freiman; 22 June 2020. [Publisher/player](https://sites.libsyn.com/97575/an-intro-to-jazz-in-paris). Notes identify Square René Viviani and the bookseller/musician connection. Duration omitted. |
| Walking through Paris with author-artist Jessie Kanelos Weiner | The New Paris Podcast, episode 23; Lindsey Tramuta; 28 June 2018. [Episode listing](https://podcasts.apple.com/us/podcast/episode-23-walking-through-paris/id1225708803?i=1000414812483) and [publisher archive](https://thenewparis.com/episodes.html), 26:03. |
| Carving Paris: How limestone built this city | The Earful Tower; Oliver Gee with Grégory Philippe; 10 March 2025. [Publisher/player](https://sites.libsyn.com/97575/talking-paris-and-its-history-with-a-stonemason). This is the exact episode accompanying the later “How Paris was built” article; the article date is not substituted for the episode date. Duration omitted. |

## Validation

Passed:

- `npm run test:culture-import`: importer tests and unchanged offline review inventory.
- `npm run test:culture`: v1/v2 parsing, invalid audio metadata, source/link validation, playlist integrity, deterministic audio/show search, independent playlist saves and existing recovery/isolation checks.
- `npm run test:paris-discovery`: relationship integrity, playlist neighbors, audio trail path, listened/undo, backup recovery and existing trail tests.
- `npm run smoke`: existing routes plus audio detail routes, filters, selected results, invalid/no-result cases and playlist rendering.
- `npm run test:preservation`: frozen Paris/Rome planning snapshots, catalog hashes, existing storage keys, replay and recovery.
- Production `npm run build`: TypeScript, API checks, runtime imports, Vite and media checks. Existing large-chunk advisory remains; no build errors.
- Public media: 282 images, 40 videos, 1 document; original/WebP preservation and 40 identical audiovisual stream hashes.
- Separate baseline comparison: all pre-existing 21 cultural works and destination records unchanged.

Browser checks on localhost: city-scoped format counts; podcast show search; desktop selected result and browser Back; mobile keyboard selection and return focus; song save and listened status across reload; independent playlist save/removal; atlas listened filtering with zero invented pins; activity undo. Test saves and statuses were removed afterward, restoring the initial empty shelf/activity state. At 390, 768, 1280 and 1600px the hub, playlist and song library have no horizontal overflow. Keyboard focus visibly outlines controls and closing details restores focus to the selected result. Tablet typography and compact list thumbnail clipping found during review were corrected.

The browser briefly reported a connection failure in a stale inspection tab; the local API remained HTTP 200 and a fresh inspection tab restored preview access. No security or network settings were changed.

## Remaining limits and architectural considerations

- Unverified original recording years and durations stay absent. Some selections use identified later archival performances or official uploads rather than an asserted first recording. Provider availability/sign-in/region restrictions can change; no full playback or listening review was performed.
- The playlist is a local editorial selection with individual external links, not a playable Spotify/Apple Music playlist.
- No licensed audio artwork is supplied. Typography is intentional, and existing archive-photo missing-image handling remains. This pass did not inject provider/artwork network failures or perform a full screen-reader audit.
- Reduced-motion rules are present in scoped CSS; native OS reduced-motion and native 200% browser zoom were not exercised in this pass.
- The expanded API contract remains a static validated seed. Future provider imports should model recording editions/identifiers explicitly; they must not collapse composition, performance, album and upload dates.
- Audio detail copy currently targets this Paris release. Before adding audio for other cities, generalize that city context from destination records. Playlist completeness must continue to be checked against the full catalog, not a filtered response.
- Existing recovery/storage mechanisms are reused without migration or changing their keys. No cloud synchronization, passive history or automatic itinerary input was added.

## Workspace delivery

Implementation and production verification used the established non-iCloud copy at `/private/tmp/elsewhere-push-check`, with the existing preview in `/Users/brendan/Library/Caches/copy-my-trip-phase0-check`. All 32 delivery files (15 source/test files, this report and 16 screenshots) were mirrored to both the original iCloud workspace and preview copy, then compared using SHA-256. The final tablet CSS correction is included. The running local API returned schema version 2 with 8 Paris songs, 2 Earful Tower search matches and 1 playlist (HTTP 200).
