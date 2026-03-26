// Fixed maps - deterministic, identical for all players
// Heights are pixel Y values (higher number = lower on screen)

export interface FixedMapData {
  id: string
  name: string
  emoji: string
  description: string
  bgColor: string
  groundColor: string
  // Control points for terrain: array of [x_fraction, y_pixel] pairs
  // x_fraction: 0.0 to 1.0 (relative to screen width)
  // y_pixel: absolute Y pixel for terrain surface
  controlPoints: Array<[number, number]>
  platforms: Array<{ xFrac: number; y: number; width: number }>
  spawnXFracs: number[] // X positions as fraction of screen width
}

export const FIXED_MAPS: Record<string, FixedMapData> = {
  classic: {
    id: 'classic',
    name: 'Clásico',
    emoji: '🌿',
    description: 'Colinas suaves, ideal para principiantes',
    bgColor: '#87CEEB',
    groundColor: '#4f7c48',
    controlPoints: [
      [0.0, 600], [0.1, 580], [0.2, 555], [0.3, 530],
      [0.4, 510], [0.5, 500], [0.6, 515], [0.7, 540],
      [0.8, 565], [0.9, 585], [1.0, 600]
    ],
    platforms: [
      { xFrac: 0.35, y: 390, width: 140 },
      { xFrac: 0.65, y: 410, width: 130 }
    ],
    spawnXFracs: [0.12, 0.88]
  },

  mountains: {
    id: 'mountains',
    name: 'Montañas',
    emoji: '⛰️',
    description: 'Picos altos y valles profundos',
    bgColor: '#6a8fa8',
    groundColor: '#5a6e5a',
    controlPoints: [
      [0.0, 640], [0.08, 590], [0.15, 450], [0.22, 320],
      [0.28, 420], [0.35, 550], [0.42, 390], [0.5, 270],
      [0.58, 400], [0.65, 540], [0.72, 360], [0.8, 480],
      [0.88, 580], [0.95, 620], [1.0, 640]
    ],
    platforms: [
      { xFrac: 0.22, y: 240, width: 110 },
      { xFrac: 0.5,  y: 190, width: 120 },
      { xFrac: 0.78, y: 270, width: 100 }
    ],
    spawnXFracs: [0.08, 0.92]
  },

  valley: {
    id: 'valley',
    name: 'Valle',
    emoji: '🏞️',
    description: 'Un gran valle central con bordes elevados',
    bgColor: '#98c8a0',
    groundColor: '#3d6b3d',
    controlPoints: [
      [0.0, 400], [0.08, 390], [0.15, 410], [0.22, 460],
      [0.3, 530], [0.38, 590], [0.5, 610], [0.62, 590],
      [0.7, 530], [0.78, 460], [0.85, 410], [0.92, 390],
      [1.0, 400]
    ],
    platforms: [
      { xFrac: 0.5, y: 480, width: 160 }
    ],
    spawnXFracs: [0.1, 0.9]
  },

  chaos: {
    id: 'chaos',
    name: 'Caos',
    emoji: '💥',
    description: 'Terreno irregular e impredecible',
    bgColor: '#8b6b8b',
    groundColor: '#6b4a6b',
    controlPoints: [
      [0.0, 560], [0.07, 430], [0.13, 580], [0.2, 360],
      [0.27, 530], [0.33, 310], [0.4, 490], [0.47, 400],
      [0.53, 570], [0.6, 340], [0.67, 510], [0.73, 290],
      [0.8, 460], [0.87, 580], [0.93, 410], [1.0, 560]
    ],
    platforms: [
      { xFrac: 0.2,  y: 230, width: 100 },
      { xFrac: 0.4,  y: 210, width: 90  },
      { xFrac: 0.6,  y: 220, width: 100 },
      { xFrac: 0.8,  y: 200, width: 95  }
    ],
    spawnXFracs: [0.08, 0.92]
  }
}

export const MAP_IDS = Object.keys(FIXED_MAPS) as Array<keyof typeof FIXED_MAPS>
export type FixedMapId = keyof typeof FIXED_MAPS

/**
 * Build a full heightMap array from control points using cosine interpolation.
 * Returns an array of length `width` where each value is the Y pixel of the terrain surface.
 */
export function buildHeightMap(mapData: FixedMapData, width: number): number[] {
  const heightMap = new Array(width).fill(0)
  const pts = mapData.controlPoints

  for (let x = 0; x < width; x++) {
    const xFrac = x / (width - 1)

    // Find surrounding control points
    let lo = pts[0]
    let hi = pts[pts.length - 1]

    for (let i = 0; i < pts.length - 1; i++) {
      if (xFrac >= pts[i][0] && xFrac <= pts[i + 1][0]) {
        lo = pts[i]
        hi = pts[i + 1]
        break
      }
    }

    const range = hi[0] - lo[0]
    const t = range === 0 ? 0 : (xFrac - lo[0]) / range
    // Cosine interpolation for smooth curves
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2
    heightMap[x] = lo[1] + (hi[1] - lo[1]) * smoothT
  }

  return heightMap
}

/**
 * Resolve platform positions from fractions to pixel coordinates.
 */
export function resolvePlatforms(
  mapData: FixedMapData,
  width: number
): Array<{ x: number; y: number; width: number }> {
  return mapData.platforms.map(p => ({
    x: Math.round(p.xFrac * width),
    y: p.y,
    width: p.width
  }))
}

/**
 * Resolve spawn points from fractions to pixel coordinates.
 */
export function resolveSpawnPoints(
  mapData: FixedMapData,
  width: number,
  heightMap: number[]
): Array<{ x: number; y: number }> {
  return mapData.spawnXFracs.map(xFrac => {
    const x = Math.round(xFrac * width)
    const clampedX = Math.max(0, Math.min(width - 1, x))
    // Spawn 60px above terrain surface so worm lands on top
    const y = heightMap[clampedX] - 60
    return { x, y }
  })
}
