import { Analytics } from '@vercel/analytics/react'
import { useLocation } from 'react-router-dom'
import { analyticsPath, redactAnalyticsUrl } from '../lib/analytics'

export function WebAnalytics() {
  const { pathname } = useLocation()
  const path = analyticsPath(pathname)
  return <Analytics
    route={path}
    path={path}
    beforeSend={redactAnalyticsUrl}
    mode={import.meta.env.PROD ? 'production' : 'development'}
    debug={false}
  />
}
