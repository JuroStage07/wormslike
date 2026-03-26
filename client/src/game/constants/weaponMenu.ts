export const WEAPON_MENU_CONFIG = {
  PANEL_WIDTH: 600,
  PANEL_HEIGHT: 400,
  GRID_COLS: 6,
  GRID_ROWS: 8,
  SLOT_SIZE: 80,
  SLOT_PADDING: 8,
  BACKGROUND_COLOR: 0x1a1a1a,
  BORDER_COLOR: 0x444444,
  SELECTED_COLOR: 0x4ade80,
  HOVER_COLOR: 0x666666,
} as const

export const WEAPON_MENU_ASSETS = {
  F1: [
    { key: 'bazooka', name: 'Bazooka', color: 0xffcc33 },
    { key: 'grenade', name: 'Granada', color: 0x44aa44 },
    { key: 'missile', name: 'Misil', color: 0xff4444 },
    { key: 'cluster_bomb', name: 'Racimo', color: 0xaa44ff },
    { key: 'pistol', name: 'Pistola', color: 0xcccccc },
    { key: 'laser', name: 'Láser', color: 0x00ffff },
  ],
  F2: [
    { key: 'flame_thrower', name: 'Lanzallamas', color: 0xff6600 },
    { key: 'empty', name: '', color: 0x333333 },
    { key: 'empty', name: '', color: 0x333333 },
    { key: 'empty', name: '', color: 0x333333 },
    { key: 'empty', name: '', color: 0x333333 },
    { key: 'empty', name: '', color: 0x333333 },
  ],
} as const