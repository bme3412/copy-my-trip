# 03 — Cultural data architecture

All entities and endpoints in this document are proposed. No migration was created or applied. Use additive `ew_` Postgres tables and runtime-validated TypeScript contracts under future `app/src/lib/culture/`. Keep the planner's City JSON and snapshot formats separate.

## Model: normalized core with typed extensions

Use UUID internal IDs, stable slugs/redirect aliases, schema/revision fields and explicit lifecycle status (`draft`, `review`, `published`, `withdrawn`). Provider IDs are alternate identifiers, never primary ownership keys. Store date precision (year/month/day/unknown) rather than fabricating January 1 for a year-only publication date. Publication date and story setting are separate attributes.

| Entity | Required contract and constraints |
|---|---|
| `ew_works` | id, kind, canonical_title, original_language?, original_release_date?, release_precision, editorial_description?, status, revision; kind initially book/film, extensible through reviewed migrations |
| `ew_work_titles` | work_id, title, language?, title_kind (original/translation/alternate), source_claim_id; aliases participate in entity resolution |
| `ew_agents` / `ew_work_credits` | Person or organization, names/external IDs; work_id, agent_id, role (author/director/translator/narrator/performer), order; artists are agents, not fake songs |
| `ew_book_details` | work_id FK, fiction_class, original_publication; edition/language is not the work's identity |
| `ew_editions` | work_id, format (print/ebook/audiobook), language, publisher, date precision, ISBNs, narrator credits, abridged flag, external IDs; different audiobook productions remain distinct |
| `ew_screen_details` | work_id, runtime?, production_countries, original_language; movie/series/episode constraints |
| `ew_work_relations` | subject_work_id, object_work_id, predicate (adaptation_of/inspired_by/response_to/editorial_pairing), explanation and claim ID; editorial similarity is not an asserted historical influence |
| `ew_work_parts` | parent_work_id, child_work_id, relation (episode_of/track_of/essay_in), season/number/order; enforce allowed kinds and acyclic containment |
| `ew_audio_details` | duration?, explicit_content?, feed/GUID for podcast episodes, recording/release-group distinctions for music; implement when media is activated |
| `ew_external_ids` | entity registry FK, namespace, external_id, observed_at, source; unique namespace+ID and audited merge aliases |
| `ew_availability` | work/edition, provider, territory, format, URL, checked_at, expires_at, rights policy; availability is volatile and never implied by a metadata match |
| `ew_themes`, `ew_theme_aliases` | stable cross-media taxonomy, definition, broader-theme relations, language aliases; maintain cycle checks |
| `ew_work_themes` | work/theme, salience, explanation, claim ID, review state; mood/atmosphere is a separate controlled facet, not a fact copied from a model score |
| `ew_setting_periods` | work, start/end year bounds, precision, historical/contemporary/ambiguous classification, claim ID; can contain multiple periods |
| `ew_geo_entities` | kind country/city/neighborhood/place/institution, names, parent/containment edges, coordinates/bounds with provenance, slug; allow multiple containment claims where boundaries overlap |
| `ew_planner_place_links` | geo_entity, city_id, place_id, optional experience_id, catalog release, reviewed status; validator checks actual registry membership |
| `ew_work_geo_relations` | work, geo_entity, relationship type, scope, explanation, claim ID, review state; one work can have several qualified relationships |
| `ew_immersion_reviews` | work, destination, classification, rationale, claim IDs, reviewer, review status and version |

For safe polymorphic references, introduce `ew_entities(id, entity_type)` as a registry; each work/agent/geo/collection/asset table has a one-to-one FK and a constrained type. Collection item and external-ID references point to this registry, not unchecked `(type,id)` strings. Invariants must be enforced in transactions/triggers or validated RPCs, not only in TypeScript. A creator can itself be saved through this registry without conflating creator and work.

Media-specific fields belong in typed extension tables as implemented; avoid an unbounded “metadata JSON” dumping ground. Bounded provider payloads, when retention is allowed, live in private source records. Support essays via the common work/title/credit/relation contract; add issue/publication fields only when used. Model song composition, recording and release separately when music launches; do not merge them solely by title. Launch only book/film UI while reserving the parent/edition abstractions needed later.

## Geographic semantics

Allowed relationship types: `primarily_set_in`, `partially_set_in`, `mentions`, `about`, `filmed_at`, `created_in`, `institution_association`, `thematic_connection`. Require a scope/qualifier: work-wide, chapter, scene, episode or unknown. These predicates are not interchangeable. A production country is not a setting; an author's birthplace is not a work's setting; proximity of a photograph is not evidence of filming.

Never propagate a city-level setting down to every neighborhood. A neighborhood can roll up to a city for candidate retrieval, but the UI must preserve the original relation and granularity (“a sequence in this neighborhood”). Institutional association needs a role such as exhibition subject, premiere venue or collection holding. Fictional places are explicitly fictional and cannot become planner candidates.

Immersion is per work/destination: `inhabit_city`, `plot_set_there`, `ambiguous`, `unknown`. Store explanation, supporting evidence IDs, uncertainty reason, reviewer identity/type and pending/approved/rejected state. Do not treat this as a model probability threshold or derive it from the number of place mentions. A modern publication can portray an ancient city; setting filters use setting periods, not release year. “Contemporary” must be an editable interpretation with explicit year range, not a hidden permanent definition.

## Evidence, rights and claim lifecycle

`ew_sources`: provider/URL, retrieved_at, content version or permitted hash, attribution text, rights policy ID, allowed storage/embedding/display scope, expiry and deletion requirements. Public evidence presents a safe citation/short permitted excerpt; full source payloads remain private or are not retained at all if prohibited.

`ew_claims`: subject, predicate, typed value/object, source references, source location (page/chapter/timecode/section), support status, uncertainty, contradiction group, generated_by/model version, reviewer, reviewed_at, supersedes, publication status. `ew_claim_evidence` links multiple independent sources and distinguishes supporting from contradicting evidence. Confidence is descriptive, not permission to publish. Retain rejected proposals for audit under a bounded private retention policy; remove restricted content on license expiry, including derived search documents/embeddings and caches.

Publication rules:

1. Canonical IDs/title/date may auto-verify only through an approved deterministic provider adapter with permitted rights, unambiguous ID match and no conflict. Missing fields remain unknown.
2. Geographic setting/filming, immersion, themes and interpretive descriptions require curator approval for MVP, with evidence attached. Automated agreement alone is insufficient.
3. Firsthand experience and recommendation always require an explicit curator decision scoped to the activity. Models cannot grant either status.
4. Conflicting consequential claims remain withheld or displayed as uncertain with both sources; retrieval must not silently choose the higher model confidence.
5. Public projection includes only permitted published attributes; review data and raw metadata cannot be exposed by SELECT * or a client bundle.

Enrichment flow: resolve candidate → link IDs using edition/type/language/date/creator discriminators → retrieve only permitted fields → store allowed source receipts → propose atomic claims → detect duplicates/conflicts/expiry → validate proposal against frozen entity revision → review exact before/after diff → publish in a transaction → rebuild only affected search documents → record audit and invalidation. Repeat processing is idempotent by provider ID/source version/enrichment version; a stale proposal gets 409 and requires a fresh review.

Reuse `scripts/review/core.ts` concepts: atomic sourceIds, frozen snapshots, beforeJson/afterJson, claim verdicts, pending/accepted/rejected decisions and proposal hashes. Reuse private run storage and attempt/cost provenance as patterns. Its existing seven-field whitelist and Paris-specific snapshot are not a general catalog editor; implement a new culture adapter rather than widening the old validator until it accepts arbitrary data. Existing automated verification has `reviewOrigin` and is not independent human truth. Existing review acceptance never publishes; add a distinct authenticated publication command later with validation and audit.

## Provider assessment

Official sources checked during this audit; these are engineering selection constraints, not a blanket commercial clearance. Exact negotiated limits and quotes remain launch gates. Covers, posters, text excerpts, audio and photographs need rights separate from bibliographic facts.

| Domain/provider | Access, coverage and freshness | Rights, limits, persistence and cost | Decision |
|---|---|---|---|
| Books: Open Library | Public works/editions APIs; community completeness varies by language/edition; monthly dumps for bulk | Identified use 3 req/s, unidentified 1; encourages cache, rejects use as high-traffic commercial backend. Licensing page does not warrant rights to every contribution. No metered price stated; contact for commercial scale | Small human-driven resolution pilot; IDs/factual fields, own editorial prose; separately clear images. [API](https://openlibrary.org/developers/api), [licensing](https://openlibrary.org/developers/licensing) |
| Books: Google Books | Volume search and identifiers, useful supplement; not literary-geography evidence | API/project quotas and content-specific terms; do not assume permanent mirror or embedding rights. Exact quota/caching eligibility must be checked for selected fields/account | Optional live lookup adapter, not canonical ingestion default. [overview](https://developers.google.com/books/docs/overview), [API terms](https://developers.google.com/terms) |
| Film/TV: TMDB | API key; films, series, episodes and credits; community updates, no SLA | Noncommercial access free with attribution; commercial arrangement via sales. Logo/notice required; roughly 40 req/s upper protection can change. Persistent fields/image rights require contract check; price not publicly established here | Preferred candidate after commercial clearance; film commissions/official production sources supply filming evidence. [FAQ](https://developer.themoviedb.org/docs/faq), [limits](https://developer.themoviedb.org/docs/rate-limiting) |
| Podcasts: Listen Notes | Search of shows/episodes; freshness depends on feed ingestion | FREE/PRO prohibit server caching/indexing except IDs/publication dates; attribution required. Enterprise storage terms/price require quote; quota plan-specific | Do not use standard plans as a stored/embedded discovery corpus. [terms](https://www.listennotes.com/api/terms/) |
| Podcasts: Podcast Index + publisher RSS | API discovery and show/episode feed IDs; feed polling can reflect publisher updates | API terms and limits must be agreed; a public feed is not a license to retain/transcribe audio or embed all text. Price/production quota not confirmed here; attribution and publisher permission recorded per feed | Later pilot using publisher-approved descriptions and links; no blanket transcript ingestion. [API docs](https://podcastindex-org.github.io/docs-api/), [terms](https://github.com/Podcastindex-org/legal/blob/main/TermsOfService.md) |
| Music: MusicBrainz | Artist/work/recording/release identities; community updates and variable completeness | Core data CC0; supplementary data has noncommercial/share-alike restrictions. API meaningful User-Agent, 1 req/s; commercial service arrangements separate from data license; cost by agreement | Use cleared core identity data, own cultural annotation; keep supplementary tags out until licensed. [license](https://musicbrainz.org/doc/About/Data_License), [API](https://musicbrainz.org/doc/MusicBrainz_API) |
| Music: Spotify | Playback/deep-link destination and live availability candidate; app access restrictions | Policy prohibits ingesting Spotify content into ML/AI models; temporary caching/attribution restrictions and access approval apply | Not the embedding/enrichment corpus; links only initially. [policy](https://developer.spotify.com/policy), [AI guidance](https://developer.spotify.com/documentation/web-api/tutorials/building-with-ai) |
| Cross-media/geography/institutions: Wikidata | Stable QIDs, multilingual entities, structured links; community completeness, no evidence guarantee | Structured data CC0; linked media and prose have separate licenses. Public endpoints are shared resources, not an SLA; use bounded entity fetches/dumps, backoff | Good ID backbone; validate consequential relationships separately. [license](https://www.wikidata.org/wiki/Wikidata:Licensing), [access](https://www.wikidata.org/wiki/Help:Data_access) |
| Places: OSM/Nominatim | Geocoding and geographic candidates; community updates, variable institution detail | Public Nominatim max 1 req/s, identification/attribution and usage-policy constraints; no client autocomplete/bulk launch architecture. OSM data license obligations apply. Hosted commercial/self-host options add cost | Bounded editorial lookup or contracted provider later; current curated coordinates remain primary. [policy](https://operations.osmfoundation.org/policies/nominatim/) |
| Places: Google Places | Rich operating/business metadata; request-based live freshness | Storage restricted except allowed exceptions such as place IDs; map display policies conflict with treating results as freely reusable Mapbox data. Costs depend on SKU/fields, not estimated here | Avoid canonical geo dependency; no map-stack migration for this. [policy](https://developers.google.com/maps/documentation/places/web-service/policies) |
| Cultural institutions/film commissions/publishers | Official collection, event, location and publication pages; uneven APIs | Terms vary; no universal quota/cost/cache permission. Link citations and write original annotations; do not copy full essays | Preferred claim evidence with source-specific policy review; manually curate MVP |

Refresh proposal (our policy, not a provider SLA): identity metadata every 90 days or on correction; editorial relationships on source change; availability at most daily where licensed, with visible checked-at and expiry; episode feeds according to publisher guidance. Honor stricter provider limits and conditional requests. Before enabling an adapter, populate a policy record with allowed fields, retention, attribution, embedding permission, quota, approved monthly spend and deletion procedure. An unknown permission defaults to no stored payload/embedding, not inferred consent.

## Retrieval and personal library

Normalize taxonomy first: themes such as expatriate life, reinvention, urban loneliness, friendship, social mobility, architecture, technology/power, immigration, cultural identity and everyday city life need definitions and counterexamples. Keep multilingual aliases separate from concepts. Add embeddings only over permitted published editorial text and claims; record text hash, model/version/dimension and rights-policy version. Do not embed private archive GPS or provider-restricted text.

Start Postgres full-text/title/alias retrieval with structured filters. When golden tests justify it, combine lexical and vector candidates with reciprocal-rank fusion, then deterministic filters/dedup/diversity and explicit-interest reranking. Store explanation claim IDs, not a model's ungrounded rationale. Creator/edition/remake distinctions survive dedup; consumed exclusions default to work-level, with edition exceptions explicitly chosen by user. A private user-state table stores consumed/hidden/interested with updated_at, and RLS. Avoid a hidden behavioral profile at MVP.
