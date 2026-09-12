import assert from 'node:assert/strict'
import { analyticsPath, redactAnalyticsUrl } from '../src/lib/analytics'

assert.equal(analyticsPath('/paris'), '/paris')
assert.equal(analyticsPath('/rome/compose'), '/rome/compose')
assert.equal(analyticsPath('/paris/saved/plan-private/briefing'), '/paris/saved/:trip/briefing')
assert.equal(analyticsPath('/rome/mail/private-message'), '/rome/mail/:briefing')
assert.equal(analyticsPath('/paris/itinerary/4'), '/paris/itinerary/:day')
assert.equal(analyticsPath('/paris/unrecognized-private-content'), null)
for (const [url, expected] of [
  ['https://copy-my-trip.com/paris/saved?code=private#access_token=private', 'https://copy-my-trip.com/paris/saved'],
  ['https://copy-my-trip.com/paris/saved/plan-private/briefing?date=2026-09-13', 'https://copy-my-trip.com/paris/saved/:trip/briefing'],
  ['https://copy-my-trip.com/rome/mail/private-message?email=someone@example.com', 'https://copy-my-trip.com/rome/mail/:briefing'],
]) {
  assert.deepEqual(redactAnalyticsUrl({type:'pageview',url}), {type:'pageview',url:expected})
}
assert.equal(redactAnalyticsUrl({type:'pageview',url:'not-a-url'}), null)
assert.equal(redactAnalyticsUrl({type:'pageview',url:'https://copy-my-trip.com/account/private'}), null)
console.log('PASS analytics: route grouping and sensitive URL redaction (11 checks)')
