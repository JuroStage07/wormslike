import Phaser from 'phaser'
import { GAME_BACKGROUND_COLOR, SCENE_KEYS } from '../../constants/game'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT)
  }

  create() {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR)

    this.add.text(40, 40, 'Worms Web - BootScene', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
    })

    this.add.text(40, 90, 'Inicializando...', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#bbbbbb',
    })

    this.time.delayedCall(300, () => {
      this.scene.start(SCENE_KEYS.PRELOAD)
    })
  }
}