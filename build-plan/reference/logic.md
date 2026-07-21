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

The biggest conceptual upgrade is this:

Do not model “the Louvre” as one attraction. Model specific visit opportunities.

“The Louvre” is a place. These are different opportunities:

Louvre Wednesday from 6:00–8:30 p.m.
Louvre Saturday at 11:00 a.m.
Louvre on a rainy morning
Louvre immediately after an overnight flight
Louvre with two art lovers
Louvre with children who tolerate museums for 75 minutes
Louvre when the Egyptian galleries are the traveler’s priority
Louvre courtyard at blue hour without entering the museum

The correct unit of planning is therefore:

PLACE
+ EXPERIENCE
+ DATE
+ TIME WINDOW
+ TRAVELER STATE
+ AVAILABILITY
+ CONDITIONS
= VISIT OPPORTUNITY

That gives you the granularity needed for serious date-specific planning.

1. Build the system around four object types
Place

A physical location:

Musée du Louvre
Eiffel Tower
Place des Vosges
Rue des Abbesses
Luxembourg Gardens
Experience

Something the traveler can actually do there:

Louvre masterpieces route
Louvre Egyptian antiquities route
Louvre architecture-only exterior walk
Eiffel Tower summit visit
Eiffel Tower second-floor visit
Trocadéro sunrise viewpoint
Eiffel sparkle viewed from Pont de Bir-Hakeim
Montmartre residential streets walk
Montmartre Sacré-Cœur-only visit
Visit opportunity

A dated and timed instance:

{
  "experience_id": "louvre_masterpieces",
  "date": "2026-09-23",
  "start_window": ["18:00", "18:30"],
  "latest_finish": "20:30",
  "admission_state": "tickets_available",
  "weather_fit": 0.95,
  "crowd_estimate": "medium",
  "duration_p50_minutes": 150,
  "duration_p90_minutes": 210,
  "traveler_fit": 0.88
}
Itinerary block

The final scheduled unit:

{
  "start": "2026-09-23T18:00:00+02:00",
  "end": "2026-09-23T20:30:00+02:00",
  "experience_id": "louvre_masterpieces",
  "reservation_id": "optional-reference",
  "arrival_buffer_minutes": 25,
  "fallback_experience_ids": [
    "palais_royal_evening_walk",
    "covered_passages_route"
  ]
}

This separation matters because the same place can support many experiences with different durations, weather sensitivities and traveler fits.

2. Use a layered data model

Your system needs more than a POI table. I would organize the data into eleven layers.

Layer	Main question answered
Traveler	Who is taking the trip?
Party	How do the travelers interact as a group?
Trip	What time is genuinely available?
Place	Where can something happen?
Experience	What can the traveler do there?
Calendar	Is it possible on this particular date?
Inventory	Can it actually be booked?
Mobility	How difficult is it to get there?
Environment	What will conditions probably be?
Operations	Are there closures, disruptions or exceptions?
Provenance	How trustworthy and current is the information?

The mistake would be putting everything into one giant attractions table. Hours, experiences, ticket inventory, disruptions and traveler-specific suitability all change at different speeds and should be stored separately.

3. Make the traveler profile much more granular

Interest scores alone are not enough. Two travelers can both score art 5/5 while having completely different ideal itineraries.

Identity and trip circumstances
first_visit_to_paris
previous_visits_to_europe
home_timezone
arrival_transport
arrival_time
overnight_flight
expected_sleep_on_flight
hotel_check_in_time
hotel_bag_drop_available
departure_time
departure_transport
trip_before_paris
trip_after_paris

A traveler arriving from Boston at 7:00 a.m. should not be treated like someone arriving by train from Lyon at noon.

Pace and physical capacity
self_reported_pace
comfortable_daily_steps
maximum_daily_steps
comfortable_continuous_walk_minutes
comfortable_standing_minutes
stairs_tolerance
hill_tolerance
cobblestone_tolerance
rest_frequency
morning_energy
afternoon_energy
evening_energy

Do not treat walking distance as the entire physical burden. Three miles through a museum can be harder than five miles through neighborhoods because of standing, visual concentration and limited seating.

Cultural tolerance
major_museum_tolerance_minutes
small_museum_tolerance_minutes
church_interest
palace_interest
historical_detail_preference
guided_tour_preference
audio_guide_preference
reading_label_preference
art_period_preferences
Sensory and crowd profile
crowd_tolerance
queue_tolerance
noise_tolerance
sensory_overload_risk
tight_space_tolerance
height_tolerance
elevator_tolerance
late_night_crowd_tolerance
Food behavior
breakfast_style
lunch_importance
dinner_importance
meal_duration_preference
restaurant_reservation_tolerance
dietary_restrictions
food_budget
fine_dining_interest
market_interest
pastry_interest
wine_interest
willingness_to_wait_for_food
preferred_meal_times
Planning behavior
schedule_density_preference
reservation_tolerance
fear_of_missing_out
spontaneity_preference
decision_fatigue
navigation_confidence
public_transport_confidence
willingness_to_split_from_group
Practical needs
wheelchair
walker
stroller
infant
nap_schedule
bathroom_frequency
hearing_needs
vision_needs
service_animal
medication_schedule
heat_sensitivity
cold_sensitivity
rain_tolerance

These variables should affect route feasibility, not merely change a descriptive sentence at the end.

4. Model the travel party, not just individual travelers

Group travel introduces a separate optimization problem.

For each party, store:

party_size
relationship_type
shared_budget
pace_mismatch
interest_overlap
must_stay_together
split_plan_allowed
decision_maker
children_ages
adults_to_children_ratio

Then classify preferences:

UNANIMOUS_MUST_DO
MAJORITY_PRIORITY
ONE_PERSON_PRIORITY
OPTIONAL
ACTIVE_DISLIKE
HARD_AVOID

A place one traveler rates 5/5 and another rates 1/5 should not receive an average score of 3. That hides conflict.

Instead, calculate:

group_value
minimum_individual_satisfaction
preference_variance
split_plan_opportunity
conflict_cost

For example, on a six-day trip:

Two travelers visit the Musée d’Orsay.
One traveler visits shopping or a photography walk.
The group reunites for lunch in Saint-Germain.

Your engine should support that rather than forcing every person through every attraction.

5. Distinguish hard constraints from preferences

This is essential.

Hard constraints

A candidate is invalid when:

venue is closed
ticket is unavailable
traveler cannot physically access it
visit conflicts with another reservation
required transfer is impossible
traveler has explicitly refused it
party cannot arrive before last admission
activity violates an age restriction
activity requires prohibited luggage

The Louvre, for example, is normally closed Tuesdays, while the Musée d’Orsay and Versailles are normally closed Mondays. The Louvre also has different closing and last-entry times, so “open that day” is not sufficient.

Soft constraints

These make something worse but not impossible:

more crowded than ideal
less convenient geographically
poor weather fit
too many museums consecutively
slightly above budget
requires an early start
increases fatigue
duplicates another experience
Contextual constraints

These become hard only under certain conditions:

Eiffel summit + severe wind
outdoor market + heavy rain
Montmartre stairs + stroller
Versailles gardens + extreme heat
late dinner + young child
Seine cruise + unusually high or low river conditions

The Eiffel Tower explicitly notes that summit access can be restricted during severe weather or busy periods, and it publishes date-specific exceptional closures rather than relying only on recurring weekly hours.

6. Create a date-context object for every trip day

Each calendar date should have its own context record.

{
  "date": "2026-09-23",
  "weekday": "Wednesday",
  "season": "early_autumn",
  "sunrise": "07:37",
  "sunset": "19:45",
  "golden_hour_start": "18:58",
  "public_holiday": false,
  "school_holiday": false,
  "major_events": [],
  "protest_risk": "unknown",
  "weather_confidence": "low",
  "temperature_range_c": [13, 21],
  "rain_probability": null,
  "transit_disruptions": [],
  "attraction_exceptions": [],
  "citywide_crowd_index": 0.61
}
Date-sensitive inputs

The date layer should include:

weekday
public holiday
school holiday
bridge weekend
major conference
fashion week
major sporting event
concert
festival
demonstration
marathon or road race
state ceremony
museum late opening
museum free-admission event
temporary exhibition
night opening
seasonal garden program
fountain operation
sunset
civil twilight
weather
transit maintenance
labor action
road closure
security perimeter

Paris’s official tourism office maintains updated event calendars, while the City of Paris publishes a structured “Que Faire à Paris?” events dataset that can provide date, venue, accessibility and category information.

7. A concrete date-customization example

Suppose a visitor is in Paris from Saturday, September 19 through Thursday, September 24, 2026.

The date engine should notice:

September 19–20 coincides with the 2026 European Heritage Days.
Monday is problematic for Orsay and Versailles.
Tuesday is problematic for the Louvre.
Wednesday offers the Louvre’s later closing pattern.
Thursday offers the Musée d’Orsay’s late opening.

That might produce:

Saturday:
Heritage Days opportunity + historic central Paris
Avoid rigid afternoon bookings because special access may create queues

Sunday:
Second Heritage Days opportunity
Neighborhood-focused evening

Monday:
Louvre + Palais-Royal
Do not recommend Orsay or Versailles

Tuesday:
Versailles or Orsay
Do not recommend Louvre

Wednesday:
Montmartre during the day
Louvre evening visit if inventory exists

Thursday:
Marais or Eiffel area
Orsay late visit

A generic “Day 1 Louvre, Day 2 Eiffel, Day 3 Versailles” template would completely miss this.

The date engine should not automatically insert a special event merely because it exists. It should calculate:

event_interest_fit
event_uniqueness
expected_crowding
reservation_requirements
displacement_cost
normal_attraction_availability

An unusual building opening for one weekend may be extraordinary for an architecture lover and irrelevant to a food-oriented visitor.

8. Do not rely on recurring hours alone

You need at least four operating-calendar tables.

Base operating schedule
Mondays: 09:00–18:00
Tuesdays: closed
Wednesdays: 09:00–21:00
...
Seasonal schedule
valid_from
valid_until
high_season_hours
low_season_hours
garden_hours
fountain_hours
night_opening_period
Date-specific exceptions
exception_date
exception_type
new_open_time
new_close_time
reason
affected_components
Real-time operating state
currently_open
temporarily_closed
partial_closure
entrance_closed
elevator_closed
summit_closed
gallery_closed
last_verified_at

This is not theoretical. In 2026, the Eiffel Tower lists an exceptional July 13 closure instead of July 14. The Louvre has also warned that high heat can cause some galleries to close because not all spaces are air-conditioned. A static opening-hours database would miss both cases.

Also model components separately:

Versailles Palace
Versailles Gardens
Trianon Estate
Park
Gallery of Coaches

They do not necessarily have identical hours or access rules.

9. Separate availability from opening hours

A venue can be open but effectively unavailable.

Use an inventory state:

AVAILABLE
LIMITED
SOLD_OUT
NOT_YET_RELEASED
WALK_UP_ONLY
WAITLIST
UNKNOWN
NOT_APPLICABLE

Store:

ticket_release_date
release_rule
remaining_slots
slot_interval
ticket_type
ticket_price
age_category
refund_policy
change_policy
named_ticket
identification_required
purchase_deadline
official_or_reseller

For example, Eiffel Tower elevator tickets are generally released 60 days ahead, while second-floor stair tickets have a different window. Same-day availability can still appear, so “sold out now” should not necessarily mean “permanently impossible.”

The planner needs separate logic for:

venue is open
ticket booking has opened
desired slot is available
acceptable alternative slot is available
walk-up visit is plausible
10. Model visit duration as a distribution

Do not store:

Louvre duration = 180 minutes

Store:

{
  "minimum_minutes": 90,
  "p25_minutes": 120,
  "p50_minutes": 165,
  "p75_minutes": 210,
  "p90_minutes": 270,
  "exit_overhead_minutes": 15
}

Then modify the distribution using:

traveler_interest
party_size
children
crowds
temporary exhibition
guided tour
mobility
museum fatigue
arrival punctuality
coat check
security

The same applies to transfers:

hotel_to_louvre:
  p50 = 24 minutes
  p90 = 39 minutes

Build itineraries using something closer to p75 or p90, not only the average.

A plan that works only when every event finishes at its median duration is fragile.

11. Measure more than geographical distance

Routing should account for generalized effort:

door_to_door_minutes
walking_minutes
walking_distance
stairs
incline
cobblestones
station_complexity
number_of_transfers
transfer_walking
elevator_dependency
expected_wait
crowding
navigation_difficulty
weather_exposure

A useful cost function:

route_cost =
    travel_minutes
  + transfer_penalty
  + stairs_penalty
  + weather_exposure_penalty
  + navigation_penalty
  + accessibility_penalty
  + reliability_penalty

This allows two 25-minute journeys to score differently.

Add entrance-level coordinates

Do not route merely to the centroid of a museum or park.

Store:

main entrance
accessible entrance
group entrance
ticket-holder entrance
security checkpoint
exit
nearest practical station exit
taxi drop-off

For large sites, the difference between arriving at the property boundary and arriving at the usable entrance can be substantial.

12. Make transport date-sensitive

Create a route edge for:

origin
destination
departure_time
mode
expected_duration
duration_distribution
accessibility
service_status
valid_from
valid_until

Possible route states:

NORMAL
MINOR_DISRUPTION
MAJOR_DISRUPTION
PARTIAL_CLOSURE
CLOSED
REPLACEMENT_BUS
ELEVATOR_OUT
UNKNOWN

Île-de-France Mobilités’ PRIM platform provides official mobility datasets and APIs, including real-time traffic information messages by line or transport mode.

A strong example is Versailles: its official site currently warns of a temporary RER C closure from July 15 to August 22, 2026 and recommends alternative Transilien routes. Your route engine needs to read date-specific operational notices, not assume that the standard Versailles route always works.

13. Add an environmental suitability model

Weather should not be represented by a single daily icon.

Store hourly:

temperature
feels_like_temperature
rain_probability
rain_intensity
rain_duration
wind_speed
wind_gust
cloud_cover
visibility
UV
heat_warning
storm_warning

Météo-France supplies localized forecasts, hourly conditions, short-term rain information and official weather warnings.

Then give every experience a weather response curve.

{
  "experience_id": "montmartre_extended_walk",
  "weather_fit": {
    "clear_mild": 1.0,
    "light_rain": 0.7,
    "heavy_rain": 0.2,
    "extreme_heat": 0.35,
    "high_wind": 0.75
  }
}

Do not classify an experience as only indoor or outdoor.

The Louvre, for example, includes:

outdoor approach
security queue
indoor galleries
courtyard
possible walk through the Tuileries

Likewise, Versailles is a mixed experience with palace interiors, exposed gardens and significant walking.

14. Add a heat-management layer

This is becoming increasingly important.

Store:

shade_score
air_conditioning_confidence
water_access
indoor_queue_exposure
outdoor_queue_exposure
seating_availability
cooling_locations_nearby
night_opening_available

Paris publishes open data for drinking fountains, cooling locations and green spaces considered useful during hot weather. It also publishes opening-status information for some cooling spaces and parks.

Heat logic might say:

IF feels_like_temperature > traveler_heat_threshold:
    move exposed scenic walk to morning
    move major indoor attraction to afternoon
    shorten continuous outdoor blocks
    add water-stop waypoint
    add cooling break
    avoid long exposed queues

Do not merely tell the traveler to “bring water.” Change the itinerary.

15. Model practical amenities as route constraints

Useful amenity datasets include:

public toilets
accessible toilets
baby-changing facilities
drinking fountains
benches
parks
pharmacies
luggage storage
covered passages
indoor cafés
cooling spaces

The City of Paris publishes geolocated public-toilet data with fields including hours and accessibility, as well as drinking-water data.

These become highly relevant for:

families
older travelers
pregnancy
medical conditions
hot-weather visits
long neighborhood walks
travelers carrying luggage

An amenity should be routable:

nearest_open_toilet_along_route
maximum_detour_minutes
open_at_expected_arrival
accessible
baby_change_available
confidence
16. Add a luggage and possessions layer

Store per attraction:

maximum_bag_size
luggage_allowed
coat_check
locker_available
locker_dimensions
stroller_allowed
tripod_allowed
food_allowed
water_allowed
umbrella_rules

And per traveler block:

has_luggage
luggage_size
hotel_storage_confirmed
shopping_bags_expected
camera_equipment
stroller

This catches scenarios such as:

Hotel checkout at 11:00
Eiffel Tower at 13:00
Train at 18:00
Traveler plans to carry a suitcase

The Eiffel Tower prohibits large luggage and does not provide left-luggage storage, so the itinerary should fail validation unless baggage storage has been solved.

17. Score experiential duplication

Geographic variety is not enough. Experiences can be redundant even when geographically separate.

Create tags such as:

major_art_museum
panoramic_view
royal_history
religious_architecture
formal_garden
bohemian_neighborhood
luxury_shopping
river_experience
impressionism
medieval_history

Then calculate saturation:

museum_saturation
viewpoint_saturation
church_saturation
palace_saturation
shopping_saturation

Examples:

Eiffel summit + Arc de Triomphe rooftop + Montparnasse Tower may be excessive.
Louvre + Orsay + Orangerie on three consecutive days may be excessive.
Sainte-Chapelle + Notre-Dame + Saint-Sulpice + Sacré-Cœur may be ideal for an architecture traveler but repetitive for someone else.

Use diminishing marginal value:

first panoramic view: 1.00
second panoramic view: 0.70
third panoramic view: 0.35

The multiplier can remain high for a photographer or architecture enthusiast.

18. Score transitions, not only attractions

Paris experiences often come from the connection between places.

Model scenic route segments:

Pont Neuf → Louvre courtyard
Notre-Dame → Saint-Germain via the river
Trocadéro → Eiffel Tower
Arc de Triomphe → Parc Monceau
Place des Vosges → Rue des Rosiers
Abbesses → Sacré-Cœur through residential streets

Each transition can have:

scenic_value
historical_value
shopping_value
food_value
traffic_stress
weather_exposure
night_safety
photography_value

Then the engine can choose a slightly longer route because the walk itself is part of the experience.

This avoids producing itineraries that are technically efficient but emotionally flat.

19. Give every day a narrative structure

A good day is not merely a collection of high-scoring blocks.

Use a day grammar:

ORIENTATION
→ ANCHOR
→ RELEASE
→ NEIGHBORHOOD IMMERSION
→ REST
→ EVENING PAYOFF

For example:

Trocadéro introduction
→ Eiffel Tower
→ Rue Cler lunch
→ Rodin gardens
→ hotel rest
→ Seine at blue hour

Track:

opening_strength
midday_intensity
afternoon_release
evening_payoff
narrative_coherence

Do not schedule the emotional climax at 9:00 a.m. and then fill the rest of the day with weaker leftovers unless there is a practical reason.

20. Add trip-level coverage requirements

The optimizer should understand the entire trip, not optimize each day independently.

For a first visit, define coverage dimensions:

iconic_monuments
historic_paris
major_art
neighborhood_life
left_bank
right_bank
seine
park_or_garden
food_experience
evening_paris
unstructured_time

An example target matrix:

Full days	Core coverage
4	One major museum, historic center, Eiffel/Seine, Montmartre, Marais or Left Bank, two strong evenings
5	Four-day core plus second art or deeper neighborhood day
6	Five-day core plus Versailles or thematic Paris day
7	Six-day core plus flexible local day, second theme or recovery capacity

Also create caps:

maximum major museums per trip segment
maximum consecutive high-load days
maximum distant day trips
minimum unstructured minutes
minimum neighborhood-only blocks
minimum evening experiences
21. Build a real fatigue model

Track several kinds of load separately:

physical_load
standing_load
cognitive_load
crowd_load
navigation_load
decision_load
social_load

A possible fatigue state:

fatigue_start_of_day
fatigue_added
recovery_from_breaks
fatigue_end_of_day
next_day_carryover

Example load profiles:

Louvre:
  physical 0.65
  standing 0.85
  cognitive 0.90
  crowd 0.80

Seine cruise:
  physical 0.10
  standing 0.10
  cognitive 0.25
  crowd 0.40

Montmartre walk:
  physical 0.80
  standing 0.50
  cognitive 0.30
  crowd 0.65

Then avoid:

Louvre
→ Versailles
→ all-day walking tour

unless the traveler explicitly wants a highly intensive trip.

22. Use probabilistic buffers

Instead of a fixed 15-minute buffer, calculate:

security_buffer
navigation_buffer
transit_variance_buffer
queue_buffer
bathroom_buffer
group_buffer
weather_buffer

Then estimate:

probability_of_arriving_on_time

For a timed ticket, you might require:

minimum_on_time_probability = 0.90

For a flexible café stop:

minimum_on_time_probability = 0.60

The system should prefer:

85% of the theoretical maximum itinerary value
with 93% feasibility

over:

100% theoretical value
with 58% feasibility

That is the difference between itinerary generation and itinerary fantasy.

23. Run itinerary simulations

For each proposed itinerary, run hundreds or thousands of simulated days.

Randomize:

attraction duration
security wait
meal duration
walking speed
transit delay
departure lateness
weather
energy reduction

Measure:

reservation_miss_probability
average daily overtime
probability of skipping final activity
expected fatigue
worst-day fatigue
expected unused time
fallback usage probability

Reject plans with high failure rates.

Pseudo-logic:

for simulation in range(1000):
    current_time = day.start

    for block in day.blocks:
        travel_time = sample(block.travel_distribution)
        visit_time = sample(block.duration_distribution)

        current_time += travel_time

        if current_time > block.latest_arrival:
            record_missed_block(block)
            apply_repair_policy()

        current_time += visit_time
        update_fatigue()

calculate_plan_robustness()
24. Build explicit fallbacks

Every important block should have fallbacks at three levels.

Same-area fallback
Rodin Museum unavailable
→ Invalides
→ Rue Cler and Champ de Mars
Same-experience-type fallback
Eiffel summit closed
→ second floor
→ Arc de Triomphe view
→ Trocadéro exterior experience
Opposite-weather fallback
Montmartre walk in heavy rain
→ covered passages
→ smaller museum
→ department-store architecture

Store fallback compatibility:

same_geography
same_interest
same_duration
same_budget
no_new_booking_required
weather_compatible

The best fallback is usually not the “next highest-rated attraction.” It is the option that creates the least disruption to the remaining day.

25. Create a live itinerary-repair engine

At 7:00 a.m. each day, rebuild the context:

weather
transit
venue notices
ticket status
traveler-reported energy
actual hotel departure

At each checkpoint:

Did traveler leave on time?
Did the previous visit overrun?
Is the next reservation still feasible?
Has the weather changed?
Has the traveler skipped lunch?
Has fatigue exceeded threshold?

Repair actions:

SHORTEN_CURRENT
DROP_OPTIONAL
SWAP_BLOCKS
MOVE_TO_ANOTHER_DAY
REPLACE_WITH_FALLBACK
CHANGE_TRANSPORT_MODE
INSERT_BREAK
END_DAY_EARLY

Preserve locked items:

paid nonrefundable reservation
traveler must-do
special event available only today
departure requirement

The engine should minimize plan disruption, not recompute a theoretically perfect trip from scratch every time something changes.

repair_score =
    remaining_experience_value
  - change_cost
  - lost_booking_cost
  - traveler_confusion_cost
  - extra_travel_cost
26. Add arrival-day and departure-day logic

These are special day types.

Arrival day variables
scheduled_arrival
historical delay risk
customs duration
airport transfer
bag drop
check-in
overnight flight
sleep estimate
jet lag
meal need
shower need

Arrival-day rules:

No expensive nonrefundable reservation immediately after arrival
No high-cognitive museum after severe sleep loss
Keep activities near hotel
Prioritize daylight and walking
Provide easy abort path
Departure day variables
checkout
bag storage
airport or station
required arrival time
transfer reliability
tax refund needs
security risk

Departure-day rules:

Stay geographically aligned with departure route
Avoid remote attraction
Avoid nonrefundable late block
Add luggage retrieval time
Add hotel-to-station transition

“Four days in Paris” should be calculated from usable blocks, not from the difference between hotel dates.

27. Add edge-case rules by category
Calendar
Trip occurs entirely Monday–Tuesday
Major must-do closed on available day
Public holiday changes hours
One-off private event closes venue
Temporary exhibition causes unusual demand
Seasonal area not operating
Ticketing
Tickets not yet released
Official tickets sold out but walk-up exists
Only reseller inventory remains
Group ticket requires names
Child ticket category differs
Slot available but incompatible with previous booking
Weather
Extreme heat
Thunderstorm during viewpoint block
Wind closes summit
Continuous rain
Snow or ice
Poor visibility makes viewpoint low value
Transport
Metro line closure
RER maintenance
Elevator outage
Strike
Demonstration
Road closure
Tour de France or marathon route
Late-night service reduction
Physical access
Wheelchair user
Temporary lift failure
Stroller
Cane
Older traveler
Traveler cannot stand in security queue
Montmartre incline
Cobblestone route

Paris has expanded designated accessibility routes in multiple districts, and city data includes accessibility-related route information that can help support specialized planning.

Group behavior
One traveler sleeps late
Children require naps
Teenager dislikes museums
Couple wants one special dinner
Group wants to split temporarily
Travelers have incompatible budgets
Food
Restaurant closed Sunday or Monday
Kitchen closes between services
Traveler eats earlier than local reservation availability
Food allergy
Long tasting menu conflicts with evening plan
No lunch opportunity near attraction
Behavioral
Traveler chronically runs late
Traveler overestimates walking ability
Traveler refuses advance bookings
Traveler changes interests after first day
Traveler wants to revisit a favorite neighborhood
28. Add confidence and provenance to every important field

Never store a value without recording where it came from.

{
  "field": "close_time",
  "value": "21:00",
  "source_type": "official_venue",
  "source_url_reference": "internal-source-id",
  "retrieved_at": "2026-07-21T20:00:00Z",
  "effective_date": "2026-09-23",
  "confidence": 0.98,
  "verification_status": "confirmed",
  "expires_at": "2026-09-22T20:00:00Z"
}

Source hierarchy:

1. Official attraction or operator
2. City or regional government source
3. Official tourism office
4. Reputable commercial provider
5. Curated internal research
6. User report
7. Model inference

Do not allow model inference to silently overwrite official data.

Use field-specific freshness rules
coordinates: refresh rarely
base descriptions: refresh every few months
regular hours: refresh weekly
date exceptions: refresh daily near trip
ticket inventory: refresh frequently
weather: refresh several times daily near trip
transit disruptions: near real time
restaurant opening status: refresh close to visit

Use explicit unknown states:

CONFIRMED
LIKELY
INFERRED
CONFLICTING
STALE
UNKNOWN

“Unknown” is better than fabricated precision.

29. Keep recommendation explanations traceable

For every recommended block, generate structured reasons:

{
  "experience": "Musee d'Orsay Thursday evening",
  "reasons": [
    "Matches strong Impressionism interest",
    "Thursday late opening",
    "Rain forecast during this period",
    "Located near afternoon Saint-Germain route",
    "Avoids placing two major museums on consecutive mornings"
  ],
  "tradeoffs": [
    "Later dinner",
    "Moderate museum fatigue"
  ],
  "confidence": 0.91
}

This gives the user meaningful control:

Replace because too crowded
Replace because too expensive
Make day slower
Keep the museum but change the time
Prioritize neighborhoods
Avoid early mornings

Those responses should update structured preference fields, not merely be appended to a chat transcript.

30. Use an optimizer, not an LLM alone

A sensible architecture:

DATA INGESTION
    ↓
NORMALIZATION
    ↓
DATE-CONTEXT GENERATION
    ↓
VISIT-OPPORTUNITY GENERATION
    ↓
HARD-CONSTRAINT FILTERING
    ↓
ROUTE AND FATIGUE SCORING
    ↓
CONSTRAINT OPTIMIZER
    ↓
ROBUSTNESS SIMULATION
    ↓
LLM EXPLANATION AND PRESENTATION
    ↓
LIVE REPAIR

The LLM is good for:

interpreting traveler preferences
extracting constraints from conversation
explaining recommendations
suggesting thematic connections
summarizing tradeoffs

A deterministic solver should handle:

opening hours
time windows
reservation conflicts
travel times
daily limits
hard accessibility constraints
trip-wide coverage

You could use:

Constraint programming
Mixed-integer optimization
A beam-search itinerary generator
A heuristic search followed by simulation

The LLM should not be trusted to perform all scheduling arithmetic in prose.

31. A better scoring model

At the visit-opportunity level:

opportunity_value =
    personal_interest_fit
  + first_timer_value
  + paris_uniqueness
  + date_specific_bonus
  + temporary_event_bonus
  + scenic_value
  + narrative_value
  + geographic_fit
  + weather_fit
  - crowd_cost
  - monetary_cost
  - fatigue_cost
  - booking_risk
  - transit_cost
  - duplication_cost

At the trip level:

trip_score =
    sum(opportunity_values)
  + category_coverage
  + neighborhood_diversity
  + day_narrative_quality
  + evening_quality
  + schedule_robustness
  + flexibility
  - cumulative_fatigue
  - missed_priority_penalty
  - excessive_structure_penalty
  - failure_probability

Treat some value as nonlinear:

Zero major Paris icons on a first trip:
large penalty

First major museum:
high value

Fourth major museum:
low incremental value

First unstructured neighborhood block:
high value

Fourth observation deck:
negative value for most travelers
32. Add user-learning after each day

Ask for very low-friction feedback:

Too busy
About right
Too slow

Loved:
museum / neighborhood / food / views / history

Energy now:
low / medium / high

Then update:

observed_walking_capacity
observed_museum_tolerance
observed_start-time behavior
actual_meal duration
crowd sensitivity
neighborhood preference

This allows the seventh day to reflect what the traveler actually discovered rather than what they predicted before arriving.

For example:

Initial preference:
Museums 5/5, neighborhoods 3/5

Observed:
Traveler leaves Louvre after 90 minutes
Spends four hours in Marais
Revisits Saint-Germain voluntarily

Updated preference:
Museums 3.5/5, neighborhoods 4.8/5
33. The most useful database test

A field belongs in the system when it can affect at least one of:

FEASIBILITY
RANKING
TIMING
ROUTING
FALLBACK SELECTION
EXPLANATION

Do not collect data simply because it is interesting.

For example:

Year a building was completed

may be useful content, but it probably belongs in the editorial layer.

Last admission
Stair count
Ticket release date
Partial closure
Shade
Accessible entrance

belongs in the planning layer because it can change the actual itinerary.

The core design principle

The robust version of this product is not:

“Here are the best attractions for five days in Paris.”

It is:

“Given these travelers, these exact dates, this hotel, current availability, operating exceptions, weather, mobility conditions and uncertainty, what is the highest-value trip that is realistically executable—and how should it repair itself when reality changes?”

That is the logic layer that turns a generic itinerary generator into a serious travel-planning system.