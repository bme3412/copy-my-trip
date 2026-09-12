import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { itineraryLegs, walkingGroups, walkingGeometry } from '../src/lib/map-route'
import { responsiveImage } from '../src/lib/responsive-media'
import variants from '../src/media/variants.json'
import type { City } from '../src/cities/types'
import type { DayState } from '../src/lib/planner'

async function run() {
  const home = { name: 'Home', lat: 48.85, lon: 2.35 }
  const city = { places: [{ id: 'a', lat: 48.86, lon: 2.36 }, { id: 'b', lat: 48.87, lon: 2.37 }] } as City
  const day = { committed: [{ id: 'a', travelMode: 'metro', returnAfter: { mode: 'walk', to: home } }, { id: 'b', travelMode: 'walk' }] } as DayState
  const before = JSON.stringify(day)
  const legs = itineraryLegs(city, home, day)
  assert.equal(legs.length, 3)
  assert.deepEqual(legs[2].coordinates[0], [home.lon, home.lat], 'stop after return starts at home')
  assert.deepEqual(walkingGroups(legs), [[[2.36, 48.86], [2.35, 48.85], [2.37, 48.87]]], 'metro never sent to walking routing')
  const longWalk = walkingGroups(Array.from({ length: 60 }, (_, i) => ({ mode: 'walk' as const, coordinates: [[i, 0], [i+1, 0]] as [number, number][] })))
  assert(longWalk.every(group => group.length <= 25))
  assert.deepEqual(longWalk[0].at(-1), longWalk[1][0], 'split groups join without dropping a leg')
  assert.equal(JSON.stringify(day), before, 'map must not mutate saved timing or stops')
  const nativeFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = (async () => { requests++; return new Response(JSON.stringify({ code: 'Ok', routes: [{geometry: { coordinates: [[2.35, 48.85], [2.36, 48.86]] }}] })) }) as typeof fetch
  const coords: [number,number][] = [[2.35,48.85],[2.36,48.86]]
  await walkingGeometry(coords,'test',new AbortController().signal)
  await walkingGeometry(coords,'test',new AbortController().signal)
  assert.equal(requests,1,'returning to a route uses the cache')
  globalThis.fetch = (async () => new Response(JSON.stringify({ code: 'NoRoute', routes: [] }))) as typeof fetch
  await assert.rejects(() => walkingGeometry([[0,0],[1,1]],'test',new AbortController().signal))
  globalThis.fetch = nativeFetch
  let originals = 0, largest = 0
  for (const [name, image] of Object.entries(variants)) {
    const responsive = responsiveImage(`/media/${name}`)
    assert(responsive?.srcSet.includes('320w'))
    assert.equal(responsiveImage(`https://cdn.example.com/media/${name}`)?.src, responsive?.src)
    for (const variant of image.variants) {
      assert(existsSync(`public${variant.path}`), 'every generated image exists')
      assert.equal(statSync(`public${variant.path}`).size, variant.bytes)
    }
    originals += statSync(`public/media/${name}`).size
    largest += image.variants.at(-1)!.bytes
  }
  assert.equal(responsiveImage('/media/paris/missing.jpg'), null)
  assert.equal(responsiveImage(undefined), null)
  console.log(`PASS route returns, transit separation, request limits, cache, failure fallback, and ${Object.keys(variants).length} responsive images (${Math.round((1-largest/originals)*100)}% fewer bytes at largest size)`)
}
void run()
