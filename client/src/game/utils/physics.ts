import { PHYSICS_CONFIG } from '../constants/physics'

export function metersToPixels(value: number): number {
  return value * PHYSICS_CONFIG.PIXELS_PER_METER
}

export function pixelsToMeters(value: number): number {
  return value / PHYSICS_CONFIG.PIXELS_PER_METER
}