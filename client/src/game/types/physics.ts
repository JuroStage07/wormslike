import type Phaser from 'phaser'
import type planck from 'planck-js'

export interface PhysicsSpriteBinding {
  body: planck.Body
  graphic: Phaser.GameObjects.Rectangle
  label?: Phaser.GameObjects.Text
}