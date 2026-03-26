import Phaser from 'phaser'
import { SCENE_KEYS } from '../../constants/game'
import { logger } from '../../utils/logger'

export class MainMenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text
  private playButton!: Phaser.GameObjects.Container
  private createRoomButton!: Phaser.GameObjects.Container
  private joinRoomButton!: Phaser.GameObjects.Container
  private settingsButton!: Phaser.GameObjects.Container

  constructor() {
    super(SCENE_KEYS.MAIN_MENU)
  }

  create(): void {
    this.createAnimatedBackground()
    this.createTitle()
    this.createMenuButtons()
    this.createFooter()
    this.createParticleEffects()
    
    logger.info('MainMenuScene', 'Menú principal inicializado')
  }

  private createAnimatedBackground(): void {
    // Fondo base con gradiente dinámico
    const graphics = this.add.graphics()
    graphics.fillGradientStyle(0x0a0a1a, 0x1a1a3a, 0x2a2a5a, 0x3a3a7a, 1)
    graphics.fillRect(0, 0, this.scale.width, this.scale.height)
    
    // Capas de fondo animadas
    this.createMovingClouds()
    this.createFloatingIslands()
    this.createStarField()
  }

  private createMovingClouds(): void {
    for (let i = 0; i < 8; i++) {
      const cloud = this.add.graphics()
      const cloudColor = 0x2a4a7a
      const alpha = 0.1 + Math.random() * 0.2
      
      // Crear forma de nube
      cloud.fillStyle(cloudColor, alpha)
      cloud.fillEllipse(0, 0, 150 + Math.random() * 100, 60 + Math.random() * 40)
      cloud.fillEllipse(-30, -10, 80, 50)
      cloud.fillEllipse(30, -5, 90, 45)
      cloud.fillEllipse(-50, 5, 70, 35)
      cloud.fillEllipse(50, 8, 85, 40)
      
      cloud.setPosition(
        -200 + Math.random() * (this.scale.width + 400),
        50 + Math.random() * 200
      )
      
      // Animación de movimiento
      this.tweens.add({
        targets: cloud,
        x: cloud.x + this.scale.width + 400,
        duration: 30000 + Math.random() * 20000,
        repeat: -1,
        ease: 'Linear',
        onRepeat: () => {
          cloud.x = -200
          cloud.y = 50 + Math.random() * 200
        }
      })
    }
  }

  private createFloatingIslands(): void {
    for (let i = 0; i < 5; i++) {
      const island = this.add.graphics()
      const x = Math.random() * this.scale.width
      const y = 300 + Math.random() * 200
      
      // Crear isla flotante
      island.fillStyle(0x2d5a3d, 0.6)
      island.fillEllipse(0, 0, 80 + Math.random() * 60, 30 + Math.random() * 20)
      island.fillStyle(0x4a7c59, 0.4)
      island.fillEllipse(0, -15, 60 + Math.random() * 40, 20)
      
      island.setPosition(x, y)
      
      // Animación flotante
      this.tweens.add({
        targets: island,
        y: y - 20,
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }
  }

  private createStarField(): void {
    for (let i = 0; i < 100; i++) {
      const star = this.add.circle(
        Math.random() * this.scale.width,
        Math.random() * this.scale.height,
        0.5 + Math.random() * 2,
        0xffffff,
        0.3 + Math.random() * 0.7
      )
      
      // Animación de parpadeo
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }
  }

  private createTitle(): void {
    const centerX = this.scale.width / 2
    
    // Logo principal con efectos espectaculares
    this.titleText = this.add.text(centerX, 120, 'WORMS WEB', {
      fontFamily: 'Arial Black',
      fontSize: '72px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { 
        offsetX: 4, 
        offsetY: 4, 
        color: '#000000', 
        blur: 8, 
        fill: true 
      }
    }).setOrigin(0.5)

    // Efecto de brillo en el título
    const glowEffect = this.add.graphics()
    glowEffect.lineStyle(8, 0x4a90e2, 0.3)
    glowEffect.strokeRect(
      centerX - 280, 85, 560, 70
    )
    glowEffect.setBlendMode(Phaser.BlendModes.ADD)

    // Animación del título - pulsación épica
    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Animación del brillo
    this.tweens.add({
      targets: glowEffect,
      alpha: 0.1,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Subtítulo con animación de escritura
    const subtitle = this.add.text(centerX, 190, '', {
      fontFamily: 'Arial Bold',
      fontSize: '28px',
      color: '#ffdd44',
      shadow: { 
        offsetX: 2, 
        offsetY: 2, 
        color: '#000000', 
        blur: 4, 
        fill: true 
      }
    }).setOrigin(0.5)

    // Efecto de escritura para el subtítulo
    const subtitleText = 'Multijugador Online'
    let currentChar = 0
    
    const typeWriter = this.time.addEvent({
      delay: 100,
      callback: () => {
        subtitle.text = subtitleText.substring(0, currentChar + 1)
        currentChar++
        if (currentChar >= subtitleText.length) {
          typeWriter.destroy()
          
          // Animación de parpadeo al completar
          this.tweens.add({
            targets: subtitle,
            alpha: 0.7,
            duration: 800,
            yoyo: true,
            repeat: 2,
            ease: 'Power2'
          })
        }
      },
      repeat: subtitleText.length - 1
    })

    // Elementos decorativos alrededor del título
    this.createTitleDecorations(centerX)
  }

  private createTitleDecorations(centerX: number): void {
    // Líneas decorativas animadas
    const leftLine = this.add.graphics()
    leftLine.lineStyle(4, 0x4a90e2, 0.8)
    leftLine.lineBetween(centerX - 350, 120, centerX - 300, 120)
    
    const rightLine = this.add.graphics()
    rightLine.lineStyle(4, 0x4a90e2, 0.8)
    rightLine.lineBetween(centerX + 300, 120, centerX + 350, 120)

    // Animación de las líneas
    this.tweens.add({
      targets: [leftLine, rightLine],
      alpha: 0.3,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Iconos de worms decorativos
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const radius = 200
      const x = centerX + Math.cos(angle) * radius
      const y = 120 + Math.sin(angle) * radius * 0.3
      
      const wormIcon = this.add.circle(x, y, 8, 0x4ade80, 0.6)
      
      // Animación orbital
      this.tweens.add({
        targets: wormIcon,
        angle: 360,
        duration: 15000,
        repeat: -1,
        ease: 'Linear'
      })
      
      // Animación de escala
      this.tweens.add({
        targets: wormIcon,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 1000 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }
  }

  private createMenuButtons(): void {
    const centerX = this.scale.width / 2
    let currentY = 320

    // Estilo base para botones mejorado
    const createEnhancedButton = (text: string, y: number, color: number = 0x4a90e2, action: () => void) => {
      // Fondo del botón con gradiente
      const buttonBg = this.add.graphics()
      buttonBg.fillGradientStyle(color, color, color - 0x111111, color - 0x111111, 1)
      buttonBg.fillRoundedRect(-120, -25, 240, 50, 25)
      
      // Borde brillante
      const buttonBorder = this.add.graphics()
      buttonBorder.lineStyle(3, 0xffffff, 0.3)
      buttonBorder.strokeRoundedRect(-120, -25, 240, 50, 25)
      
      // Texto del botón
      const buttonText = this.add.text(0, 0, text, {
        fontFamily: 'Arial Bold',
        fontSize: '24px',
        color: '#ffffff',
        shadow: { 
          offsetX: 2, 
          offsetY: 2, 
          color: '#000000', 
          blur: 4, 
          fill: true 
        }
      }).setOrigin(0.5)
      
      // Contenedor del botón
      const buttonContainer = this.add.container(centerX, y, [buttonBg, buttonBorder, buttonText])
      buttonContainer.setSize(240, 50)
      buttonContainer.setInteractive(new Phaser.Geom.Rectangle(-120, -25, 240, 50), Phaser.Geom.Rectangle.Contains)
      buttonContainer.input!.cursor = 'pointer'
      
      // Efectos hover
      buttonContainer.on('pointerover', () => {
        this.tweens.add({
          targets: buttonContainer,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 200,
          ease: 'Power2'
        })
        
        buttonBg.clear()
        buttonBg.fillGradientStyle(color + 0x222222, color + 0x222222, color, color, 1)
        buttonBg.fillRoundedRect(-120, -25, 240, 50, 25)
      })
      
      buttonContainer.on('pointerout', () => {
        this.tweens.add({
          targets: buttonContainer,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Power2'
        })
        
        buttonBg.clear()
        buttonBg.fillGradientStyle(color, color, color - 0x111111, color - 0x111111, 1)
        buttonBg.fillRoundedRect(-120, -25, 240, 50, 25)
      })
      
      // Efecto de click y acción
      buttonContainer.on('pointerdown', () => {
        this.tweens.add({
          targets: buttonContainer,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 100,
          yoyo: true,
          ease: 'Power2',
          onComplete: () => {
            action()
          }
        })
      })
      
      return buttonContainer
    }

    // Crear botones con diferentes colores y acciones
    this.playButton = createEnhancedButton('🎮 Juego Rápido', currentY, 0x4ade80, () => {
      this.scene.start(SCENE_KEYS.LOBBY, { mode: 'quick' })
    })
    currentY += 80

    this.createRoomButton = createEnhancedButton('🏠 Crear Sala Privada', currentY, 0x4a90e2, () => {
      this.scene.start(SCENE_KEYS.LOBBY, { mode: 'create' })
    })
    currentY += 80

    this.joinRoomButton = createEnhancedButton('🚪 Unirse a Sala', currentY, 0xf59e0b, () => {
      this.scene.start(SCENE_KEYS.LOBBY, { mode: 'join' })
    })
    currentY += 80

    this.settingsButton = createEnhancedButton('⚙️ Configuración', currentY, 0x6b7280, () => {
      logger.info('MainMenuScene', 'Configuración - Por implementar')
    })
    
    // Animación de entrada escalonada
    const buttons = [this.playButton, this.createRoomButton, this.joinRoomButton, this.settingsButton]
    buttons.forEach((button, index) => {
      button.setAlpha(0)
      button.setY(button.y + 50)
      
      this.tweens.add({
        targets: button,
        alpha: 1,
        y: button.y - 50,
        duration: 600,
        delay: index * 150,
        ease: 'Back.easeOut'
      })
    })
  }

  private createFooter(): void {
    const centerX = this.scale.width / 2
    const footerY = this.scale.height - 60
    
    // Información de versión
    const versionText = this.add.text(50, footerY, 'v1.0.0 Beta', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    })
    
    // Créditos
    const creditsText = this.add.text(centerX, footerY, 'Desarrollado con ❤️ usando Phaser 3 & Colyseus', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5)
    
    // Controles
    const controlsText = this.add.text(this.scale.width - 50, footerY, 'WASD: Mover | Espacio: Saltar | Click: Disparar', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(1, 0)
    
    // Animación sutil del footer
    this.tweens.add({
      targets: [versionText, creditsText, controlsText],
      alpha: 0.5,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  private createParticleEffects(): void {
    // Partículas flotantes mágicas
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        Math.random() * this.scale.width,
        Math.random() * this.scale.height,
        2 + Math.random() * 3,
        0x4ade80,
        0.3 + Math.random() * 0.4
      )
      
      // Movimiento flotante
      this.tweens.add({
        targets: particle,
        y: particle.y - 100 - Math.random() * 200,
        duration: 8000 + Math.random() * 4000,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          particle.y = this.scale.height + 50
          particle.x = Math.random() * this.scale.width
        }
      })
      
      // Oscilación horizontal
      this.tweens.add({
        targets: particle,
        x: particle.x + (-50 + Math.random() * 100),
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
      
      // Parpadeo
      this.tweens.add({
        targets: particle,
        alpha: 0.1,
        duration: 1500 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }
    
    // Efecto de lluvia de estrellas ocasional
    this.time.addEvent({
      delay: 10000,
      callback: () => this.createStarShower(),
      loop: true
    })
  }

  private createStarShower(): void {
    for (let i = 0; i < 15; i++) {
      const star = this.add.circle(
        Math.random() * this.scale.width,
        -20,
        1 + Math.random() * 2,
        0xffdd44,
        0.8
      )
      
      this.tweens.add({
        targets: star,
        y: this.scale.height + 50,
        x: star.x + (-100 + Math.random() * 200),
        duration: 3000 + Math.random() * 2000,
        ease: 'Power2',
        onComplete: () => star.destroy()
      })
      
      // Efecto de cola
      const trail = this.add.graphics()
      trail.lineStyle(2, 0xffdd44, 0.5)
      trail.lineBetween(star.x, star.y, star.x, star.y - 20)
      
      this.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 1000,
        onComplete: () => trail.destroy()
      })
    }
  }


}