import type { GameSize } from '../types/core'

export const GAME_SIZE: GameSize = {
  width: 1600,
  height: 800,
}

export const GAME_BACKGROUND_COLOR = '#2d2d2d'

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  LOBBY: 'LobbyScene',
  LOADING: 'LoadingScene',
  GAME: 'GameScene',
} as const