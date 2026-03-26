import Phaser from 'phaser'
import { GAME_BACKGROUND_COLOR, SCENE_KEYS } from '../../constants/game'
import { ASSET_KEYS } from '../assets/assetKeys'
import { ASSET_PATHS } from '../assets/assetPaths'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD)
  }

  preload() {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR)

    this.add.text(40, 40, 'Worms Web - PreloadScene', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
    })

    this.add.text(40, 90, 'Preparando carga de assets...', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#bbbbbb',
    })

    // Ejemplo de futura carga:
    // this.load.image(ASSET_KEYS.PLACEHOLDER_IMAGE, ASSET_PATHS.PLACEHOLDER_IMAGE)

    void ASSET_KEYS
    void ASSET_PATHS
  }

  create() {
    this.time.delayedCall(300, () => {
      this.scene.start(SCENE_KEYS.MAIN_MENU)
    })
  }
}