import type { WEAPON_TYPES } from '../constants/weapons'

export type WeaponType = typeof WEAPON_TYPES[keyof typeof WEAPON_TYPES]

export interface WeaponData {
  name: string
  projectileSpeed: number
  damage: number
  explosionRadius: number
  projectileColor: number
  projectileSize: number
  ammo: number
  description: string
  bounces?: number
  fuseTime?: number
  guidanceForce?: number
  pelletCount?: number
  spread?: number
  clusterCount?: number
  clusterRadius?: number
  clusterDamage?: number
  explosionType?: string
  hasTrail?: boolean
  trailColor?: number
  hasTimer?: boolean
  showCountdown?: boolean
  isGuided?: boolean
  isInstant?: boolean
  penetrates?: boolean
  isFlamethrower?: boolean
  flameCount?: number
  flameLife?: number
  requiresTarget?: boolean
  directDamage?: boolean
  excludeShooter?: boolean
}

export interface WeaponState {
  currentWeapon: WeaponType
  ammoCount: Map<WeaponType, number>
}