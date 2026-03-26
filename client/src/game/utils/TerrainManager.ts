import Phaser from 'phaser'
import planck from 'planck-js'
import { pixelsToMeters } from './physics'

export interface TerrainChunk {
  x: number
  y: number
  width: number
  height: number
  body: planck.Body
  graphic: Phaser.GameObjects.Rectangle
  isDestroyed: boolean
}

export class TerrainManager {
  private scene: Phaser.Scene
  private world: planck.World
  private chunks: TerrainChunk[] = []
  private terrainTexture: Phaser.Textures.CanvasTexture
  private terrainCanvas: HTMLCanvasElement
  private terrainContext: CanvasRenderingContext2D
  private terrainWidth: number
  private terrainHeight: number
  private chunkSize: number = 32

  constructor(scene: Phaser.Scene, world: planck.World, width: number, height: number) {
    this.scene = scene
    this.world = world
    this.terrainWidth = width
    this.terrainHeight = height

    // Crear canvas para el terreno
    this.terrainCanvas = document.createElement('canvas')
    this.terrainCanvas.width = width
    this.terrainCanvas.height = height
    this.terrainContext = this.terrainCanvas.getContext('2d')!

    // Crear textura desde el canvas
    this.terrainTexture = this.scene.textures.createCanvas('terrain', width, height)!
    
    this.initializeTerrain()
  }

  private initializeTerrain(): void {
    // Dibujar terreno inicial
    this.terrainContext.fillStyle = '#4f7c48'
    this.terrainContext.fillRect(0, 0, this.terrainWidth, this.terrainHeight)

    // Crear superficie irregular
    this.generateTerrainSurface()

    // Actualizar textura desde el canvas
    const canvasTexture = this.scene.textures.get('terrain') as Phaser.Textures.CanvasTexture
    if (canvasTexture && canvasTexture.canvas) {
      canvasTexture.canvas.getContext('2d')!.drawImage(this.terrainCanvas, 0, 0)
      canvasTexture.refresh()
    }

    // Crear chunks de física
    this.createPhysicsChunks()
  }

  private generateTerrainSurface(): void {
    const surfaceHeight = 60
    const baseY = this.terrainHeight - surfaceHeight

    // Crear superficie con ruido
    this.terrainContext.fillStyle = '#4f7c48'
    this.terrainContext.beginPath()
    this.terrainContext.moveTo(0, this.terrainHeight)

    for (let x = 0; x <= this.terrainWidth; x += 4) {
      const noise = Math.sin(x * 0.01) * 10 + Math.sin(x * 0.03) * 5
      const y = baseY + noise
      this.terrainContext.lineTo(x, y)
    }

    this.terrainContext.lineTo(this.terrainWidth, this.terrainHeight)
    this.terrainContext.lineTo(0, this.terrainHeight)
    this.terrainContext.closePath()
    this.terrainContext.fill()
  }

  private createPhysicsChunks(): void {
    // Crear chunks de física basados en el terreno
    const chunksX = Math.ceil(this.terrainWidth / this.chunkSize)
    const chunksY = Math.ceil(this.terrainHeight / this.chunkSize)

    for (let chunkX = 0; chunkX < chunksX; chunkX++) {
      for (let chunkY = 0; chunkY < chunksY; chunkY++) {
        const x = chunkX * this.chunkSize
        const y = chunkY * this.chunkSize
        const width = Math.min(this.chunkSize, this.terrainWidth - x)
        const height = Math.min(this.chunkSize, this.terrainHeight - y)

        // Solo crear chunk si hay terreno sólido
        if (this.hasTerrainInArea(x, y, width, height)) {
          this.createTerrainChunk(x, y, width, height)
        }
      }
    }
  }

  private hasTerrainInArea(x: number, y: number, width: number, height: number): boolean {
    // Verificar si hay píxeles sólidos en el área
    const imageData = this.terrainContext.getImageData(x, y, width, height)
    const data = imageData.data

    for (let i = 3; i < data.length; i += 4) { // Verificar canal alpha
      if (data[i] > 0) { // Si hay píxel sólido
        return true
      }
    }
    return false
  }

  private createTerrainChunk(x: number, y: number, width: number, height: number): void {
    // Crear cuerpo de física
    const centerX = x + width / 2
    const centerY = y + height / 2

    const body = this.world.createBody({
      type: 'static',
      position: planck.Vec2(pixelsToMeters(centerX), pixelsToMeters(centerY))
    })

    body.createFixture({
      shape: planck.Box(pixelsToMeters(width / 2), pixelsToMeters(height / 2)),
      density: 0,
      friction: 0.8,
      userData: { type: 'terrain', chunkId: this.chunks.length }
    })

    // Crear gráfico (invisible, solo para debug)
    const graphic = this.scene.add.rectangle(centerX, centerY, width, height, 0x4f7c48, 0)
    graphic.setStrokeStyle(1, 0x666666, 0.3)

    const chunk: TerrainChunk = {
      x,
      y,
      width,
      height,
      body,
      graphic,
      isDestroyed: false
    }

    this.chunks.push(chunk)
  }

  public destroyCircle(centerX: number, centerY: number, radius: number): void {
    // Destruir terreno en forma circular
    this.terrainContext.globalCompositeOperation = 'destination-out'
    this.terrainContext.beginPath()
    this.terrainContext.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.terrainContext.fill()
    this.terrainContext.globalCompositeOperation = 'source-over'

    // Actualizar textura desde el canvas
    const canvasTexture = this.scene.textures.get('terrain') as Phaser.Textures.CanvasTexture
    if (canvasTexture && canvasTexture.canvas) {
      canvasTexture.canvas.getContext('2d')!.drawImage(this.terrainCanvas, 0, 0)
      canvasTexture.refresh()
    }

    // Actualizar chunks de física
    this.updatePhysicsChunks(centerX, centerY, radius)

    // Verificar derrumbes
    this.checkForCollapses(centerX, centerY, radius)
  }

  private updatePhysicsChunks(centerX: number, centerY: number, radius: number): void {
    // Encontrar chunks afectados
    const affectedChunks = this.chunks.filter(chunk => {
      if (chunk.isDestroyed) return false

      const chunkCenterX = chunk.x + chunk.width / 2
      const chunkCenterY = chunk.y + chunk.height / 2
      const distance = Math.sqrt(
        Math.pow(centerX - chunkCenterX, 2) + Math.pow(centerY - chunkCenterY, 2)
      )

      return distance <= radius + Math.max(chunk.width, chunk.height) / 2
    })

    // Verificar y actualizar chunks afectados
    affectedChunks.forEach(chunk => {
      if (!this.hasTerrainInArea(chunk.x, chunk.y, chunk.width, chunk.height)) {
        this.destroyChunk(chunk)
      }
    })
  }

  private destroyChunk(chunk: TerrainChunk): void {
    if (chunk.isDestroyed) return

    chunk.isDestroyed = true
    this.world.destroyBody(chunk.body)
    chunk.graphic.destroy()

    // Crear partículas de debris
    this.createDebrisParticles(
      chunk.x + chunk.width / 2,
      chunk.y + chunk.height / 2,
      chunk.width
    )
  }

  private createDebrisParticles(x: number, y: number, size: number): void {
    const particleCount = Math.min(8, Math.floor(size / 4))

    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.circle(
        x + (Math.random() - 0.5) * size,
        y + (Math.random() - 0.5) * size,
        2 + Math.random() * 3,
        0x8B4513,
        0.8
      )

      const velocityX = (Math.random() - 0.5) * 100
      const velocityY = -Math.random() * 50 - 20

      this.scene.tweens.add({
        targets: particle,
        x: particle.x + velocityX,
        y: particle.y + velocityY + 100, // Gravedad simulada
        alpha: 0,
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      })
    }
  }

  private checkForCollapses(centerX: number, centerY: number, radius: number): void {
    // Buscar chunks que podrían colapsar por falta de soporte
    const potentialCollapses = this.chunks.filter(chunk => {
      if (chunk.isDestroyed) return false

      // Verificar si el chunk está cerca del área destruida
      const chunkCenterX = chunk.x + chunk.width / 2
      const chunkCenterY = chunk.y + chunk.height / 2
      const distance = Math.sqrt(
        Math.pow(centerX - chunkCenterX, 2) + Math.pow(centerY - chunkCenterY, 2)
      )

      return distance <= radius * 2 && chunkCenterY < centerY
    })

    // Verificar soporte para cada chunk
    potentialCollapses.forEach(chunk => {
      if (!this.hasSupport(chunk)) {
        this.collapseChunk(chunk)
      }
    })
  }

  private hasSupport(chunk: TerrainChunk): boolean {
    // Verificar si hay soporte debajo del chunk
    const supportY = chunk.y + chunk.height + 5
    const supportWidth = chunk.width * 0.7 // Requiere 70% de soporte

    let supportFound = 0
    for (let x = chunk.x + chunk.width * 0.15; x < chunk.x + chunk.width * 0.85; x += 4) {
      if (this.hasTerrainAt(x, supportY)) {
        supportFound += 4
      }
    }

    return supportFound >= supportWidth
  }

  private hasTerrainAt(x: number, y: number): boolean {
    if (x < 0 || x >= this.terrainWidth || y < 0 || y >= this.terrainHeight) {
      return false
    }

    const imageData = this.terrainContext.getImageData(x, y, 1, 1)
    return imageData.data[3] > 0 // Verificar canal alpha
  }

  private collapseChunk(chunk: TerrainChunk): void {
    if (chunk.isDestroyed) return

    // Crear efecto de colapso
    this.createCollapseEffect(chunk)

    // Destruir el chunk después de un delay
    this.scene.time.delayedCall(200, () => {
      this.destroyChunk(chunk)
    })
  }

  private createCollapseEffect(chunk: TerrainChunk): void {
    const centerX = chunk.x + chunk.width / 2
    const centerY = chunk.y + chunk.height / 2

    // Efecto visual de colapso
    const collapseEffect = this.scene.add.rectangle(
      centerX, centerY, chunk.width, chunk.height, 0x8B4513, 0.6
    )

    this.scene.tweens.add({
      targets: collapseEffect,
      y: centerY + 50,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => collapseEffect.destroy()
    })

    // Partículas de polvo
    for (let i = 0; i < 6; i++) {
      const dust = this.scene.add.circle(
        centerX + (Math.random() - 0.5) * chunk.width,
        centerY,
        3 + Math.random() * 2,
        0xD2B48C,
        0.6
      )

      this.scene.tweens.add({
        targets: dust,
        x: dust.x + (Math.random() - 0.5) * 40,
        y: dust.y - Math.random() * 30,
        alpha: 0,
        scale: 1.5,
        duration: 600 + Math.random() * 200,
        onComplete: () => dust.destroy()
      })
    }
  }

  public getTerrainSprite(): Phaser.GameObjects.Image {
    // Crear sprite del terreno para renderizado
    const sprite = this.scene.add.image(0, 0, 'terrain')
    sprite.setOrigin(0, 0)
    sprite.setDepth(-1) // Detrás de todo
    sprite.setVisible(true) // Asegurar que sea visible
    return sprite
  }

  public isPointInTerrain(x: number, y: number): boolean {
    return this.hasTerrainAt(x, y)
  }

  public getHeightAt(x: number): number {
    // Encontrar la altura del terreno en una coordenada X
    for (let y = 0; y < this.terrainHeight; y++) {
      if (this.hasTerrainAt(x, y)) {
        return y
      }
    }
    return this.terrainHeight
  }

  public destroy(): void {
    // Limpiar recursos
    this.chunks.forEach(chunk => {
      if (!chunk.isDestroyed) {
        this.world.destroyBody(chunk.body)
        chunk.graphic.destroy()
      }
    })
    this.chunks = []
    
    if (this.terrainTexture) {
      this.terrainTexture.destroy()
    }
  }
}