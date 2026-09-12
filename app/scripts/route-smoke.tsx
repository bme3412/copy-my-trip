import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TripProvider } from '../src/state/TripContext'
import { routes } from '../src/App'

async function render(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  await new Promise((r) => setTimeout(r, 10))
  const html = renderToString(
    <TripProvider>
      <RouterProvider router={router} />
    </TripProvider>,
  )
  return { html, landed: router.state.location.pathname }
}

async function main() {
  const cases: [string, string][] = [
    ['/paris', 'personal Paris archive'],
    ['/paris/compose', 'Tell me about the trip'],
    // Cold load carries no trip: itinerary pages must refuse to serve the
    // curator's days as if they were composed for this traveler.
    ['/paris/itinerary/1', 'No trip yet'],
    ['/paris/itinerary/1', 'Build it here'],
    ['/paris/itinerary/3', 'No trip yet'],
    ['/paris/archive', 'every trip merged'],
    ['/paris/neighbourhoods', 'The neighborhoods'],
    ['/rome', 'new chapter in the travel collection'],
    ['/rome/compose', 'Tell me about the trip'],
    ['/rome/itinerary/1', 'No trip yet'],
    ['/rome/archive', 'Trastevere'],
    ['/rome/neighbourhoods', 'The neighborhoods'],
  ]
  let fail = 0
  for (const [path, expect] of cases) {
    try {
      const { html } = await render(path)
      const ok = html.includes(expect)
      console.log(`${ok ? 'PASS' : 'FAIL'} ${path}${ok ? '' : ` — missing "${expect}"`}`)
      if (!ok) fail++
    } catch (e) {
      console.log(`ERROR ${path}: ${e}`)
      fail++
    }
  }
  const redirects: [string, string][] = [
    ['/', '/paris'],
    ['/lyon/day/1', '/paris'],
    ['/paris/nope', '/paris'],
    ['/paris/plans', '/paris/compose'],
    // The builder folded into the itinerary; the days became the itinerary.
    ['/paris/build', '/paris/itinerary/1'],
    ['/paris/day/3', '/paris/itinerary/3'],
    ['/rome/build', '/rome/itinerary/1'],
  ]
  for (const [path, expected] of redirects) {
    const { landed } = await render(path)
    const ok = landed === expected
    console.log(`${ok ? 'PASS' : 'FAIL'} redirect ${path} → ${landed}`)
    if (!ok) fail++
  }
  process.exit(fail ? 1 : 0)
}
main()
