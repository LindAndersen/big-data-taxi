import { createMockClockService } from '../mocks/clock'
import { createMockDemandService, mockWeatherService } from '../mocks/services'
import { zoneService } from './zones'

// This is the composition point to replace with HTTP adapters when the backend exists.
export const clockService = createMockClockService(import.meta.env.VITE_DEMO_NOW)
export const demandService = createMockDemandService(zoneService, clockService)
export const weatherService = mockWeatherService
export { zoneService }
export type { ClockService, DemandService, WeatherService } from './contracts'
export type { ZoneService } from './zones'
