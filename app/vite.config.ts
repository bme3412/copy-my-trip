import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { devTrips } from './server/dev-trips'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['SUPABASE_', 'VITE_SUPABASE_'])
  return {
    plugins: [react(), {
      name: 'local-trip-api',
      configureServer(server) {
        // Only public connection settings are needed by the user-token API.
        for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
          if (env[key] !== undefined) process.env[key] = env[key]
        }
        server.middlewares.use((req, res, next) => { void devTrips(req, res, next) })
      },
    }],
  }
})
