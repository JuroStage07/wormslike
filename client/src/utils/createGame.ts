import Phaser from 'phaser'
import { gameConfig } from '../game/config'

export function createGame(): Phaser.Game {
  return new Phaser.Game(gameConfig)
}