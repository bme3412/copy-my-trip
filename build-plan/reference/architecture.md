> **SUPERSEDED — kept for reference only (moved here 2026-07-21).**
> This document predates the working app in `app/` and proposes a
> Python/FastAPI/Postgres greenfield build that was not adopted. The
> current plan lives in `build-plan/00-current-state.md`,
> `01-principles.md` and `02-roadmap.md`. Ideas here survive only where
> those documents restate them; where they conflict (scoring model,
> fatigue model, stack, phasing), the new documents win. Dated claims
> below (2026 closures, transit works, event dates) were collected in
> mid-2026 and are indexed in `reference/2026-seed-leads.md` — verify
> before reuse.

You should build this as a Paris-specific planning system, not as a generic travel agent. Constrain the first version to:

First-time visitors
Four to seven usable sightseeing days
Paris plus optional Versailles
Roughly 30–40 important places
Roughly 60–100 distinct experiences
Exact travel dates and hotel location
Individual travelers or small groups

That scope is already large enough to produce a serious product.

1. Recommended architecture
Next.js web application
        ↓
FastAPI planning service
        ↓
PostgreSQL + PostGIS
        ↓
────────────────────────────────────
Canonical travel data
Date-specific operating data
Live context snapshots
Traveler and trip data
Generated itineraries
────────────────────────────────────
        ↓
Planning engine
        ↓
Constraint checking
Scoring
Geographic clustering
Scheduling
Simulation
Repair
        ↓
LLM explanation layer

My recommended stack for you:

Layer	Recommendation
Frontend	Next.js + TypeScript
API	FastAPI + Python
Database	PostgreSQL with PostGIS
Validation	Pydantic
ORM	SQLAlchemy
Migrations	Alembic
Background jobs	Scheduled jobs initially; add a queue later
Planning	Python heuristics first; OR-Tools later
Maps	Mapbox, Google Maps or another routing provider
Cache	PostgreSQL initially; Redis only when needed
LLM	Preference extraction and explanation
Hosting	Vercel for frontend; separate Python service if required
Monitoring	Structured logs plus itinerary-generation traces

Do not start with multiple agents. You need one planning pipeline with deterministic stages. An agent can orchestrate those stages later, but it should not invent schedules or opening hours.

2. Split your data into three categories

This separation is critical.

A. Canonical facts

Slow-changing information about a place or experience:

Louvre coordinates
Louvre entrances
Louvre is a major art museum
Typical masterpiece-route duration
Approximate physical load
Relevant interest categories
Nearby neighborhoods
B. Date-specific facts

Information attached to a date or period:

Closed on this particular Tuesday
Late opening on Wednesday
Temporary exhibition
Seasonal garden hours
Special public-holiday schedule
Tickets released 60 days before
C. Live or near-live facts

Information that may change repeatedly:

Ticket availability
Weather forecast
Transit disruption
Temporary gallery closure
Eiffel summit closure
Demonstration or security perimeter

Do not overwrite canonical records with live information. Store live information as timestamped snapshots.

3. Core database structure

Use relational tables for important planning fields. Use JSONB only for source-specific details and rarely queried metadata.

Places

A physical location.

places
------
id
name
slug
place_type
latitude
longitude
neighborhood_id
indoor_outdoor_type
official_url
timezone
active

Examples:

Louvre
Eiffel Tower
Notre-Dame
Place des Vosges
Luxembourg Gardens
Entrances

Large places may have several entrances.

place_entrances
---------------
id
place_id
name
latitude
longitude
entrance_type
accessible
security_required
notes

Possible entrance types:

main
ticket_holder
accessible
group
exit
taxi_dropoff

Routing to the correct entrance is more accurate than routing to the center of the Louvre or Versailles.

Experiences

The actual unit that the planner schedules.

experiences
-----------
id
place_id
name
experience_type
description
minimum_minutes
duration_p50_minutes
duration_p90_minutes

first_timer_score
paris_uniqueness_score
scenic_score
historical_score

physical_load
standing_load
cognitive_load
crowd_load

weather_profile_id
reservation_type
default_start_period
active

Examples:

Louvre masterpieces route
Louvre Egyptian antiquities visit
Louvre exterior and courtyard walk
Eiffel Tower summit
Eiffel Tower second floor
Trocadéro sunrise viewpoint
Montmartre extended neighborhood walk
Sacré-Cœur and viewpoint visit

This is much better than having one record called Eiffel Tower.

Experience tags
experience_tags
---------------
experience_id
tag_id
weight

Tags might include:

major_art_museum
panoramic_view
medieval_history
religious_architecture
impressionism
food_market
neighborhood_walk
formal_garden
night_activity

These support interest matching and duplication penalties.

Operating rules

Recurring schedules.

operating_rules
---------------
id
experience_id
valid_from
valid_until
weekday
open_time
close_time
last_entry_time
reservation_required
Operating exceptions

Overrides for particular dates.

operating_exceptions
--------------------
id
experience_id
date
status
open_time_override
close_time_override
last_entry_override
reason
source_record_id

Possible statuses:

open
closed
partial
unknown

An exception should override the recurring operating rule.

Ticket inventory snapshots
inventory_snapshots
-------------------
id
experience_id
visit_date
slot_start
ticket_type
availability_status
price
remaining_quantity
retrieved_at
source_record_id

Availability states:

available
limited
sold_out
not_yet_released
walk_up_only
unknown
Neighborhoods
neighborhoods
-------------
id
name
latitude
longitude
description
default_visit_minutes
daytime_score
evening_score
food_score
shopping_score
Geographic relationships
experience_relationships
------------------------
from_experience_id
to_experience_id
relationship_type
weight

Possible relationships:

natural_next_stop
same_cluster
good_before
good_after
duplicates
fallback_for
conflicts_with

Example:

Trocadéro viewpoint
    → natural_next_stop → Eiffel Tower

Louvre
    → good_after → Palais-Royal

Eiffel summit
    → duplicates → Arc de Triomphe rooftop
4. Traveler and trip tables
Trips
trips
-----
id
city
arrival_datetime
departure_datetime
hotel_latitude
hotel_longitude
hotel_checkin_datetime
hotel_checkout_datetime
status
created_at

Store arrival and departure as real timestamps. Do not merely store “six days.”

Party members
party_members
-------------
id
trip_id
name
age_group
home_timezone
mobility_profile
walking_capacity
standing_capacity
museum_tolerance
crowd_tolerance
heat_tolerance
schedule_preference
Preferences

Use structured weights.

traveler_preferences
--------------------
party_member_id
preference_key
preference_value
importance
source

Examples:

art = 0.9
food = 0.6
shopping = 0.2
history = 0.8
early_mornings = 0.3
crowds = -0.7

Keep negative preferences. A dislike is not the same as a lack of interest.

Trip-level requests
trip_requests
-------------
id
trip_id
experience_id
request_type
importance
notes

Request types:

must_do
prefer
optional
avoid
hard_avoid
Existing reservations
bookings
--------
id
trip_id
experience_id
start_datetime
end_datetime
booking_status
refundable
changeable
paid_amount
confirmation_reference
locked

Existing reservations become hard constraints unless the traveler permits changes.

5. Day-context model

Generate a context row for every date in the trip.

day_contexts
------------
id
trip_id
date
weekday
sunrise
sunset
golden_hour_start

weather_confidence
temperature_low
temperature_high
rain_probability
wind_speed

public_holiday
school_holiday
citywide_crowd_score
transit_risk_score
event_intensity_score

last_updated_at

Store detailed hourly weather separately:

weather_hourly
--------------
date_time
temperature
feels_like
rain_probability
rain_intensity
wind_speed
visibility
cloud_cover
source_record_id

This lets the engine schedule Montmartre in the dry morning and move the museum into a rainy afternoon.

6. Keep source provenance

Every operating hour, closure, ticket state or disruption should be traceable.

source_records
--------------
id
source_type
source_name
source_url
retrieved_at
effective_from
effective_until
confidence
raw_payload
content_hash

Then connect extracted facts to their sources.

fact_provenance
---------------
id
entity_type
entity_id
field_name
source_record_id
verification_status
confidence

Verification statuses:

confirmed
likely
inferred
conflicting
stale
unknown
Important rule

Never let an LLM directly update canonical facts.

The LLM may extract:

{
  "candidate_close_time": "21:00",
  "candidate_last_entry": "20:00",
  "confidence": 0.86
}

Your ingestion system should then validate the format, compare it with current records and either approve it automatically under strict rules or flag it for review.

7. Planning pipeline

Your generation endpoint should run a clear sequence.

1. Normalize trip data
2. Calculate usable sightseeing windows
3. Build date contexts
4. Generate visit opportunities
5. Remove impossible opportunities
6. Score the remaining opportunities
7. Select trip-level anchors
8. Cluster opportunities geographically
9. Schedule each day
10. Add meals, transitions and flexible blocks
11. Simulate delays and overruns
12. Repair weak plans
13. Generate explanations
Step 1: Calculate usable time

For each date, produce something like:

{
  "date": "2026-09-23",
  "usable_start": "09:00",
  "usable_end": "22:00",
  "day_type": "full_day",
  "starting_location": "hotel",
  "ending_location": "hotel",
  "starting_fatigue": 0.1
}

Arrival day might instead be:

{
  "usable_start": "14:00",
  "usable_end": "20:30",
  "day_type": "arrival_day",
  "starting_fatigue": 0.65,
  "maximum_fixed_bookings": 0
}
Step 2: Generate visit opportunities

For every experience and every relevant day:

Is it open?
Are tickets released?
Is there an acceptable slot?
Does it fit the weather?
Can the traveler physically do it?
Can the party reach it on time?

The output might be:

{
  "experience_id": "louvre_masterpieces",
  "date": "2026-09-23",
  "allowed_start_windows": [
    ["09:00", "09:30"],
    ["18:00", "18:30"]
  ],
  "duration_p50": 165,
  "duration_p90": 225,
  "availability": "available",
  "candidate_score": 0.91
}
Step 3: Hard filtering

Remove candidates that violate:

Closure
No inventory
Hard traveler avoid
Accessibility incompatibility
Impossible transfer
Reservation conflict
Arrival or departure constraints

Do this in normal Python logic before involving an LLM.

Step 4: Score candidates

Start with an interpretable scoring model:

score = (
    0.24 * traveler_interest_fit
    + 0.18 * first_timer_value
    + 0.14 * paris_uniqueness
    + 0.12 * date_specific_value
    + 0.10 * geographic_fit
    + 0.08 * weather_fit
    + 0.07 * evening_or_scenic_value
    + 0.07 * group_satisfaction
    - 0.10 * fatigue_cost
    - 0.08 * crowd_cost
    - 0.08 * duplication_cost
    - 0.06 * booking_risk
)

Keep the weights in configuration rather than burying them inside application code.

planner_weights:
  traveler_interest_fit: 0.24
  first_timer_value: 0.18
  paris_uniqueness: 0.14
  date_specific_value: 0.12
Step 5: Select trip-level anchors

Before planning individual days, enforce coverage.

For a first-time five-day trip, requirements might be:

required_coverage:
  iconic_monument: 1
  major_art_museum: 1
  historic_center: 1
  left_bank: 1
  neighborhood_walk: 2
  paris_evening: 2
  seine_experience: 1

maximums:
  major_museums: 2
  consecutive_high_load_days: 2
  major_viewpoints: 2

minimums:
  flexible_minutes_per_full_day: 90
  neighborhood_only_blocks: 2

Without trip-level constraints, a high art score might accidentally produce four museums.

8. Scheduling strategy

Do not begin with a complicated mathematical optimizer.

Version 1: Heuristic and beam search

For each day:

Select one primary anchor.
Find geographically compatible secondary experiences.
Add a scenic transition.
Insert lunch or rest.
Add an evening payoff.
Evaluate the complete day.
Keep the best several candidate days.

Generate several possible trips, not just one greedy solution.

candidate_plans = [empty_plan]

for anchor in selected_anchors:
    expanded_plans = []

    for plan in candidate_plans:
        for valid_slot in possible_slots(anchor, plan):
            expanded_plans.append(
                add_anchor_and_fill_nearby(plan, anchor, valid_slot)
            )

    candidate_plans = top_k(expanded_plans, k=20)

best_plan = max(candidate_plans, key=trip_score)

This is understandable, debuggable and probably enough for a Paris MVP.

Version 2: Constraint solver

Once the heuristic works, introduce OR-Tools CP-SAT for:

Assigning experiences to dates
Selecting start windows
Respecting opening hours
Enforcing booking conflicts
Enforcing daily load limits
Enforcing trip-level coverage
Minimizing cross-city transfers

You may still use heuristics to generate candidate opportunities before sending the reduced problem to the solver.

9. Route calculation

Do not store every possible route permanently.

Use a route adapter:

class RouteProvider(Protocol):
    async def get_routes(
        self,
        origin: Coordinate,
        destination: Coordinate,
        departure_time: datetime,
        accessibility: AccessibilityProfile,
    ) -> list[RouteOption]:
        ...

Cache route results:

route_cache
-----------
origin_geohash
destination_geohash
departure_bucket
travel_mode
accessibility_profile
duration_p50
duration_p90
walking_minutes
transfers
stairs_estimate
expires_at

Use time buckets such as:

weekday morning
weekday midday
weekday evening
weekend morning
weekend evening

For live itinerary repair, fetch a fresh route rather than relying on the cache.

10. Fatigue and daily budgets

Give every day a budget.

Example for a moderate traveler:

{
  "walking_minutes_max": 180,
  "standing_load_max": 2.2,
  "cognitive_load_max": 2.1,
  "crowd_load_max": 2.0,
  "major_anchors_max": 1,
  "timed_reservations_max": 2,
  "cross_city_transfers_max": 1
}

Then update fatigue sequentially.

fatigue = starting_fatigue

for block in day.blocks:
    fatigue += block.physical_load * 0.25
    fatigue += block.standing_load * 0.20
    fatigue += block.cognitive_load * 0.15
    fatigue += block.crowd_load * 0.15

    if block.block_type in {"cafe", "park", "cruise", "hotel_rest"}:
        fatigue -= block.recovery_value

    fatigue = max(0, min(fatigue, 1))

Use fatigue to lower the expected value of later blocks.

An excellent attraction at 8:00 p.m. has little value if the probability of the traveler skipping it is 60%.

11. Itinerary storage

Never overwrite an itinerary. Store versions.

itinerary_versions
------------------
id
trip_id
version_number
status
generation_reason
trip_score
robustness_score
created_at

Generation reasons:

initial
user_edit
weather_repair
transit_repair
venue_closure
fatigue_adjustment
Blocks
itinerary_blocks
----------------
id
itinerary_version_id
date
start_datetime
end_datetime
block_type
experience_id
location_id
locked
optional
flexible
estimated_cost
explanation

Block types:

experience
meal
travel
rest
flex
hotel
arrival
departure
Block alternatives
block_alternatives
------------------
block_id
alternative_experience_id
replacement_score
replacement_reason
same_area
booking_required
12. Live repair system

The repair engine should accept a specific disruption.

{
  "trip_id": "trip_123",
  "current_time": "2026-09-23T11:35:00+02:00",
  "event": {
    "type": "BLOCK_OVERRUN",
    "block_id": "louvre_visit",
    "minutes": 55
  }
}

It should then:

Freeze completed activities.
Preserve locked reservations.
Recalculate travel feasibility.
Drop or shorten low-priority optional blocks.
Check alternatives in the same area.
Return the smallest reasonable change.

Repair actions:

SHORTEN
DROP
SWAP
MOVE
REPLACE
INSERT_BREAK
CHANGE_ROUTE

Do not regenerate the whole vacation unless necessary.

Repair scoring
repair_score = (
    remaining_trip_value
    - missed_booking_cost
    - number_of_changed_blocks * 0.15
    - added_transit_cost
    - traveler_confusion_cost
)
13. The role of the LLM

Use the LLM for four narrow jobs.

Preference extraction

Input:

We love food and walking around neighborhoods. My wife likes Impressionism, but I can only tolerate museums for about two hours.

Output:

{
  "interests": {
    "food": 0.9,
    "neighborhoods": 0.9,
    "impressionism": 0.7
  },
  "constraints": {
    "major_museum_tolerance_minutes": 120
  },
  "party_conflicts": [
    {
      "category": "museum_interest",
      "severity": "moderate"
    }
  ]
}

Validate this through Pydantic.

Experience classification

Use the LLM to propose tags and descriptions for editorial review.

Explanation

Convert structured reasons into useful prose:

Orsay is placed on Thursday evening because it matches your interest in Impressionism, has a later opening, and avoids putting it immediately after the Louvre.

Conversational modifications

User:

Make Wednesday less museum-heavy.

The LLM converts that into:

{
  "operation": "ADJUST_DAY",
  "date": "2026-09-23",
  "constraint_updates": {
    "major_museums_max": 0,
    "neighborhood_weight_delta": 0.25
  }
}

Then the deterministic planner regenerates that day.

The LLM should not respond by independently improvising a new timetable.

14. API design

A practical initial API:

POST /trips
GET  /trips/{trip_id}
PATCH /trips/{trip_id}

POST /trips/{trip_id}/members
POST /trips/{trip_id}/preferences
POST /trips/{trip_id}/bookings

POST /trips/{trip_id}/generate
GET  /trips/{trip_id}/itineraries/current

POST /trips/{trip_id}/modify
POST /trips/{trip_id}/repair
POST /trips/{trip_id}/feedback

GET /experiences/search
GET /experiences/{id}
GET /experiences/{id}/opportunities?date=2026-09-23

GET /trips/{trip_id}/day-context/{date}
Generate request
{
  "mode": "balanced",
  "preserve_bookings": true,
  "number_of_options": 3
}
Generate response
{
  "recommended": {
    "itinerary_id": "itin_1",
    "trip_score": 0.89,
    "robustness_score": 0.91
  },
  "alternatives": [
    {
      "itinerary_id": "itin_2",
      "label": "More neighborhoods"
    },
    {
      "itinerary_id": "itin_3",
      "label": "More art and history"
    }
  ]
}
15. Suggested repository layout
paris-planner/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── trip-intake/
│       │   ├── itinerary/
│       │   ├── map/
│       │   └── live-day/
│       └── lib/
│
├── services/
│   └── planner-api/
│       ├── app/
│       │   ├── api/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── repositories/
│       │   ├── planner/
│       │   │   ├── opportunity_generator.py
│       │   │   ├── constraints.py
│       │   │   ├── scoring.py
│       │   │   ├── clustering.py
│       │   │   ├── scheduler.py
│       │   │   ├── fatigue.py
│       │   │   ├── simulation.py
│       │   │   └── repair.py
│       │   ├── providers/
│       │   │   ├── weather.py
│       │   │   ├── transit.py
│       │   │   ├── routing.py
│       │   │   ├── events.py
│       │   │   └── inventory.py
│       │   ├── ingestion/
│       │   └── llm/
│       └── tests/
│
├── packages/
│   ├── shared-types/
│   └── planner-config/
│
├── data/
│   ├── seed/
│   ├── fixtures/
│   └── evaluation-cases/
│
├── database/
│   ├── migrations/
│   └── seed/
│
└── docs/
    ├── data-dictionary.md
    ├── scoring-model.md
    ├── source-policy.md
    └── planner-decisions.md
16. Frontend flow
Screen 1: Trip facts

Collect:

Dates
Arrival and departure
Hotel
Party members
Existing bookings
Screen 2: Priorities

Avoid asking users to score 30 sliders.

Ask tradeoff questions:

Louvre or a neighborhood food walk?
Versailles or another day in Paris?
Early starts or late evenings?
More planned or more flexible?
Major sights or quieter discoveries?

Derive the detailed weights behind the scenes.

Screen 3: Must-do and avoid

Use searchable cards:

Must do
Interested
No preference
Avoid
Screen 4: Proposed trip style

Show a short interpretation:

Your trip will emphasize:
• neighborhoods and food
• one major art museum
• relaxed mornings
• two strong evening experiences

It will avoid:
• consecutive museum-heavy days
• early nonrefundable bookings
• more than one major cross-city transfer daily

Let the user correct this before generating.

Screen 5: Itinerary

Each block should show:

Why it is recommended
Duration range
Booking requirement
Expected walking
Weather sensitivity
Alternative
Confidence

The user should be able to say:

Replace this
Move this
Make the day slower
Give me a rain alternative
Keep this locked
17. Data ingestion strategy

Start with manual curation.

Initial seed dataset

Manually build:

30–40 places
60–100 experiences
Operating rules
Approximate durations
Load scores
Interest tags
Geographic relationships
Fallback relationships
First-timer scores

This curated dataset is the product foundation. Do not begin by scraping thousands of attractions.

Then add adapters

Create an interface for each source category:

class DataSourceAdapter(Protocol):
    async def fetch(self, context: FetchContext) -> list[RawRecord]:
        ...

    def normalize(self, record: RawRecord) -> list[CandidateFact]:
        ...

Adapters might cover:

Official venue information
City events
Weather
Transit status
Routing
Ticket inventory
Public amenities

All adapters should produce normalized candidates rather than directly modifying production tables.

Ingestion pipeline
FETCH
→ STORE RAW RECORD
→ PARSE
→ NORMALIZE
→ VALIDATE
→ COMPARE WITH EXISTING FACT
→ ACCEPT OR FLAG
→ UPDATE PROVENANCE
18. Refresh schedule

Use different refresh policies.

Data	Refresh approach
Coordinates	Manual or very infrequent
Experience metadata	Manual review
Normal opening hours	Periodically
Date-specific closures	More often near trip
Events	Daily or periodically
Weather	Only once forecast becomes meaningful
Ticket availability	Frequently near booking and trip dates
Transit disruptions	Fresh check on travel day
Live venue status	Fresh check before the block

You do not need live data for a trip nine months away. Represent it as unknown and schedule a future refresh.

19. Evaluation system

Create fixed scenario fixtures before optimizing the planner.

Example fixtures
Four-day first-time couple
Five-day art lover
Six-day family with children
Seven-day older travelers
Wheelchair traveler
Overnight arrival from Boston
Trip beginning Monday
Louvre sold out
Heavy rain for two days
Extreme heat
Versailles transport disruption
Mixed-interest couple
Traveler refuses advance reservations

For every fixture, assert:

No closed attraction scheduled
No impossible transfer
No reservation conflict
No more than specified daily load
Required coverage achieved
Adequate flexible time
No luggage rule violation
Quality metrics
Hard-constraint violation rate
Priority coverage
Geographic coherence
Daily travel time
Reservation miss probability
Daily fatigue peak
Experience duplication
Unstructured time
Fallback coverage
Plan stability after disruption
Simulation

Run each itinerary through randomized delays:

Late hotel departure
Longer security line
Transit delay
Visit overrun
Meal overrun
Reduced walking speed

A plan should fail evaluation when it works only under perfect conditions.

20. Build order
Phase 1: Static planning core

Build:

Database schema
Curated Paris experiences
Traveler intake
Hard constraints
Scoring
Geographic clustering
Four-to-seven-day itinerary generation
Explanations

Use manually maintained schedules and no live data.

The output should already be better than a generic LLM itinerary.

Phase 2: Exact-date intelligence

Add:

Weekday-aware operating rules
Date exceptions
Sunrise and sunset
Seasonal schedules
Special events
Ticket-release logic
Phase 3: Robustness

Add:

Duration distributions
Transfer distributions
Fatigue
Daily load limits
Simulation
Reliability scoring
Phase 4: Live context

Add:

Weather
Transit disruptions
Live ticket status
Temporary venue notices
Phase 5: Repair

Add:

Morning recheck
Midday itinerary repair
Same-area fallbacks
Weather swaps
Fatigue adjustments
Phase 6: Learning

Add:

Daily user feedback
Observed pace
Observed museum tolerance
Preference updates
Better future-day recommendations
Phase 7: Expansion

Only after Paris works:

Second-time Paris visitors
Additional day trips
London
Rome
Barcelona
Other city types
21. Your first implementation backlog

I would start with these tickets:

Create the repository and FastAPI/Postgres foundation.
Define Pydantic models for Place, Experience, Trip, VisitOpportunity and ItineraryBlock.
Create migrations for the core tables.
Seed 15 major Paris places and 30 experiences.
Implement recurring opening rules and date exceptions.
Build usable-day calculation for arrival, full and departure days.
Implement hard-constraint filtering.
Implement interest and first-timer scoring.
Implement geographic clustering using PostGIS distance.
Implement anchor-first daily scheduling.
Add trip-level coverage requirements.
Store itinerary versions and blocks.
Build a simple itinerary UI.
Generate structured explanations.
Add 10 evaluation fixtures.
Expand to 30–40 places only after those fixtures pass.

Your first useful version does not need weather, transit APIs, agents or real-time repair. It needs to reliably answer:

Given these travelers, dates, hotel, must-dos and known operating schedules, what is the best executable four-to-seven-day first-time Paris itinerary?

Get that right before adding the moving parts.

22. The most important architecture decisions

Keep these principles fixed:

Experiences, not attractions, are scheduled.
Hard constraints are code, not prompt instructions.
The LLM interprets and explains; it does not control feasibility.
Every changing fact has a source and timestamp.
Unknown is a legitimate data state.
Itineraries are versioned.
Repairs minimize disruption.
Trip quality is measured across the entire trip, not one day at a time.
A robust itinerary beats a maximally dense itinerary.
Start with curated depth in Paris rather than shallow global coverage.

That setup gives you a clean path from a strong static itinerary planner to a date-aware, self-repairing Paris decision engine.