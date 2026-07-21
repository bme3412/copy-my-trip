import { redirect, type RouteObject } from 'react-router-dom'
import { CITIES, DEFAULT_CITY } from './cities'
import { Layout } from './components/Layout'
import { ArchivePage } from './pages/ArchivePage'
import { BuildPage } from './pages/BuildPage'
import { ComposePage } from './pages/ComposePage'
import { DayPage } from './pages/DayPage'
import { Home } from './pages/Home'
import { NeighbourhoodsPage } from './pages/NeighbourhoodsPage'

export const routes: RouteObject[] = [
  { path: '/', loader: () => redirect(`/${DEFAULT_CITY}`) },
  {
    path: '/:city',
    element: <Layout />,
    loader: ({ params }) => (params.city && CITIES[params.city] ? null : redirect(`/${DEFAULT_CITY}`)),
    children: [
      { index: true, element: <Home /> },
      { path: 'compose', element: <ComposePage /> },
      // Plans folded into compose — old links land there.
      { path: 'plans', loader: ({ params }) => redirect(`/${params.city}/compose`) },
      { path: 'build', element: <BuildPage /> },
      { path: 'day/:n', element: <DayPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'neighbourhoods', element: <NeighbourhoodsPage /> },
      { path: '*', loader: ({ params }) => redirect(`/${params.city}`) },
    ],
  },
  { path: '*', loader: () => redirect(`/${DEFAULT_CITY}`) },
]
