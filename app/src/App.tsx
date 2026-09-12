import { MailBriefingPage } from './pages/MailBriefingPage'
import { SavedTripPage } from './pages/SavedTripPage'
import { BriefingPage } from './pages/BriefingPage'
import { TodayPage } from './pages/TodayPage'
import { redirect, type RouteObject } from 'react-router-dom'
import { CITIES, DEFAULT_CITY } from './cities'
import { Layout } from './components/Layout'
import { ArchivePage } from './pages/ArchivePage'
import { ComposePage } from './pages/ComposePage'
import { Home } from './pages/Home'
import { ItineraryPage } from './pages/ItineraryPage'
import { NeighbourhoodsPage } from './pages/NeighbourhoodsPage'

export const routes: RouteObject[] = [
  { path: '/', loader: () => redirect(`/${DEFAULT_CITY}`) },
  {
    path: '/:city',
    element: <Layout />,
    loader: ({ params }) => (params.city && CITIES[params.city] ? null : redirect(`/${DEFAULT_CITY}`)),
    children: [
      ...(import.meta.env.DEV ? [{ path: 'saved/:snapshotId/alternatives', hydrateFallbackElement: <p role="status">Loading alternatives…</p>, lazy: async () => ({ Component: (await import('./pages/AlternativesPreviewPage')).AlternativesPreviewPage }) }] : []),
      ...(import.meta.env.DEV ? [{ path: 'weather-preview', hydrateFallbackElement: <p role="status">Loading weather preview…</p>, lazy: async () => ({ Component: (await import('./pages/WeatherPreviewPage')).WeatherPreviewPage }) }] : []),
      { index: true, element: <Home /> },
      { path: 'compose', element: <ComposePage /> },
      { path: 'saved', element: <SavedTripPage /> },
      { path: 'saved/:snapshotId', element: <SavedTripPage /> },
      { path: 'saved/:snapshotId/briefing', element: <BriefingPage /> },
      { path: 'mail/:mailId', element: <MailBriefingPage /> },
      { path: 'today', element: <TodayPage /> },
      // Plans folded into compose — old links land there.
      { path: 'plans', loader: ({ params }) => redirect(`/${params.city}/compose`) },
      { path: 'itinerary/:n', element: <ItineraryPage /> },
      // The builder is a mode of the itinerary now; the days are the itinerary.
      { path: 'build', loader: ({ params }) => redirect(`/${params.city}/itinerary/1`) },
      { path: 'day/:n', loader: ({ params }) => redirect(`/${params.city}/itinerary/${params.n}`) },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'neighbourhoods', element: <NeighbourhoodsPage /> },
      { path: '*', loader: ({ params }) => redirect(`/${params.city}`) },
    ],
  },
  { path: '*', loader: () => redirect(`/${DEFAULT_CITY}`) },
]
