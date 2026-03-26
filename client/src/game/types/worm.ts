import type Phaser from 'phaser'
import type planck from 'planck-js'

export type WormDirection = 'left' | 'right'

export interface WormGraphics {
  body: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  activeMarker: Phaser.GameObjects.Text
}

export interface WormState {
  direction: WormDirection
  isGrounded: boolean
  isActive: boolean
  health: number
}

export interface WormPhysics {
  body: planck.Body
}

export interface WormConfigData {
  x: number
  y: number
  color: number
  label: string
}