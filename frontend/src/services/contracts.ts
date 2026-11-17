import type { EvaluationResponse, DemandSummary, HourlyDemandRequest, HourlyDemandResponse } from '../types/demand'
import type { ClockSnapshot, DateRange } from '../types/time'
import type { WeatherResponse } from '../types/weather'

export interface ClockService {
  getCurrentTime(signal?: AbortSignal): Promise<ClockSnapshot>
}

export interface DemandService {
  getHourlyDemand(request: HourlyDemandRequest, signal?: AbortSignal): Promise<HourlyDemandResponse>
  getSummary(range: DateRange, signal?: AbortSignal): Promise<DemandSummary>
  getEvaluation(range: DateRange, signal?: AbortSignal): Promise<EvaluationResponse>
}

export interface WeatherService {
  getHourlyWeather(date: string, signal?: AbortSignal): Promise<WeatherResponse>
}
