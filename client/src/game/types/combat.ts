import type Phaser from 'phaser'
import type planck from 'planck-js'
import type { WeaponType } from './weapons'

export interface WeaponState {
  aimAngleDeg: number
  power: number
  hasShotThisTurn: boolean
}

export interface ProjectileBinding {
  body: planck.Body
  graphic: Phaser.GameObjects.Graphics
  weaponType: WeaponType
  createdAt: number
  bounceCount?: number
  targetX?: number
  targetY?: number
  fuseTimer?: number
  trailPoints?: Array<{x: number, y: number}>
  lastTrailTime?: number
  countdownText?: Phaser.GameObjects.Text
}

export interface ExplosionResult {
  x: number
  y: number
  radius: number
}