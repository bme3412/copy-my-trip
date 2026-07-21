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
    ['/paris', 'actually been'],
    ['/paris/compose', 'Tell me about the trip'],
    ['/paris/build', 'Choose your next move'],
    ['/paris/day/1', 'Marais &amp; the two islands'],
    ['/paris/day/3', 'Canal Saint-Martin &amp; Montmartre'],
    ['/paris/archive', 'every trip merged'],
    ['/paris/neighbourhoods', 'The neighborhoods'],
    ['/rome', 'planned with the same discipline'],
    ['/rome/compose', 'Tell me about the trip'],
    ['/rome/build', 'Choose your next move'],
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
