import Phaser from 'phaser'

export class AssetManager {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // Crear sprites temporales usando gráficos procedurales
  public createWormSprite(color: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics()
    
    // Cuerpo del worm (óvalo)
    graphics.fillStyle(color)
    graphics.fillEllipse(0, 0, 24, 16)
    
    // Ojos
    graphics.fillStyle(0xffffff)
    graphics.fillCircle(-6, -3, 3)
    graphics.fillCircle(6, -3, 3)
    
    // Pupilas
    graphics.fillStyle(0x000000)
    graphics.fillCircle(-5, -3, 1.5)
    graphics.fillCircle(7, -3, 1.5)
    
    // Sonrisa
    graphics.lineStyle(1, 0x000000)
    graphics.beginPath()
    graphics.arc(0, 2, 4, 0, Math.PI)
    graphics.strokePath()
    
    return graphics
  }

  public createAnimatedWormSprite(color: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    
    // Cuerpo principal
    const body = this.scene.add.ellipse(0, 0, 32, 20, color)
    const colorRGB = Phaser.Display.Color.ColorToRGBA(color)
    body.setStrokeStyle(2, Phaser.Display.Color.GetColor32(colorRGB.r, colorRGB.g, colorRGB.b, colorRGB.a) * 0.8)
    
    // Ojos
    const leftEye = this.scene.add.circle(-8, -4, 4, 0xffffff)
    const rightEye = this.scene.add.circle(8, -4, 4, 0xffffff)
    
    // Pupilas
    const leftPupil = this.scene.add.circle(-7, -4, 2, 0x000000)
    const rightPupil = this.scene.add.circle(9, -4, 2, 0x000000)
    
    // Boca
    const mouth = this.scene.add.graphics()
    mouth.lineStyle(2, 0x000000)
    mouth.beginPath()
    mouth.arc(0, 3, 6, 0, Math.PI)
    mouth.strokePath()
    
    // Añadir todo al contenedor
    container.add([body, leftEye, rightEye, leftPupil, rightPupil, mouth])
    
    return container
  }

  public animateWormMovement(wormSprite: Phaser.GameObjects.Container, direction: 'left' | 'right'): void {
    // Animación de balanceo al caminar
    this.scene.tweens.add({
      targets: wormSprite,
      scaleY: 0.9,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    
    // Inclinar ligeramente en la dirección del movimiento
    this.scene.tweens.add({
      targets: wormSprite,
      rotation: direction === 'left' ? -0.1 : 0.1,
      duration: 300,
      ease: 'Power2'
    })
  }

  public stopWormAnimation(wormSprite: Phaser.GameObjects.Container): void {
    this.scene.tweens.killTweensOf(wormSprite)
    
    // Volver a la posición normal
    this.scene.tweens.add({
      targets: wormSprite,
      scaleY: 1,
      rotation: 0,
      duration: 200,
      ease: 'Power2'
    })
  }

  public animateWormJump(wormSprite: Phaser.GameObjects.Container): void {
    // Animación de salto
    this.scene.tweens.add({
      targets: wormSprite,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 100,
      yoyo: true,
      ease: 'Power2'
    })
  }

  public createProjectileSprite(weaponType: string, size: number, color: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics()
    
    switch (weaponType) {
      case 'bazooka':
        // Cohete con llama
        graphics.fillStyle(color)
        graphics.fillEllipse(0, 0, size * 2, size)
        graphics.fillStyle(0xff4444)
        graphics.fillTriangle(-size, -2, -size, 2, -size - 4, 0)
        break
        
      case 'grenade':
        // Granada con pin
        graphics.fillStyle(color)
        graphics.fillCircle(0, 0, size)
        graphics.lineStyle(2, 0xcccccc)
        graphics.lineBetween(0, -size, 0, -size - 3)
        graphics.fillStyle(0xcccccc)
        graphics.fillCircle(0, -size - 4, 1)
        break
        
      case 'missile':
        // Misil con aletas
        graphics.fillStyle(color)
        graphics.fillEllipse(0, 0, size * 2.5, size)
        graphics.fillStyle(0x666666)
        graphics.fillTriangle(size, -3, size + 3, 0, size, 3)
        graphics.fillTriangle(-size, -2, -size - 3, -4, -size - 3, 0)
        graphics.fillTriangle(-size, 2, -size - 3, 4, -size - 3, 0)
        break
        
      case 'shotgun':
        // Perdigón simple
        graphics.fillStyle(color)
        graphics.fillCircle(0, 0, size)
        break
        
      case 'cluster_bomb':
        // Bomba con marcas
        graphics.fillStyle(color)
        graphics.fillCircle(0, 0, size)
        graphics.lineStyle(1, 0x000000)
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          const x1 = Math.cos(angle) * (size - 2)
          const y1 = Math.sin(angle) * (size - 2)
          const x2 = Math.cos(angle) * size
          const y2 = Math.sin(angle) * size
          graphics.lineBetween(x1, y1, x2, y2)
        }
        break
        
      case 'pistol':
        // Bala pequeña
        graphics.fillStyle(color)
        graphics.fillEllipse(0, 0, size * 2, size * 0.8)
        graphics.fillStyle(0xffdd44)
        graphics.fillEllipse(-size * 0.5, 0, size * 0.8, size * 0.6)
        break
        
      default:
        graphics.fillStyle(color)
        graphics.fillCircle(0, 0, size)
    }
    
    return graphics
  }

  public createExplosionEffect(x: number, y: number, radius: number, type: string = 'normal'): void {
    switch (type) {
      case 'fire':
        this.createFireExplosion(x, y, radius)
        break
      case 'smoke':
        this.createSmokeExplosion(x, y, radius)
        break
      case 'electric':
        this.createElectricExplosion(x, y, radius)
        break
      default:
        this.createNormalExplosion(x, y, radius)
    }
  }

  private createNormalExplosion(x: number, y: number, radius: number): void {
    // Explosión principal
    const explosion = this.scene.add.circle(x, y, radius, 0xff6600, 0.8)
    
    // Partículas de fuego
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const distance = radius * (0.5 + Math.random() * 0.5)
      const particleX = x + Math.cos(angle) * distance
      const particleY = y + Math.sin(angle) * distance
      
      const particle = this.scene.add.circle(particleX, particleY, 3 + Math.random() * 4, 0xff8844, 0.7)
      
      this.scene.tweens.add({
        targets: particle,
        x: particleX + (Math.cos(angle) * 20),
        y: particleY + (Math.sin(angle) * 20) - 10,
        alpha: 0,
        scale: 0.2,
        duration: 300 + Math.random() * 200,
        onComplete: () => particle.destroy()
      })
    }

    // Animación principal
    this.scene.tweens.add({
      targets: explosion,
      alpha: 0,
      scale: 1.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => explosion.destroy()
    })
  }

  private createFireExplosion(x: number, y: number, radius: number): void {
    // Múltiples ondas de fuego
    for (let wave = 0; wave < 3; wave++) {
      this.scene.time.delayedCall(wave * 50, () => {
        const waveRadius = radius * (0.6 + wave * 0.2)
        const fire = this.scene.add.circle(x, y, waveRadius, 0xff3300, 0.6 - wave * 0.15)
        
        this.scene.tweens.add({
          targets: fire,
          alpha: 0,
          scale: 1.3,
          duration: 300,
          onComplete: () => fire.destroy()
        })
      })
    }
  }

  private createSmokeExplosion(x: number, y: number, radius: number): void {
    // Humo gris
    const smoke = this.scene.add.circle(x, y, radius, 0x666666, 0.4)
    
    this.scene.tweens.add({
      targets: smoke,
      alpha: 0,
      scale: 2.0,
      y: y - 30,
      duration: 800,
      ease: 'Power1',
      onComplete: () => smoke.destroy()
    })
  }

  private createElectricExplosion(x: number, y: number, radius: number): void {
    // Rayos eléctricos
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const endX = x + Math.cos(angle) * radius
      const endY = y + Math.sin(angle) * radius
      
      const lightning = this.scene.add.graphics()
      lightning.lineStyle(2, 0x00ffff, 0.8)
      lightning.beginPath()
      lightning.moveTo(x, y)
      
      // Línea zigzag
      const steps = 5
      for (let step = 1; step <= steps; step++) {
        const progress = step / steps
        const stepX = x + (endX - x) * progress + (Math.random() - 0.5) * 10
        const stepY = y + (endY - y) * progress + (Math.random() - 0.5) * 10
        lightning.lineTo(stepX, stepY)
      }
      
      lightning.strokePath()
      
      this.scene.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 200,
        onComplete: () => lightning.destroy()
      })
    }
  }

  public createMuzzleFlash(x: number, y: number, angle: number): void {
    const flash = this.scene.add.graphics()
    flash.fillStyle(0xffff88, 0.8)
    
    // Forma de llama
    flash.beginPath()
    flash.moveTo(0, 0)
    flash.lineTo(15, -3)
    flash.lineTo(20, 0)
    flash.lineTo(15, 3)
    flash.closePath()
    flash.fillPath()
    
    flash.setPosition(x, y)
    flash.setRotation(angle)
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 100,
      onComplete: () => flash.destroy()
    })
  }

  public createTrailEffect(startX: number, startY: number, endX: number, endY: number, color: number = 0xffaa44): void {
    const trail = this.scene.add.graphics()
    trail.lineStyle(3, color, 0.6)
    trail.lineBetween(startX, startY, endX, endY)
    
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 150,
      onComplete: () => trail.destroy()
    })
  }
}