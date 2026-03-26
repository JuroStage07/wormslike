import type Phaser from 'phaser'

export interface HealthBarUI {
  label: Phaser.GameObjects.Text
  background: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  valueText: Phaser.GameObjects.Text
}

export interface HudMessageState {
  text: string
  expiresAt: number
}