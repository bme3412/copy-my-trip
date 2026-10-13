import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TripProvider } from '../src/state/TripContext'
import { routes } from '../src/App'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { parisArchiveItems, archivePlace, archiveDay } from '../src/lib/paris-archive'
import { PARIS } from '../src/cities/paris'
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
  assert.equal(new Set(parisArchiveItems.map(item => item.id)).size, parisArchiveItems.length)
  assert(parisArchiveItems.some(item => item.video) && parisArchiveItems.some(item => !item.video))
  for (const item of parisArchiveItems) {
    assert(PARIS.media[item.place.id]?.plates?.some(plate => plate.id === item.id), 'gallery excludes research-only images')
    for (const file of [item.image, item.video].filter(Boolean)) assert(existsSync(`public/media/paris/${file}`), 'mapped media must exist')
  }
  assert(new Set(parisArchiveItems.slice(0, 12).map(item => item.place.id)).size > 6, 'opening gallery explores different places')
  assert.equal(archivePlace('shakespeare-co')?.id, 'shakespeare')
  assert.equal(archiveDay('shakespeare'), 2)
  console.log('PASS archive media inventory, distinct places, legacy place links and day links')
  const cases: [string, string][] = [
    ['/discover', 'A deeper connection.'],
    ['/discover/browse', 'Find your next'],
    ['/discover?destination=rome&kind=book', 'Roman Stories'],
    ['/discover?q=lisbon', 'No matches'],
    ['/discover/place/paris', 'A city of stories.'],
    ['/discover/place/paris?place=shakespeare', '/discover/place/paris/places/shakespeare'],
    ['/discover/place/paris?place=absent', 'Editor’s picks'],
    ['/discover/place/paris/places/shakespeare', 'George Whitman'],
    ['/discover/place/paris/places/seine', 'broad river setting'],
    ['/discover/place/paris/places/unknown', 'This connection is unavailable'],
    ['/discover/place/paris/people/james-baldwin', 'Giovanni’s Room'],
    ['/discover/place/paris/themes/literary-paris', 'Editorial connection'],
    ['/discover/place/paris/stories', 'One place. Another perspective.'],
    ['/discover/place/paris/stories/two-bookshops', 'Le Mistral'],
    ['/discover/place/paris/collections', 'A few ways into the city.'],
    ['/discover/place/paris/collections/literary-paris', 'Inside this collection'],
    ['/discover/place/paris/trails?path=work:before-sunset,place:shakespeare,person:james-baldwin', 'Where next?'],
    ['/discover/place/paris/trails?path=work:before-sunset,person:james-baldwin', 'unavailable connection'],
    ['/discover/place/paris/atlas', 'Your Paris atlas.'],
    ['/discover/work/before-sunset?node=place:shakespeare', 'Connections from'],
    ['/discover/work/before-sunset?node=absent', 'That connection is unavailable'],
    ['/discover/place/paris?q=nomatch&type=person', 'Editor’s picks'],
    ['/discover/place/rome', 'No firsthand photographs yet'],
    ['/discover/work/roman-stories', 'English edition'],
    ['/discover/work/before-sunset', 'Places in the story'],
    ['/discover/work/before-sunset?place=couleeverte', '/discover/place/paris/places/couleeverte'],
    ['/discover/work/before-sunset?place=absent', '/discover/place/paris/places/shakespeare'],
    ['/discover/work/paris-playlist', 'Tracks'],
    ['/discover/work/la-seine', 'https://www.youtube.com/watch?v=vlPZLE2g0Kc'],
    ['/discover/work/walking-through-paris', 'Jessie Kanelos Weiner'],
    ['/discover/work/carving-paris', '2025-03-10'],
    ['/discover/work/call-my-agent', 'Fanny Herrero'],
    ['/discover/work/the-painter-of-modern-life', 'Charles Baudelaire'],
    ['/discover/work/the-belly-of-paris', 'Émile Zola'],
    ['/discover/browse?destination=paris&area=greater_paris&kind=film', 'work=full-time'],
    ['/discover/place/paris/collections/the-seine', 'Inside this collection'],
    ['/discover/browse?destination=paris&kind=song', 'work=la-seine'],
    ['/discover/browse?destination=paris&kind=podcast_episode', 'work=carving-paris'],
    ['/discover/browse?destination=rome&kind=song', 'No matches'],
    ['/discover/browse?q=earful&destination=paris', 'work=an-intro-to-jazz-in-paris'],
    ['/discover/browse?destination=paris&kind=song&work=la-seine', 'Mark as listened to'],
    ['/discover/place/paris/trails?path=work:paris-playlist,work:la-seine,place:seine', 'Where next?'],
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
    ['/paris/archive', 'our lens.'],
    ['/paris/archive?view=map', 'Find your way around'],
    ['/paris/archive?photo=absent', 'That photograph is unavailable'],
    ['/paris/archive?hood=absent', 'No items in this selection'],
    ['/paris/archive?place=shakespeare-co', 'our lens.'],
    ['/paris/archive?photo=vosges-1', 'Archive detail'],
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
    ['/discover/place/paris', 'Featured playlist', 'The Intouchables'],
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
  for (const href of new Set([...paris.matchAll(/href="(\/[^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')))) {
    const {html}=await render(href);
    assert(!html.includes('This chapter isn’t here.')&&!html.includes('This connection is unavailable.')&&!html.includes('A little pause in the journey.'),`Broken overview link: ${href}`);
  }
  console.log('PASS all overview sidebar, shortcut, work, place, person, collection, map and trail destinations');
  for(const path of ['/discover/browse','/discover/work/call-my-agent','/discover/place/paris/atlas','/paris/archive','/paris/itinerary/1'])assert(!(await render(path)).html.includes('po-sidebar'));
  console.log('PASS Paris shell isolation');
  const landingOk = (landing.match(/aria-label="[^"]+ — coming soon"/g) ?? []).length === 13 && landing.includes('/discover/place/rome') && !landing.includes('/discover/place/london')
  const parisOk = !paris.includes('ew-paris-stats') && !paris.includes('Plan a visit') && !paris.includes('Explore Paris ↗') && !['Find your starting point', 'Or be surprised', 'A title, creator, person or idea', 'Matches titles, names, creators'].some(text => paris.includes(text))
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
