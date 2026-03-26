import Phaser from 'phaser'
import { createGame } from './createGame'

class GameManager {
  private game: Phaser.Game | null = null

  public init(): Phaser.Game {
    if (this.game) {
      return this.game
    }

    this.game = createGame()
    return this.game
  }

  public getGame(): Phaser.Game | null {
    return this.game
  }

  public destroy(removeCanvas = true): void {
    if (!this.game) {
      return
    }

    this.game.destroy(removeCanvas)
    this.game = null
  }
}

export const gameManager = new GameManager()