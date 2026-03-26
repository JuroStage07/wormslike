import Phaser from 'phaser'
import { GAME_BACKGROUND_COLOR, GAME_SIZE } from '../constants/game'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { PreloadScene } from './scenes/PreloadScene'
import { MainMenuScene } from './scenes/MainMenuScene'
import { LobbyScene } from './scenes/LobbyScene'
import { LoadingScene } from './scenes/LoadingScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_SIZE.width,
  height: GAME_SIZE.height,
  backgroundColor: GAME_BACKGROUND_COLOR,
  scene: [BootScene, PreloadScene, MainMenuScene, LobbyScene, LoadingScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_SIZE.width,
    height: GAME_SIZE.height,
  },
  dom: {
    createContainer: true,
  },
}