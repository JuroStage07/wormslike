import Phaser from 'phaser'
import planck from 'planck-js'
import { WORM_CONFIG } from '../constants/worm'
import { metersToPixels, pixelsToMeters } from '../utils/physics'
import type {
  WormConfigData,
  WormDirection,
  WormGraphics,
  WormPhysics,
  WormState,
} from '../types/worm'

export class Worm {
  private scene: Phaser.Scene
  private physics: WormPhysics
  private graphics: WormGraphics
  private state: WormState
  private labelBaseText: string
  private color: number
  private groundContacts: number = 0 // Contador de contactos con el suelo
  private assetManager: any // Referencia al AssetManager
  private isMoving: boolean = false

  constructor(scene: Phaser.Scene, world: planck.World, config: WormConfigData) {
    this.scene = scene
    this.labelBaseText = config.label
    this.color = config.color

    const body = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(
        pixelsToMeters(config.x),
        pixelsToMeters(config.y)
      ),
      fixedRotation: true,
    })

    body.createFixture({
      shape: planck.Box(
        pixelsToMeters(WORM_CONFIG.WIDTH / 2),
        pixelsToMeters(WORM_CONFIG.HEIGHT / 2)
      ),
      density: 1,
      friction: 0.8,
      restitution: 0.05,
      userData: { type: 'worm', wormInstance: this },
    })

    // Crear sprite animado en lugar de rectángulo simple
    const wormSprite = this.createWormSprite()

    const label = this.scene.add.text(
      config.x,
      config.y - 26,
      this.labelBaseText,
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
      }
    ).setOrigin(0.5)

    const activeMarker = this.scene.add.text(
      config.x,
      config.y - 48,
      '▼',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffff88',
      }
    ).setOrigin(0.5)

    this.physics = { body }
    this.graphics = {
      body: wormSprite,
      label,
      activeMarker,
    }

    this.state = {
      direction: 'right',
      isGrounded: false,
      isActive: false,
      health: 100,
    }

    this.updateVisualState()
  }

  private createWormSprite(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    
    // Cuerpo principal
    const body = this.scene.add.ellipse(0, 0, 32, 20, this.color)
    const colorRGB = Phaser.Display.Color.ColorToRGBA(this.color)
    body.setStrokeStyle(2, Phaser.Display.Color.GetColor32(colorRGB.r, colorRGB.g, colorRGB.b, colorRGB.a) * 0.8)
    
    // Ojos
    const leftEye = this.scene.add.circle(-8, -4, 4, 0xffffff)
    const rightEye = this.scene.add.circle(8, -4, 4, 0xffffff)
    
    // Pupilas que miran en la dirección del movimiento
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

  public update(): void {
    this.syncGraphics()
    this.updateGroundedState()
    this.updateLabel()
    this.updateVisualState()
  }

  public moveLeft(): void {
    const velocity = this.physics.body.getLinearVelocity()
    this.physics.body.setLinearVelocity(
      planck.Vec2(-WORM_CONFIG.MOVE_SPEED, velocity.y)
    )
    this.state.direction = 'left'
    
    if (!this.isMoving) {
      this.isMoving = true
      this.animateMovement()
    }
  }

  public moveRight(): void {
    const velocity = this.physics.body.getLinearVelocity()
    this.physics.body.setLinearVelocity(
      planck.Vec2(WORM_CONFIG.MOVE_SPEED, velocity.y)
    )
    this.state.direction = 'right'
    
    if (!this.isMoving) {
      this.isMoving = true
      this.animateMovement()
    }
  }

  public stopHorizontalMovement(): void {
    const velocity = this.physics.body.getLinearVelocity()
    this.physics.body.setLinearVelocity(planck.Vec2(0, velocity.y))
    
    if (this.isMoving) {
      this.isMoving = false
      this.stopAnimation()
    }
  }

  public stopAllMovement(): void {
    this.physics.body.setLinearVelocity(planck.Vec2(0, 0))
    this.physics.body.setAngularVelocity(0)
  }

  public jump(): void {
    if (!this.state.isGrounded) {
      return
    }

    const velocity = this.physics.body.getLinearVelocity()
    this.physics.body.setLinearVelocity(
      planck.Vec2(velocity.x, -WORM_CONFIG.JUMP_IMPULSE)
    )

    this.state.isGrounded = false
    this.animateJump()
  }

  public resetPosition(x: number, y: number): void {
    this.physics.body.setLinearVelocity(planck.Vec2(0, 0))
    this.physics.body.setAngularVelocity(0)
    this.physics.body.setPosition(
      planck.Vec2(
        pixelsToMeters(x),
        pixelsToMeters(y)
      )
    )
  }

  public setPosition(x: number, y: number): void {
    this.physics.body.setPosition(
      planck.Vec2(
        pixelsToMeters(x),
        pixelsToMeters(y)
      )
    )
  }

  public setHealth(health: number): void {
    this.health = Math.max(0, Math.min(100, health))
  }

  public setActive(isActive: boolean): void {
    this.state.isActive = isActive
    this.updateVisualState()
    this.updateLabel()
  }

  public applyDamage(amount: number): void {
    this.state.health = Math.max(0, this.state.health - amount)
    this.updateLabel()
  }

  public getHealth(): number {
    return this.state.health
  }

  public isAlive(): boolean {
    return this.state.health > 0
  }

  public isActive(): boolean {
    return this.state.isActive
  }

  public getBody(): planck.Body {
    return this.physics.body
  }

  public getDirection(): WormDirection {
    return this.state.direction
  }

  public isGrounded(): boolean {
    return this.state.isGrounded
  }

  public getPositionPixels(): { x: number; y: number } {
    const position = this.physics.body.getPosition()

    return {
      x: metersToPixels(position.x),
      y: metersToPixels(position.y),
    }
  }

  public destroy(): void {
    this.graphics.body.destroy()
    this.graphics.label.destroy()
    this.graphics.activeMarker.destroy()
  }

  private syncGraphics(): void {
    const position = this.physics.body.getPosition()
    const x = metersToPixels(position.x)
    const y = metersToPixels(position.y)

    this.graphics.body.setPosition(x, y)
    this.graphics.label.setPosition(x, y - 26)
    this.graphics.activeMarker.setPosition(x, y - 48)
  }

  public addGroundContact(): void {
    this.groundContacts++
    this.updateGroundedState()
  }

  public removeGroundContact(): void {
    this.groundContacts = Math.max(0, this.groundContacts - 1)
    this.updateGroundedState()
  }

  private updateGroundedState(): void {
    const velocity = this.physics.body.getLinearVelocity()
    const position = this.physics.body.getPosition()
    
    // Detección simple: si está cerca del suelo y no se mueve mucho verticalmente
    const wormY = metersToPixels(position.y)
    const groundLevel = this.scene.scale.height - 60
    const distanceToGround = Math.abs(wormY - (groundLevel - 20))
    
    const verticalAlmostStill = Math.abs(velocity.y) < 0.5
    const nearGround = distanceToGround < 25
    
    // Combinar detección de contactos físicos con detección de posición
    this.state.isGrounded = (this.groundContacts > 0 || nearGround) && verticalAlmostStill
  }

  private updateLabel(): void {
    const directionArrow = this.state.direction === 'left' ? '←' : '→'
    const groundedText = this.state.isGrounded ? 'GROUND' : 'AIR'
    const activeText = this.state.isActive ? 'ACTIVE' : 'WAIT'

    this.graphics.label.setText(
      `${this.labelBaseText} ${this.state.health}HP ${directionArrow} ${groundedText} ${activeText}`
    )
  }

  private animateMovement(): void {
    const wormSprite = this.graphics.body as Phaser.GameObjects.Container
    
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
      rotation: this.state.direction === 'left' ? -0.1 : 0.1,
      duration: 300,
      ease: 'Power2'
    })
  }

  private stopAnimation(): void {
    const wormSprite = this.graphics.body as Phaser.GameObjects.Container
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

  private animateJump(): void {
    const wormSprite = this.graphics.body as Phaser.GameObjects.Container
    
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

  private updateVisualState(): void {
    const wormSprite = this.graphics.body as Phaser.GameObjects.Container
    
    if (!this.isAlive()) {
      wormSprite.setAlpha(0.35)
      this.graphics.activeMarker.setVisible(false)
      return
    }

    // Cambiar el brillo del sprite según el estado
    wormSprite.setAlpha(this.state.isActive ? 1 : 0.75)
    
    // Efecto de brillo para el gusano activo
    if (this.state.isActive) {
      const body = wormSprite.getAt(0) as Phaser.GameObjects.Ellipse
      body.setStrokeStyle(3, 0xffffff)
    } else {
      const body = wormSprite.getAt(0) as Phaser.GameObjects.Ellipse
      const colorRGB = Phaser.Display.Color.ColorToRGBA(this.color)
      body.setStrokeStyle(2, Phaser.Display.Color.GetColor32(colorRGB.r, colorRGB.g, colorRGB.b, colorRGB.a) * 0.8)
    }
    
    this.graphics.activeMarker.setVisible(this.state.isActive)
  }
}