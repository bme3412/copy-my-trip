# Traveler email formatting

12 September 2026

The notification subject now uses “Tomorrow in Paris · Sunday, September 13” when every included segment is for the same destination and service date. Mixed destinations and carry-over dates retain a generic itinerary subject, with each destination's actual date and timezone visible. Notification-window selection remains unchanged; the user's delivery timezone is explained briefly in the footer.

The email has a single main heading, destination-local times, a derived stop count/day span/travel summary, numbered stops, clear directions links, and a prominent exact-briefing link. Photos and captions are retained. Short source labels stay with each stop, while complete archive provenance and technical identifiers move to Trip notes. HTML emphasis is escaped before rendering; plain text removes emphasis delimiters. Booking warnings, return legs, weather availability, demo status, and full overnight accepted times remain explicit. No model rewrites or schedule mutations are involved.

`npm --prefix app run preview:email` writes a synthetic HTML/text example under `app/node_modules/.tmp/email-preview/`. It never accesses a mail provider or database. Browser verified desktop and 390 px mobile layout, image loading, emphasis, and no horizontal overflow. Existing delivered messages retain their original email body; future renders use this formatting.

Validation: 11 mail checks, 16 companion checks, 7 weather/mail checks, production TypeScript/build and API runtime validation. No additional live emails were sent or authorized by this template change.
