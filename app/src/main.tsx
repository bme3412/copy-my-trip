import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import 'mapbox-gl/dist/mapbox-gl.css'
import './styles/fonts.css'
import './styles/classical.css'
import './styles/app.css'
import './styles/editorial.css'
import { routes } from './App'
import { TripProvider } from './state/TripContext'
import { CloudProvider } from './state/CloudContext'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CloudProvider><TripProvider>
      <RouterProvider router={router} />
    </TripProvider></CloudProvider>
  </StrictMode>,
)
