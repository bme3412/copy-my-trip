import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TripProvider } from '../src/state/TripContext'
import { routes } from '../src/App'
import { cultureCatalog } from '../src/lib/culture/seed'

// Discovery renders through its real loader; keep offline checks deterministic.
let catalogAvailable = true
globalThis.fetch = async (input) => {
  if (input !== '/api/catalog') throw Error('Unexpected network request in route smoke')
  return catalogAvailable ? Response.json(cultureCatalog) : new Response('unavailable', { status: 503 })
}

async function render(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  await new Promise((r) => setTimeout(r, 10))
  if (!router.state.initialized) await new Promise<void>(resolve => {
    const unsubscribe = router.subscribe(state => { if (state.initialized) { unsubscribe(); resolve() } })
  })
  const html = renderToString(
    <TripProvider>
      <RouterProvider router={router} />
    </TripProvider>,
  )
  const landed = router.state.location.pathname
  router.dispose()
  return { html, landed }
}

async function main() {
  const cases: [string, string][] = [
    ['/discover', 'A deeper connection.'],
    ['/discover/browse', 'Find your next'],
    ['/discover?destination=rome&kind=book', 'Roman Stories'],
    ['/discover?q=lisbon', 'No matches'],
    ['/discover/place/paris', 'Get to know the city'],
    ['/discover/place/paris?place=shakespeare', '/paris/archive?place=shakespeare-co'],
    ['/discover/place/paris?place=absent', '/paris/archive?place=jardin-du-luxembourg'],
    ['/discover/place/rome', 'No firsthand photographs yet'],
    ['/discover/work/roman-stories', 'English edition'],
    ['/discover/work/before-sunset', 'Places in the story'],
    ['/discover/work/before-sunset?place=couleeverte', '/paris/archive?place=coulee-verte'],
    ['/discover/work/before-sunset?place=absent', '/paris/archive?place=shakespeare-co'],
    ['/discover/work/absent', 'This chapter isn’t here'],
    ['/discover/absent', 'This chapter isn’t here'],
    ['/discover/saved', 'Your collection starts'],
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
  for (const [path, selected] of [
    ['/discover?work=cleo-from-5-to-7', true],
    ['/discover?destination=paris&kind=film&work=cleo-from-5-to-7', true],
    ['/discover?work=absent', false],
    ['/discover?destination=rome&work=cleo-from-5-to-7', false],
    ['/discover?q=lisbon&work=cleo-from-5-to-7', false],
  ] as const) {
    const { html } = await render(path)
    const ok = html.includes('aria-label="Cléo from 5 to 7 details"') === selected
    console.log(`${ok ? 'PASS' : 'FAIL'} work selection ${path}`)
    if (!ok) fail++
  }
  for (const [path, present, absent] of [
    ['/discover/browse?destination=paris', 'work=giovannis-room', 'work=roman-stories'],
    ['/discover?destination=rome', 'work=roman-stories', 'work=giovannis-room'],
    ['/discover/place/paris', 'From the travel archive', 'The Intouchables'],
  ]) {
    const { html } = await render(path)
    const ok = html.includes(present) && !html.includes(absent) && !html.includes('Two cities. Different stories.')
    console.log(`${ok ? 'PASS' : 'FAIL'} single-city destination ${path}`)
    if (!ok) fail++
  }
  const library=(await render('/discover/browse')).html;
  const libraryOk=library.includes('work=roman-stories')&&library.includes('work=giovannis-room')&&library.includes('Podcast episodes')&&library.includes('Songs')&&!library.includes('hero-search')&&!library.includes('ew-archive-story');
  console.log(`${libraryOk?'PASS':'FAIL'} all-city library and broader format menu`);if(!libraryOk)fail++;
  const landing = (await render('/discover')).html
  const paris = (await render('/discover/place/paris')).html
  const landingOk = (landing.match(/aria-label="[^"]+ — coming soon"/g) ?? []).length === 13 && landing.includes('/discover/place/rome') && !landing.includes('/discover/place/london')
  const parisOk = !paris.includes('ew-paris-stats') && !paris.includes('Plan a visit') && !paris.includes('Explore Paris ↗')
  console.log(`${landingOk && parisOk ? 'PASS' : 'FAIL'} landing availability and removed Paris hero actions/counts`)
  if (!landingOk || !parisOk) fail++
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
  catalogAvailable = false
  const failedCatalog = await render('/discover')
  const recovered = failedCatalog.html.includes('The collection could not be loaded.') && failedCatalog.html.includes('Continue to trip planning')
  console.log(`${recovered ? 'PASS' : 'FAIL'} catalog failure offers retry and planner escape`)
  if (!recovered) fail++
  process.exit(fail ? 1 : 0)
}
main()
