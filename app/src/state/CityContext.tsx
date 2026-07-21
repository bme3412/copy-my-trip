import { createContext, useContext } from 'react'
import type { City } from '../cities/types'

export const CityContext = createContext<City | null>(null)

export function useCity(): City {
  const city = useContext(CityContext)
  if (!city) throw new Error('useCity must be used within a city route')
  return city
}
