export interface MapConfig {
  width: number
  height: number
  groundHeight: number
  hillCount: number
  caveCount: number
  platformCount: number
}

export interface MapFeature {
  type: 'hill' | 'cave' | 'platform' | 'valley'
  x: number
  y: number
  width: number
  height: number
}

export class MapGenerator {
  private static seed: number = 0
  private static seedRandom(): number {
    // Generador de números pseudoaleatorios simple pero determinístico
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  public static setSeed(seed: number): void {
    this.seed = seed
  }

  public static generateMap(config: MapConfig, seed?: number): {
    heightMap: number[]
    features: MapFeature[]
    spawnPoints: Array<{x: number, y: number}>
    platforms: Array<{x: number, y: number, width: number}>
  } {
    // Usar semilla si se proporciona
    if (seed !== undefined) {
      this.setSeed(seed)
    }
    
    const heightMap = new Array(config.width).fill(0)
    const features: MapFeature[] = []
    
    // Generar altura base del terreno
    this.generateBaseTerrain(heightMap, config)
    
    // Agregar colinas
    this.addHills(heightMap, features, config)
    
    // Agregar valles
    this.addValleys(heightMap, features, config)
    
    // Generar plataformas flotantes
    const platforms = this.generatePlatforms(config)
    
    // Generar puntos de spawn seguros
    const spawnPoints = this.generateSpawnPoints(heightMap, config)
    
    return { heightMap, features, spawnPoints, platforms }
  }

  private static generateBaseTerrain(heightMap: number[], config: MapConfig): void {
    const baseHeight = config.height - config.groundHeight
    
    // Generar puntos de control para suavizar
    const controlPoints: number[] = []
    const controlSpacing = 100 // Puntos de control cada 100 píxeles
    
    for (let x = 0; x < config.width; x += controlSpacing) {
      // Ruido más suave
      const noise1 = Math.sin(x * 0.005) * 25
      const noise2 = Math.sin(x * 0.015) * 12
      const noise3 = Math.sin(x * 0.025) * 6
      
      controlPoints.push(baseHeight + noise1 + noise2 + noise3)
    }
    
    // Interpolar suavemente entre puntos de control
    for (let x = 0; x < config.width; x++) {
      const controlIndex = x / controlSpacing
      const lowerIndex = Math.floor(controlIndex)
      const upperIndex = Math.ceil(controlIndex)
      const t = controlIndex - lowerIndex
      
      if (upperIndex < controlPoints.length) {
        const lowerHeight = controlPoints[lowerIndex] || controlPoints[0]
        const upperHeight = controlPoints[upperIndex] || controlPoints[controlPoints.length - 1]
        
        // Interpolación suave (coseno)
        const smoothT = (1 - Math.cos(t * Math.PI)) / 2
        heightMap[x] = lowerHeight + (upperHeight - lowerHeight) * smoothT
      } else {
        heightMap[x] = controlPoints[controlPoints.length - 1]
      }
    }
  }

  private static addHills(heightMap: number[], features: MapFeature[], config: MapConfig): void {
    for (let i = 0; i < config.hillCount; i++) {
      const centerX = this.seedRandom() * config.width
      const width = 80 + this.seedRandom() * 120
      const height = 30 + this.seedRandom() * 50
      
      // Aplicar colina al heightMap
      for (let x = Math.max(0, centerX - width/2); x < Math.min(config.width, centerX + width/2); x++) {
        const distance = Math.abs(x - centerX)
        const factor = Math.max(0, 1 - (distance / (width/2)))
        const hillHeight = height * Math.pow(factor, 2)
        
        heightMap[Math.floor(x)] -= hillHeight
      }
      
      features.push({
        type: 'hill',
        x: centerX - width/2,
        y: heightMap[Math.floor(centerX)] - height,
        width,
        height
      })
    }
  }

  private static addValleys(heightMap: number[], features: MapFeature[], config: MapConfig): void {
    const valleyCount = Math.floor(config.hillCount / 2)
    
    for (let i = 0; i < valleyCount; i++) {
      const centerX = this.seedRandom() * config.width
      const width = 60 + this.seedRandom() * 80
      const depth = 20 + this.seedRandom() * 30
      
      // Aplicar valle al heightMap
      for (let x = Math.max(0, centerX - width/2); x < Math.min(config.width, centerX + width/2); x++) {
        const distance = Math.abs(x - centerX)
        const factor = Math.max(0, 1 - (distance / (width/2)))
        const valleyDepth = depth * Math.pow(factor, 2)
        
        heightMap[Math.floor(x)] += valleyDepth
      }
      
      features.push({
        type: 'valley',
        x: centerX - width/2,
        y: heightMap[Math.floor(centerX)],
        width,
        height: depth
      })
    }
  }

  private static generatePlatforms(config: MapConfig): Array<{x: number, y: number, width: number}> {
    const platforms: Array<{x: number, y: number, width: number}> = []
    const jumpHeight = 120 // Altura máxima de salto del gusano
    const minPlatformWidth = 80
    const maxPlatformWidth = 150
    
    for (let i = 0; i < config.platformCount; i++) {
      const x = 150 + this.seedRandom() * (config.width - 300) // Evitar bordes
      const groundLevel = config.height - config.groundHeight
      const y = groundLevel - jumpHeight - this.seedRandom() * 50 // Alcanzable con salto
      const width = minPlatformWidth + this.seedRandom() * (maxPlatformWidth - minPlatformWidth)
      
      // Verificar que no se superponga con otras plataformas
      let overlaps = false
      for (const existing of platforms) {
        const distance = Math.abs(x - existing.x)
        if (distance < (width + existing.width) / 2 + 50) {
          overlaps = true
          break
        }
      }
      
      if (!overlaps) {
        platforms.push({ x, y, width })
      }
    }
    
    return platforms
  }

  private static generateSpawnPoints(heightMap: number[], config: MapConfig): Array<{x: number, y: number}> {
    const spawnPoints: Array<{x: number, y: number}> = []
    const minDistance = 200 // Distancia mínima entre spawn points
    
    // Buscar puntos planos para spawn
    const candidates: Array<{x: number, y: number, flatness: number}> = []
    
    for (let x = 50; x < config.width - 50; x += 10) {
      // Calcular qué tan plano es el área
      let flatness = 0
      const checkRadius = 30
      
      for (let checkX = x - checkRadius; checkX <= x + checkRadius; checkX += 5) {
        if (checkX >= 0 && checkX < config.width) {
          const heightDiff = Math.abs(heightMap[checkX] - heightMap[x])
          flatness += Math.max(0, checkRadius - heightDiff)
        }
      }
      
      candidates.push({
        x,
        y: heightMap[x] - 10, // Spawn ligeramente arriba del terreno
        flatness
      })
    }
    
    // Ordenar por planitud (mejor primero)
    candidates.sort((a, b) => b.flatness - a.flatness)
    
    // Seleccionar spawn points con distancia mínima
    for (const candidate of candidates) {
      let tooClose = false
      
      for (const existing of spawnPoints) {
        const distance = Math.abs(candidate.x - existing.x)
        if (distance < minDistance) {
          tooClose = true
          break
        }
      }
      
      if (!tooClose) {
        spawnPoints.push({ x: candidate.x, y: candidate.y })
        
        // Limitar a 4 spawn points máximo
        if (spawnPoints.length >= 4) break
      }
    }
    
    // Asegurar al menos 2 spawn points
    if (spawnPoints.length < 2) {
      spawnPoints.push(
        { x: config.width * 0.25, y: heightMap[Math.floor(config.width * 0.25)] - 10 },
        { x: config.width * 0.75, y: heightMap[Math.floor(config.width * 0.75)] - 10 }
      )
    }
    
    return spawnPoints
  }

  public static createTerrainCanvas(
    width: number, 
    height: number, 
    heightMap: number[], 
    features: MapFeature[],
    platforms: Array<{x: number, y: number, width: number}> = []
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    
    // Fondo (cielo)
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#87CEEB') // Azul cielo
    gradient.addColorStop(0.7, '#98D8E8')
    gradient.addColorStop(1, '#B0E0E6')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Dibujar terreno base
    ctx.fillStyle = '#4f7c48' // Verde terreno
    ctx.beginPath()
    ctx.moveTo(0, height)
    
    for (let x = 0; x < width; x++) {
      const y = Math.max(0, Math.min(height, heightMap[x]))
      ctx.lineTo(x, y)
    }
    
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fill()
    
    // Agregar textura al terreno
    this.addTerrainTexture(ctx, width, height, heightMap)
    
    // Dibujar características especiales
    this.drawFeatures(ctx, features)
    
    // Dibujar plataformas
    this.drawPlatforms(ctx, platforms)
    
    return canvas
  }

  private static addTerrainTexture(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    heightMap: number[]
  ): void {
    // Agregar puntos de textura aleatoria
    ctx.fillStyle = '#3d6b3d'
    
    for (let x = 0; x < width; x += 3) {
      const terrainY = heightMap[x]
      
      for (let y = terrainY; y < height; y += 4) {
        if (this.seedRandom() < 0.3) {
          ctx.fillRect(x + this.seedRandom() * 2, y + this.seedRandom() * 2, 1, 1)
        }
      }
    }
    
    // Agregar línea de superficie
    ctx.strokeStyle = '#2d5b2d'
    ctx.lineWidth = 2
    ctx.beginPath()
    
    for (let x = 0; x < width; x++) {
      const y = heightMap[x]
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()
  }

  private static drawFeatures(ctx: CanvasRenderingContext2D, features: MapFeature[]): void {
    features.forEach(feature => {
      switch (feature.type) {
        case 'hill':
          // Dibujar colina con color más claro
          ctx.fillStyle = '#5f8c5f'
          ctx.beginPath()
          ctx.ellipse(
            feature.x + feature.width/2, 
            feature.y + feature.height/2,
            feature.width/2, 
            feature.height/2, 
            0, 0, Math.PI * 2
          )
          ctx.fill()
          break
          
        case 'valley':
          // Dibujar valle con color más oscuro
          ctx.fillStyle = '#3f6c3f'
          ctx.fillRect(feature.x, feature.y, feature.width, feature.height)
          break
      }
    })
  }

  private static drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Array<{x: number, y: number, width: number}>): void {
    platforms.forEach(platform => {
      const platformHeight = 15
      
      // Plataforma principal
      ctx.fillStyle = '#6b8e6b'
      ctx.fillRect(platform.x - platform.width/2, platform.y - platformHeight/2, platform.width, platformHeight)
      
      // Borde superior más claro
      ctx.fillStyle = '#7fa07f'
      ctx.fillRect(platform.x - platform.width/2, platform.y - platformHeight/2, platform.width, 3)
      
      // Sombra inferior
      ctx.fillStyle = '#4a6b4a'
      ctx.fillRect(platform.x - platform.width/2, platform.y + platformHeight/2 - 2, platform.width, 2)
    })
  }

  public static getPresetMaps(): { [key: string]: MapConfig } {
    return {
      'classic': {
        width: 1200,
        height: 600,
        groundHeight: 100,
        hillCount: 3,
        caveCount: 2,
        platformCount: 1
      },
      'mountainous': {
        width: 1200,
        height: 600,
        groundHeight: 120,
        hillCount: 5,
        caveCount: 1,
        platformCount: 2
      },
      'flat': {
        width: 1200,
        height: 600,
        groundHeight: 80,
        hillCount: 1,
        caveCount: 0,
        platformCount: 0
      },
      'chaotic': {
        width: 1200,
        height: 600,
        groundHeight: 140,
        hillCount: 7,
        caveCount: 3,
        platformCount: 3
      }
    }
  }
}