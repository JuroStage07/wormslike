import Phaser from 'phaser'
import planck from 'planck-js'
import { COMBAT_CONFIG } from '../constants/combat'
import { GAME_BACKGROUND_COLOR, SCENE_KEYS, GAME_SIZE } from '../../constants/game'
import { MOCK_PLAYERS } from '../constants/players'
import { colyseusService } from '../utils/ColyseusService'
import { logger } from '../../utils/logger'
import type { PongMessage } from '../types/network'
import { planckWorldManager } from '../utils/PlanckWorldManager'
import { metersToPixels, pixelsToMeters } from '../utils/physics'
import { Worm } from '../entities/Worm'
import { TurnManager } from '../utils/TurnManager'
import type { PlayerData } from '../types/player'
import { WeaponController } from '../entities/WeaponController'
import type { ExplosionResult, ProjectileBinding } from '../types/combat'
import { createProjectileBody } from '../utils/projectile'
import { HudManager } from '../utils/HudManager'
import { UI_CONFIG } from '../constants/ui'
import { WEAPON_TYPES, WEAPON_CONFIG } from '../constants/weapons'
import type { WeaponType } from '../types/weapons'
import { AssetManager } from '../utils/AssetManager'
import { WeaponMenuManager } from '../utils/WeaponMenuManager'
import {
  FIXED_MAPS,
  buildHeightMap,
  resolvePlatforms,
  resolveSpawnPoints,
  type FixedMapId
} from '../constants/fixedMaps'

export class GameScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text
  private sessionText!: Phaser.GameObjects.Text

  // Datos del multijugador
  private gameData: any = null
  private localPlayerId: string = ''
  private isMultiplayer: boolean = false

  private world!: planck.World
  private groundBody!: planck.Body
  private mapData: any = null
  private terrainBodies: planck.Body[] = [] // Array de cuerpos de terreno
  private worms = new Map<string, Worm>()
  private turnManager!: TurnManager
  private weaponController!: WeaponController

  private hudManager!: HudManager
  private assetManager!: AssetManager
  private weaponMenuManager!: WeaponMenuManager
  private wormHealthTexts = new Map<string, Phaser.GameObjects.Text>()
  private wormNameTexts = new Map<string, Phaser.GameObjects.Text>()
  private turnEndsAt = 0
  private gameOver = false
  private nextTurnPending = false

  private currentProjectile: ProjectileBinding | null = null
  private activeProjectiles: ProjectileBinding[] = []
  private currentShooter: string | null = null
  private lastShotAt = 0
  private projectileTimeout: Phaser.Time.TimerEvent | null = null
  private aimLine!: Phaser.GameObjects.Graphics

  private resetKey!: Phaser.Input.Keyboard.Key
  private restartKey!: Phaser.Input.Keyboard.Key
  private leftKey!: Phaser.Input.Keyboard.Key
  private rightKey!: Phaser.Input.Keyboard.Key
  private jumpKey!: Phaser.Input.Keyboard.Key
  private aKey!: Phaser.Input.Keyboard.Key
  private dKey!: Phaser.Input.Keyboard.Key
  private enterKey!: Phaser.Input.Keyboard.Key
  private upKey!: Phaser.Input.Keyboard.Key
  private downKey!: Phaser.Input.Keyboard.Key
  private qKey!: Phaser.Input.Keyboard.Key
  private eKey!: Phaser.Input.Keyboard.Key
  private spaceShootKey!: Phaser.Input.Keyboard.Key
  private weapon1Key!: Phaser.Input.Keyboard.Key
  private weapon2Key!: Phaser.Input.Keyboard.Key
  private weapon3Key!: Phaser.Input.Keyboard.Key
  private weapon4Key!: Phaser.Input.Keyboard.Key
  private weapon5Key!: Phaser.Input.Keyboard.Key
  private weapon6Key!: Phaser.Input.Keyboard.Key
  private weapon7Key!: Phaser.Input.Keyboard.Key
  private mKey!: Phaser.Input.Keyboard.Key // Cambio de ESC a M

  constructor() {
    super(SCENE_KEYS.GAME)
  }

  init(data: any): void {
    this.gameData = data.gameData || data || {}
    this.localPlayerId = data.localPlayerId || ''
    this.isMultiplayer = data.isMultiplayer || false
    
    // En modo multijugador, usar el sessionId del servidor
    if (this.isMultiplayer && colyseusService.isConnected()) {
      const room = colyseusService.getRoom()
      if (room) {
        this.localPlayerId = room.sessionId
        logger.info('GameScene', `Usando sessionId del servidor como localPlayerId: ${this.localPlayerId}`)
      }
    }
    
    logger.info('GameScene', `Inicializando juego - LocalPlayer: ${this.localPlayerId}, Multiplayer: ${this.isMultiplayer}`)
    logger.info('GameScene', `Jugadores recibidos: ${JSON.stringify(this.gameData.players)}`)
  }

  create() {
    // Inicializar estado del juego
    this.gameOver = false
    this.nextTurnPending = false
    this.currentProjectile = null
    this.activeProjectiles = []
    this.projectileTimeout = null
    
    this.setupCamera()
    this.createTexts()
    this.createAimLine()
    this.createPhysicsWorld()
    this.createGround()
    this.createPlayersAndWorms()
    this.createWeaponController()
    this.createInput()
    this.createHud()
    this.createAssetManager()
    this.createWeaponMenu()
    this.createWormHealthTexts()
    this.updateTurnUI()
    this.updateWeaponUI()
    this.startTurnTimer()
    this.refreshAllHealthBars()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)

    void this.connectToServer()
  }

  update(): void {
    if (this.gameOver) {
      this.updateWorms()
      this.updateProjectile()
      this.hudManager.update()
      this.updateWormHealthTexts()
      return
    }

    this.handleInput()
    this.stepPhysics()
    this.updateWorms()
    this.updateProjectile()
    this.updateWeaponUI()
    this.updateTurnTimer()
    this.hudManager.update()
    this.updateAimLine()
    this.updateWormHealthTexts()
  }

  private switchWeapon(weaponNumber: number): void {
    const weaponManager = this.weaponController.getWeaponManager()
    const weaponType = weaponManager.getWeaponByNumber(weaponNumber)
    
    if (weaponType && this.weaponController.switchWeapon(weaponType)) {
      const weaponData = WEAPON_CONFIG[weaponType]
      this.hudManager.showMessage(`Arma: ${weaponData.name}`)
      this.hudManager.updateWeaponList(weaponType)
    }
  }

  private updateTurnTimer(): void {
    const remaining = this.getRemainingTurnTime()
    this.hudManager.updateTimer(remaining)

    // Only the active player advances the turn on timeout
    const activePlayer = this.turnManager.getCurrentPlayer()
    const isMyTurn = !this.isMultiplayer || activePlayer.id === this.localPlayerId

    if (remaining <= 0 && !this.currentProjectile && !this.nextTurnPending && isMyTurn) {
      this.hudManager.showMessage('Tiempo agotado')
      this.scheduleNextTurn()
    }
  }

  private setupCamera(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR)
  }

  private createTexts(): void {
    this.add.text(GAME_SIZE.width - 280, 30, 'Worms Web - GameScene', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
    })

    this.statusText = this.add.text(40, 340, 'Estado: conectando...', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#bbbbbb',
    })

    this.sessionText = this.add.text(40, 368, 'SessionId: -', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#bbbbbb',
    })

    this.add.text(
      40,
      400,
      'Mover: A/D o flechas | Salto: W | Apuntar: ↑/↓ | Potencia: Q/E | Disparo: SPACE | Armas: 1-7 o M | Enter: fin turno | F5: reiniciar',
      {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#dddddd',
      }
    )
  }

  private createAimLine(): void {
    this.aimLine = this.add.graphics()
  }

  private createPhysicsWorld(): void {
    this.world = planckWorldManager.createWorld()
    
    // Configurar detección de colisiones
    this.world.on('begin-contact', (contact) => {
      this.handleCollision(contact)
    })

    // Manejar cuando las colisiones terminan
    this.world.on('end-contact', (contact) => {
      this.handleCollisionEnd(contact)
    })
  }

  private createGround(): void {
    const mapId = (this.gameData?.mapId || 'classic') as FixedMapId
    const mapDef = FIXED_MAPS[mapId] || FIXED_MAPS.classic
    const w = GAME_SIZE.width
    const h = GAME_SIZE.height

    logger.info('GameScene', `Cargando mapa fijo: ${mapId}`)

    const heightMap = buildHeightMap(mapDef, w)
    const platforms = resolvePlatforms(mapDef, w)
    const spawnPoints = resolveSpawnPoints(mapDef, w, heightMap)

    this.mapData = { heightMap, platforms, spawnPoints, mapId }

    // Build terrain canvas
    const canvas = this.buildTerrainCanvas(mapDef, w, h, heightMap, platforms)
    if (this.textures.exists('terrain')) this.textures.remove('terrain')
    this.textures.addCanvas('terrain', canvas)

    const terrainSprite = this.add.image(0, 0, 'terrain')
    terrainSprite.setOrigin(0, 0)
    terrainSprite.setDepth(-2)

    this.createTerrainPhysics(heightMap)
    this.createPlatformPhysics(platforms)

    logger.info('GameScene', `Mapa ${mapId} listo con ${platforms.length} plataformas`)
  }

  private buildTerrainCanvas(
    mapDef: typeof FIXED_MAPS[FixedMapId],
    width: number,
    height: number,
    heightMap: number[],
    platforms: Array<{ x: number; y: number; width: number }>
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, mapDef.bgColor)
    sky.addColorStop(1, '#c8e8f0')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    // Terrain fill
    ctx.fillStyle = mapDef.groundColor
    ctx.beginPath()
    ctx.moveTo(0, height)
    for (let x = 0; x < width; x++) {
      ctx.lineTo(x, Math.min(height, heightMap[x]))
    }
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fill()

    // Surface highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const y = heightMap[x]
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Platforms
    platforms.forEach(p => {
      const ph = 14
      ctx.fillStyle = '#7fa07f'
      ctx.fillRect(p.x - p.width / 2, p.y - ph / 2, p.width, ph)
      ctx.fillStyle = '#9fc09f'
      ctx.fillRect(p.x - p.width / 2, p.y - ph / 2, p.width, 3)
      ctx.fillStyle = '#4a6b4a'
      ctx.fillRect(p.x - p.width / 2, p.y + ph / 2 - 2, p.width, 2)
    })

    return canvas
  }

  private createTerrainPhysics(heightMap: number[]): void {
    // Limpiar cuerpos de terreno existentes
    this.clearTerrainPhysics()
    
    // Crear segmentos de terreno basados en el heightMap
    const segmentWidth = 10 // Segmentos más pequeños para mejor precisión
    
    for (let x = 0; x < heightMap.length - segmentWidth; x += segmentWidth) {
      const startY = heightMap[x]
      const endY = heightMap[x + segmentWidth]
      const avgY = (startY + endY) / 2
      
      // Solo crear física si hay terreno en esta área
      if (this.hasTerrainInArea(x, avgY, segmentWidth)) {
        const segmentHeight = GAME_SIZE.height - avgY
        const centerX = x + segmentWidth / 2
        const centerY = avgY + segmentHeight / 2
        
        const terrainBody = this.world.createBody({
          type: 'static',
          position: planck.Vec2(
            pixelsToMeters(centerX),
            pixelsToMeters(centerY)
          ),
        })

        terrainBody.createFixture({
          shape: planck.Box(
            pixelsToMeters(segmentWidth / 2),
            pixelsToMeters(segmentHeight / 2)
          ),
          userData: { type: 'ground', segmentX: x, segmentWidth },
        })
        
        this.terrainBodies.push(terrainBody)
      }
    }
    
    // Mantener referencia al primer cuerpo como groundBody para compatibilidad
    this.groundBody = this.terrainBodies[0] || this.world.createBody({ type: 'static' })
    
    logger.info('GameScene', `Física del terreno creada con ${this.terrainBodies.length} segmentos`)
  }

  private clearTerrainPhysics(): void {
    // Destruir todos los cuerpos de terreno existentes
    this.terrainBodies.forEach(body => {
      this.world.destroyBody(body)
    })
    this.terrainBodies = []
  }

  private hasTerrainInArea(x: number, y: number, width: number): boolean {
    // Verificar si hay terreno visible en esta área usando el canvas
    const terrainTexture = this.textures.get('terrain')
    if (!terrainTexture || !terrainTexture.source || !terrainTexture.source[0]) {
      return true // Si no podemos verificar, asumimos que hay terreno
    }

    const canvas = terrainTexture.source[0].source as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return true

    // Muestrear varios puntos en el área para ver si hay píxeles visibles
    const samples = 5
    for (let i = 0; i < samples; i++) {
      const sampleX = Math.floor(x + (i / (samples - 1)) * width)
      const sampleY = Math.floor(y)
      
      if (sampleX >= 0 && sampleX < canvas.width && sampleY >= 0 && sampleY < canvas.height) {
        const imageData = ctx.getImageData(sampleX, sampleY, 1, 1)
        const alpha = imageData.data[3] // Canal alpha
        
        if (alpha > 0) {
          return true // Hay píxeles visibles
        }
      }
    }
    
    return false // No hay terreno visible en esta área
  }

  private createPlayersAndWorms(): void {
    // Usar datos reales del multijugador si están disponibles
    const players = this.gameData?.players || MOCK_PLAYERS
    
    this.turnManager = new TurnManager(players)

    // Usar spawn points del mapa generado
    let spawnPoints = this.mapData?.spawnPoints || []
    
    // Fallback a posiciones fijas si no hay spawn points
    if (spawnPoints.length < players.length) {
      const groundLevel = GAME_SIZE.height - 100
      spawnPoints = [
        { x: 200, y: groundLevel - 40 },
        { x: GAME_SIZE.width - 200, y: groundLevel - 40 }
      ]
    }

    players.forEach((player: any, index: number) => {
      const position = spawnPoints[index] || spawnPoints[0]

      const worm = new Worm(this, this.world, {
        x: position.x,
        y: position.y,
        color: player.color || player.wormColor || 0xff4444,
        label: player.name.toUpperCase(),
      })

      this.worms.set(player.id, worm)
    })

    this.syncActiveWorm()
    
    logger.info('GameScene', `Gusanos creados para ${players.length} jugadores en spawn points: ${spawnPoints.map((p: any) => `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).join(', ')}`)
  }

  private createWeaponController(): void {
    this.weaponController = new WeaponController()
    const currentPlayer = this.turnManager.getCurrentPlayer()
    const currentWorm = this.worms.get(currentPlayer.id)

    if (!currentWorm) {
      throw new Error('No se encontró worm activo al crear WeaponController')
    }

    this.weaponController.resetForNewTurn(currentWorm.getDirection())
  }

  private createInput(): void {
    const keyboard = this.input.keyboard

    if (!keyboard) {
      throw new Error('No fue posible inicializar el teclado')
    }

    this.resetKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5) // Reiniciar juego
    this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
    this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
    this.jumpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.aKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.dKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    this.qKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    this.eKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.spaceShootKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    
    // Weapon switching keys
    this.weapon1Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    this.weapon2Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    this.weapon3Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)
    this.weapon4Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    this.weapon5Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE)
    this.weapon6Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX)
    this.weapon7Key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN)
    this.mKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M)
  }

  private createHud(): void {
    const players = this.gameData?.players || MOCK_PLAYERS
    this.hudManager = new HudManager(this)
    this.hudManager.create(players)
  }

  private createAssetManager(): void {
    this.assetManager = new AssetManager(this)
  }

  private createWeaponMenu(): void {
    this.weaponMenuManager = new WeaponMenuManager(this)
    this.weaponMenuManager.create((weaponType) => {
      this.weaponController.switchWeapon(weaponType)
      this.updateWeaponUI()
      logger.info('GameScene', `Arma cambiada a: ${weaponType}`)
    })
  }

  private createWormHealthTexts(): void {
    const players = this.gameData?.players || []
    this.worms.forEach((worm, playerId) => {
      const position = worm.getPositionPixels()
      const player = players.find((p: any) => p.id === playerId)
      const playerName = player?.name || playerId

      // Name label above worm
      const nameText = this.add.text(position.x, position.y - 68, playerName, {
        fontFamily: 'Arial Bold',
        fontSize: '14px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(101)
      this.wormNameTexts.set(playerId, nameText)

      // HP number
      const healthText = this.add.text(position.x, position.y - 50, '100', {
        fontFamily: 'Arial Bold',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(100)
      this.wormHealthTexts.set(playerId, healthText)
    })
  }

  private startTurnTimer(): void {
    this.turnEndsAt = this.time.now + UI_CONFIG.TURN_TIME_MS
  }

  private getRemainingTurnTime(): number {
    return Math.max(0, this.turnEndsAt - this.time.now)
  }

  private refreshAllHealthBars(): void {
    this.worms.forEach((worm, playerId) => {
      this.hudManager.updateHealth(playerId, worm.getHealth())
    })
  }

  private handleInput(): void {
    // Si el menú de armas está abierto, solo procesar M
    if (this.weaponMenuManager.isMenuVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
        this.weaponMenuManager.hide()
      }
      return
    }

    const activePlayer = this.turnManager.getCurrentPlayer()
    const activeWorm = this.worms.get(activePlayer.id)

    if (!activeWorm) {
      return
    }

    if (!activeWorm.isAlive()) {
      return
    }

    // En modo multijugador, solo permitir control si es el turno del jugador local
    if (this.isMultiplayer && activePlayer.id !== this.localPlayerId) {
      logger.info('GameScene', `No es el turno del jugador local. Turno actual: ${activePlayer.id}, Local: ${this.localPlayerId}`)
      return
    }

    const canMove = !this.currentProjectile && !this.weaponController.hasShotThisTurn()

    if (canMove) {
      const isMovingLeft = this.leftKey.isDown || this.aKey.isDown
      const isMovingRight = this.rightKey.isDown || this.dKey.isDown

      if (isMovingLeft && !isMovingRight) {
        activeWorm.moveLeft()
      } else if (isMovingRight && !isMovingLeft) {
        activeWorm.moveRight()
      } else {
        activeWorm.stopHorizontalMovement()
      }

      if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) {
        activeWorm.jump()
      }

      // Broadcast position every frame while moving
      if (this.isMultiplayer && colyseusService.isConnected() && (isMovingLeft || isMovingRight)) {
        const pos = activeWorm.getPositionPixels()
        colyseusService.sendPlayerAction('move', {
          x: pos.x,
          y: pos.y,
          playerId: this.localPlayerId
        })
      }
    } else {
      activeWorm.stopHorizontalMovement()
    }

    if (!this.currentProjectile && !this.weaponController.hasShotThisTurn()) {
      if (this.upKey.isDown) {
        this.weaponController.aimUp()
      }

      if (this.downKey.isDown) {
        this.weaponController.aimDown()
      }

      if (this.qKey.isDown) {
        this.weaponController.decreasePower()
      }

      if (this.eKey.isDown) {
        this.weaponController.increasePower()
      }

      if (Phaser.Input.Keyboard.JustDown(this.spaceShootKey)) {
        this.tryShoot(activeWorm)
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.resetActiveWorm(activePlayer)
    }

    // Reiniciar juego completo
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart()
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.enterKey) &&
      !this.currentProjectile &&
      !this.weaponController.hasShotThisTurn() &&
      !this.nextTurnPending
    ) {
      this.scheduleNextTurn(0)
    }

    // Weapon switching
    if (Phaser.Input.Keyboard.JustDown(this.weapon1Key)) {
      this.switchWeapon(1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon2Key)) {
      this.switchWeapon(2)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon3Key)) {
      this.switchWeapon(3)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon4Key)) {
      this.switchWeapon(4)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon5Key)) {
      this.switchWeapon(5)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon6Key)) {
      this.switchWeapon(6)
    }
    if (Phaser.Input.Keyboard.JustDown(this.weapon7Key)) {
      this.switchWeapon(7)
    }

    // Menú de armas con M (solo cuando el menú no está visible)
    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      logger.info('GameScene', 'M presionado - abriendo menú de armas')
      this.weaponMenuManager.show()
    }
  }

  private tryShoot(activeWorm: Worm): void {
    const now = this.time.now

    if (now - this.lastShotAt < COMBAT_CONFIG.SHOT_COOLDOWN_MS) {
      return
    }

    if (this.currentProjectile) {
      return
    }

    if (!this.weaponController.markShot()) {
      this.hudManager.showMessage('Sin munición')
      return
    }

    const currentWeapon = this.weaponController.getCurrentWeapon()
    const weaponData = WEAPON_CONFIG[currentWeapon] as any
    
    // Rastrear quién disparó
    const currentPlayer = this.turnManager.getCurrentPlayer()
    this.currentShooter = currentPlayer.id
    
    // Misil teledirigido requiere selección de objetivo
    if (weaponData.requiresTarget) {
      this.hudManager.showMessage('Haz clic para seleccionar objetivo del misil')
      this.setupMissileTargeting(activeWorm, currentWeapon, weaponData)
      return
    }
    
    this.createProjectiles(activeWorm, currentWeapon, weaponData)
    this.lastShotAt = now

    // Broadcast shoot to other players
    if (this.isMultiplayer && colyseusService.isConnected()) {
      const wormPosition = activeWorm.getPositionPixels()
      const angle = this.weaponController.getAimAngleRad()
      const muzzleDistance = 34
      colyseusService.sendPlayerAction('shoot', {
        x: wormPosition.x + Math.cos(angle) * muzzleDistance,
        y: wormPosition.y + Math.sin(angle) * muzzleDistance,
        angle,
        weaponType: currentWeapon,
        power: this.weaponController.getPower(),
        playerId: this.localPlayerId
      })
    }

    logger.info('GameScene', `Disparo realizado con ${weaponData.name}`)
    this.hudManager.showMessage(`Disparo: ${weaponData.name}`)
  }

  private setupMissileTargeting(activeWorm: Worm, weaponType: WeaponType, weaponData: any): void {
    // Configurar evento de clic para seleccionar objetivo
    const clickHandler = (pointer: Phaser.Input.Pointer) => {
      const targetX = pointer.worldX
      const targetY = pointer.worldY
      
      this.hudManager.showMessage(`Misil dirigido a (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`)
      
      // Crear el misil con objetivo específico
      this.createMissileWithTarget(activeWorm, weaponType, weaponData, targetX, targetY)
      
      // Remover el event listener
      this.input.off('pointerdown', clickHandler)
    }
    
    this.input.once('pointerdown', clickHandler)
  }

  private createMissileWithTarget(activeWorm: Worm, weaponType: WeaponType, weaponData: any, targetX: number, targetY: number): void {
    const wormPosition = activeWorm.getPositionPixels()
    const angle = this.weaponController.getAimAngleRad()
    const muzzleDistance = 34

    const spawnX = wormPosition.x + Math.cos(angle) * muzzleDistance
    const spawnY = wormPosition.y + Math.sin(angle) * muzzleDistance

    this.createSingleProjectile(spawnX, spawnY, angle, weaponType, weaponData, targetX, targetY)
  }

  private createProjectiles(activeWorm: Worm, weaponType: WeaponType, weaponData: any): void {
    const wormPosition = activeWorm.getPositionPixels()
    const angle = this.weaponController.getAimAngleRad()
    const muzzleDistance = 34

    const baseX = wormPosition.x + Math.cos(angle) * muzzleDistance
    const baseY = wormPosition.y + Math.sin(angle) * muzzleDistance

    // Todas las armas disparan un solo proyectil ahora
    this.createSingleProjectile(baseX, baseY, angle, weaponType, weaponData)
  }

  private createSingleProjectile(x: number, y: number, angle: number, weaponType: WeaponType, weaponData: any, targetX?: number, targetY?: number): void {
    // Armas especiales
    if (weaponType === WEAPON_TYPES.LASER) {
      this.fireLaser(x, y, angle, weaponData)
      return
    }

    if (weaponType === WEAPON_TYPES.FLAME_THROWER) {
      this.fireFlamethrower(x, y, angle, weaponData)
      return
    }

    const projectileBody = createProjectileBody(this.world, x, y, weaponType)
    
    const velocity = this.weaponController.getPower() * weaponData.projectileSpeed
    projectileBody.setLinearVelocity(
      planck.Vec2(
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity
      )
    )

    // Usar AssetManager para crear sprite del proyectil
    const projectileGraphic = this.assetManager.createProjectileSprite(
      weaponType, 
      weaponData.projectileSize, 
      weaponData.projectileColor
    )
    projectileGraphic.setPosition(x, y)

    // Crear destello de disparo
    this.assetManager.createMuzzleFlash(x, y, angle)

    const projectile: ProjectileBinding = {
      body: projectileBody,
      graphic: projectileGraphic,
      weaponType,
      createdAt: this.time.now,
      bounceCount: 0,
      trailPoints: [],
      lastTrailTime: 0,
    }

    // Granada con timer
    if (weaponData.hasTimer && weaponData.fuseTime) {
      projectile.fuseTimer = this.time.now + weaponData.fuseTime
    }

    // Misil teledirigido con objetivo específico
    if (weaponData.isGuided && targetX !== undefined && targetY !== undefined) {
      projectile.targetX = targetX
      projectile.targetY = targetY
    }

    this.activeProjectiles.push(projectile)

    // Solo almacenar el primer proyectil como currentProjectile
    if (!this.currentProjectile) {
      this.currentProjectile = projectile

      // Timeout de seguridad
      this.projectileTimeout = this.time.delayedCall(10000, () => {
        if (this.currentProjectile) {
          const pos = this.currentProjectile.body.getPosition()
          const px = metersToPixels(pos.x)
          const py = metersToPixels(pos.y)
          logger.info('GameScene', 'Timeout del proyectil - forzando explosión')
          this.explodeProjectile(px, py)
        }
      })
    }
  }

  private fireLaser(x: number, y: number, angle: number, weaponData: any): void {
    // Láser instantáneo
    const maxDistance = 800
    const endX = x + Math.cos(angle) * maxDistance
    const endY = y + Math.sin(angle) * maxDistance

    // Crear efecto visual del láser
    const laser = this.add.graphics()
    laser.lineStyle(3, weaponData.projectileColor, 0.9)
    laser.lineBetween(x, y, endX, endY)

    // Efecto de brillo
    const glow = this.add.graphics()
    glow.lineStyle(6, weaponData.projectileColor, 0.3)
    glow.lineBetween(x, y, endX, endY)

    // Aplicar daño a worms en la línea (excluyendo al que disparó)
    this.worms.forEach((worm, playerId) => {
      // No dañar al jugador que disparó
      if (playerId === this.currentShooter) {
        return
      }

      const wormPos = worm.getPositionPixels()
      const nearestPoint = Phaser.Geom.Line.GetNearestPoint(
        new Phaser.Geom.Line(x, y, endX, endY),
        new Phaser.Geom.Point(wormPos.x, wormPos.y)
      )

      if (Phaser.Math.Distance.Between(wormPos.x, wormPos.y, nearestPoint.x, nearestPoint.y) < 15) {
        worm.applyDamage(weaponData.damage)
        this.hudManager.updateHealth(playerId, worm.getHealth())
        
        // Efecto eléctrico en el impacto
        this.assetManager.createExplosionEffect(wormPos.x, wormPos.y, 20, 'electric')
        
        logger.info('GameScene', `Láser impacta a ${playerId}: ${weaponData.damage} daño`)
      }
    })

    // Animación de desvanecimiento
    this.tweens.add({
      targets: [laser, glow],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        laser.destroy()
        glow.destroy()
      }
    })

    // Finalizar turno inmediatamente
    this.time.delayedCall(300, () => {
      this.checkWinner()
      if (!this.gameOver) {
        this.scheduleNextTurn(0)
      }
    })
  }

  private fireFlamethrower(x: number, y: number, angle: number, weaponData: any): void {
    const flameCount = weaponData.flameCount || 3
    
    for (let i = 0; i < flameCount; i++) {
      this.time.delayedCall(i * 100, () => {
        const spread = (Math.random() - 0.5) * 0.3
        const flameAngle = angle + spread
        const distance = 60 + Math.random() * 40
        
        const flameX = x + Math.cos(flameAngle) * distance
        const flameY = y + Math.sin(flameAngle) * distance

        // Crear llama
        const flame = this.add.circle(flameX, flameY, 8 + Math.random() * 4, 0xff6600, 0.7)
        
        // Aplicar daño en área pequeña (excluyendo al que disparó)
        this.worms.forEach((worm, playerId) => {
          // No dañar al jugador que disparó
          if (playerId === this.currentShooter) {
            return
          }

          const wormPos = worm.getPositionPixels()
          const dist = Phaser.Math.Distance.Between(flameX, flameY, wormPos.x, wormPos.y)
          
          if (dist < 25) {
            worm.applyDamage(weaponData.damage)
            this.hudManager.updateHealth(playerId, worm.getHealth())
            logger.info('GameScene', `Lanzallamas daña a ${playerId}: ${weaponData.damage}`)
          }
        })

        // Animación de llama
        this.tweens.add({
          targets: flame,
          alpha: 0,
          scale: 1.5,
          y: flameY - 20,
          duration: 500,
          onComplete: () => flame.destroy()
        })
      })
    }

    // Finalizar turno después de todas las llamas
    this.time.delayedCall(1000, () => {
      this.checkWinner()
      if (!this.gameOver) {
        this.scheduleNextTurn(0)
      }
    })
  }

  private handleCollision(contact: planck.Contact): void {
    const fixtureA = contact.getFixtureA()
    const fixtureB = contact.getFixtureB()
    const bodyA = fixtureA.getBody()
    const bodyB = fixtureB.getBody()

    // Manejar colisiones de gusanos con el suelo (cualquier cuerpo de terreno)
    const userDataA = fixtureA.getUserData() as any
    const userDataB = fixtureB.getUserData() as any

    if (userDataA?.type === 'worm' && (bodyB === this.groundBody || this.terrainBodies.includes(bodyB))) {
      userDataA.wormInstance.addGroundContact()
    } else if (userDataB?.type === 'worm' && (bodyA === this.groundBody || this.terrainBodies.includes(bodyA))) {
      userDataB.wormInstance.addGroundContact()
    }

    // Manejar colisiones de proyectiles
    if (!this.currentProjectile) {
      return
    }

    // Verificar si uno de los cuerpos es el proyectil
    const isProjectileCollision = 
      bodyA === this.currentProjectile.body || bodyB === this.currentProjectile.body

    if (isProjectileCollision) {
      const position = this.currentProjectile.body.getPosition()
      const x = metersToPixels(position.x)
      const y = metersToPixels(position.y)
      
      // Identificar qué tipo de colisión ocurrió
      const otherBody = bodyA === this.currentProjectile.body ? bodyB : bodyA
      const otherFixture = bodyA === this.currentProjectile.body ? fixtureB : fixtureA
      
      let collisionType = 'unknown'
      if (otherBody === this.groundBody || this.terrainBodies.includes(otherBody)) {
        collisionType = 'ground'
      } else {
        const userData = otherFixture.getUserData() as any
        if (userData && userData.type === 'worm') {
          collisionType = 'worm'
        } else if (userData && userData.type === 'platform') {
          collisionType = 'platform'
        } else {
          collisionType = 'boundary'
        }
      }
      
      // Granada no explota por colisión, solo por timer
      if (this.currentProjectile.weaponType === WEAPON_TYPES.GRENADE) {
        // Solo incrementar contador de rebotes para la granada
        if (!this.currentProjectile.bounceCount) {
          this.currentProjectile.bounceCount = 0
        }
        this.currentProjectile.bounceCount++
        
        logger.info('GameScene', `Granada rebotó (rebote ${this.currentProjectile.bounceCount}) - tipo: ${collisionType}`)
        return // No explotar, solo rebotar
      }
      
      // Para misil teledirigido, verificar si llegó al objetivo o colisionó con terreno
      const weaponData = WEAPON_CONFIG[this.currentProjectile.weaponType] as any
      if (weaponData.isGuided && this.currentProjectile.targetX && this.currentProjectile.targetY) {
        const distanceToTarget = Phaser.Math.Distance.Between(
          x, y, 
          this.currentProjectile.targetX, 
          this.currentProjectile.targetY
        )
        
        if ((collisionType === 'ground' || collisionType === 'platform') && distanceToTarget > 30) {
          // Misil impactó terreno antes de llegar al objetivo - destruir sin explosión
          logger.info('GameScene', 'Misil teledirigido destruido por impacto con terreno antes de llegar al objetivo')
          this.destroyProjectileWithoutExplosion()
          return
        }
      }
      
      logger.info('GameScene', `Colisión detectada por Planck.js - tipo: ${collisionType} - proyectil explota`)
      
      // Explotar inmediatamente sin delay
      this.explodeProjectile(x, y)
    }
  }

  private handleCollisionEnd(contact: planck.Contact): void {
    const fixtureA = contact.getFixtureA()
    const fixtureB = contact.getFixtureB()
    const bodyA = fixtureA.getBody()
    const bodyB = fixtureB.getBody()

    // Manejar cuando los gusanos dejan de tocar el suelo
    const userDataA = fixtureA.getUserData() as any
    const userDataB = fixtureB.getUserData() as any

    if (userDataA?.type === 'worm' && (bodyB === this.groundBody || this.terrainBodies.includes(bodyB))) {
      userDataA.wormInstance.removeGroundContact()
    } else if (userDataB?.type === 'worm' && (bodyA === this.groundBody || this.terrainBodies.includes(bodyA))) {
      userDataB.wormInstance.removeGroundContact()
    }
  }

  private updateProjectile(): void {
    if (!this.currentProjectile) {
      return
    }

    // Only update the current projectile (activeProjectiles is the same list, avoid double-update)
    this.updateSingleProjectile(this.currentProjectile)
  }

  private updateSingleProjectile(projectile: ProjectileBinding): void {
    const position = projectile.body.getPosition()
    const x = metersToPixels(position.x)
    const y = metersToPixels(position.y)

    projectile.graphic.setPosition(x, y)

    const weaponData = WEAPON_CONFIG[projectile.weaponType] as any

    // Granada con timer y contador visual
    if (projectile.fuseTimer) {
      const timeLeft = Math.max(0, (projectile.fuseTimer - this.time.now) / 1000)
      
      // Mostrar contador sobre la granada
      if (weaponData.showCountdown && projectile.weaponType === WEAPON_TYPES.GRENADE) {
        if (!projectile.countdownText) {
          projectile.countdownText = this.add.text(x, y - 30, '', {
            fontFamily: 'Arial Bold',
            fontSize: '16px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(0.5)
          projectile.countdownText.setDepth(200)
        }
        
        projectile.countdownText.setPosition(x, y - 30)
        projectile.countdownText.setText(Math.ceil(timeLeft).toString())
        
        if (timeLeft <= 1) {
          projectile.countdownText.setColor('#ffffff')
          projectile.countdownText.setScale(1.5)
        }
      }
      
      if (this.time.now >= projectile.fuseTimer) {
        if (projectile.countdownText) {
          projectile.countdownText.destroy()
        }
        this.explodeProjectile(x, y)
        return
      }
    }

    // Misil teledirigido
    if (weaponData.isGuided && projectile.targetX && projectile.targetY) {
      const targetAngle = Phaser.Math.Angle.Between(x, y, projectile.targetX, projectile.targetY)
      const force = weaponData.guidanceForce || 1.0
      
      projectile.body.applyForce(
        planck.Vec2(
          Math.cos(targetAngle) * force,
          Math.sin(targetAngle) * force
        ),
        projectile.body.getPosition()
      )
    }

    // Crear trail si es necesario
    if (weaponData.hasTrail && this.time.now - (projectile.lastTrailTime || 0) > 50) {
      const trailColor = weaponData.trailColor || weaponData.projectileColor
      const prevPoint = projectile.trailPoints?.[0]
      
      if (prevPoint) {
        this.assetManager.createTrailEffect(prevPoint.x, prevPoint.y, x, y, trailColor)
      }
      
      if (!projectile.trailPoints) {
        projectile.trailPoints = []
      }
      projectile.trailPoints = [{ x, y }]
      projectile.lastTrailTime = this.time.now
    }

    // Solo verificar límites de pantalla (fuera de bounds)
    const outOfBounds =
      x < -50 || x > GAME_SIZE.width + 50 || y > GAME_SIZE.height + 50 || y < -50

    if (outOfBounds) {
      logger.info('GameScene', `Proyectil fuera de límites: x=${x.toFixed(1)}, y=${y.toFixed(1)}`)
      if (projectile.countdownText) {
        projectile.countdownText.destroy()
      }
      this.explodeProjectile(x, y)
    }
  }



  private destroyProjectileWithoutExplosion(): void {
    if (!this.currentProjectile) {
      return
    }

    // Limpiar timeout de seguridad
    if (this.projectileTimeout) {
      this.projectileTimeout.destroy()
      this.projectileTimeout = null
    }

    // Limpiar proyectiles activos
    this.activeProjectiles.forEach(projectile => {
      projectile.graphic.destroy()
      this.world.destroyBody(projectile.body)
    })
    this.activeProjectiles = []

    this.currentProjectile.graphic.destroy()
    this.world.destroyBody(this.currentProjectile.body)
    this.currentProjectile = null

    this.hudManager.showMessage('Misil destruido')

    this.checkWinner()

    if (!this.gameOver) {
      this.scheduleNextTurn()
    }
  }

  private explodeProjectile(x: number, y: number): void {
    if (!this.currentProjectile) {
      return
    }

    const weaponType = this.currentProjectile.weaponType
    const weaponData = WEAPON_CONFIG[weaponType] as any

    // Limpiar timeout de seguridad
    if (this.projectileTimeout) {
      this.projectileTimeout.destroy()
      this.projectileTimeout = null
    }

    // Limpiar proyectiles activos
    this.activeProjectiles.forEach(projectile => {
      projectile.graphic.destroy()
      this.world.destroyBody(projectile.body)
    })
    this.activeProjectiles = []

    this.currentProjectile.graphic.destroy()
    this.world.destroyBody(this.currentProjectile.body)
    this.currentProjectile = null

    // Sincronizar destrucción del terreno en modo multijugador
    if (this.isMultiplayer && colyseusService.isConnected()) {
      const currentPlayer = this.turnManager.getCurrentPlayer()
      if (currentPlayer.id === this.localPlayerId) {
        colyseusService.sendPlayerAction('terrain_destroy', {
          x,
          y,
          radius: weaponData.explosionRadius || 50
        })
      }
    }

    // Pistola: daño directo sin explosión
    if (weaponType === WEAPON_TYPES.PISTOL || weaponData.directDamage) {
      this.applyDirectDamage(x, y, weaponData.damage)
      this.hudManager.showMessage('Impacto directo')
    } else {
      // Para armas explosivas, crear efecto visual Y destruir terreno
      this.destroyTerrainAt(x, y, weaponData.explosionRadius)
      
      // Usar AssetManager para efectos de explosión
      const explosionType = weaponData.explosionType || 'normal'
      this.assetManager.createExplosionEffect(x, y, weaponData.explosionRadius, explosionType)
      
      const explosion: ExplosionResult = {
        x,
        y,
        radius: weaponData.explosionRadius,
      }

      this.applyExplosionDamage(explosion, weaponData.damage)
      this.applyExplosionForce(explosion)

      // Bomba racimo: crear sub-explosiones
      if (weaponType === WEAPON_TYPES.CLUSTER_BOMB) {
        this.createClusterExplosions(x, y, weaponData)
      }

      this.hudManager.showMessage('Boom')
    }

    logger.info('GameScene', `Explosión de ${weaponData.name} en (${x.toFixed(1)}, ${y.toFixed(1)})`)

    this.checkWinner()

    if (!this.gameOver) {
      this.scheduleNextTurn()
    }
  }

  private createPlatformPhysics(platforms: Array<{x: number, y: number, width: number}>): void {
    platforms.forEach(platform => {
      const platformBody = this.world.createBody({
        type: 'static',
        position: planck.Vec2(
          pixelsToMeters(platform.x),
          pixelsToMeters(platform.y)
        ),
      })

      platformBody.createFixture({
        shape: planck.Box(
          pixelsToMeters(platform.width / 2),
          pixelsToMeters(7.5) // Altura de plataforma
        ),
        userData: { type: 'platform' },
      })
    })
    
    logger.info('GameScene', `Creadas ${platforms.length} plataformas físicas`)
  }

  private destroyTerrainAt(x: number, y: number, radius: number): void {
    // Actualizar la textura del terreno para mostrar el agujero
    const terrainTexture = this.textures.get('terrain')
    if (terrainTexture && terrainTexture.source && terrainTexture.source[0]) {
      const canvas = terrainTexture.source[0].source as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Crear agujero circular
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        
        // Actualizar la textura
        terrainTexture.source[0].update()
      }
    }
    
    // Actualizar heightMap para futuras colisiones
    if (this.mapData && this.mapData.heightMap) {
      for (let px = Math.max(0, x - radius); px <= Math.min(GAME_SIZE.width - 1, x + radius); px++) {
        for (let py = Math.max(0, y - radius); py <= Math.min(GAME_SIZE.height - 1, y + radius); py++) {
          const distance = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y))
          if (distance <= radius && py > this.mapData.heightMap[Math.floor(px)]) {
            // Actualizar heightMap para reflejar la destrucción
            this.mapData.heightMap[Math.floor(px)] = Math.max(this.mapData.heightMap[Math.floor(px)], py + 10)
          }
        }
      }
    }
    
    // IMPORTANTE: Reconstruir la física del terreno después de la destrucción
    this.rebuildTerrainPhysics()
  }

  private rebuildTerrainPhysics(): void {
    // Reconstruir la física basándose en el estado actual del canvas
    if (!this.mapData || !this.mapData.heightMap) return
    
    // Usar un delay pequeño para asegurar que la textura se haya actualizado
    this.time.delayedCall(50, () => {
      this.createTerrainPhysics(this.mapData.heightMap)
      logger.info('GameScene', 'Física del terreno reconstruida después de la destrucción')
    })
  }

  private createClusterExplosions(x: number, y: number, weaponData: any): void {
    const clusterCount = weaponData.clusterCount || 6
    const clusterRadius = weaponData.clusterRadius || 60
    const clusterDamage = weaponData.clusterDamage || (weaponData.damage * 0.4)

    for (let i = 0; i < clusterCount; i++) {
      const angle = (i / clusterCount) * Math.PI * 2
      const distance = Math.random() * clusterRadius
      const clusterX = x + Math.cos(angle) * distance
      const clusterY = y + Math.sin(angle) * distance

      this.time.delayedCall(100 + i * 50, () => {
        // Destruir terreno en cada sub-explosión
        this.destroyTerrainAt(clusterX, clusterY, 25)
        
        this.assetManager.createExplosionEffect(clusterX, clusterY, 25, 'fire')
        
        const clusterExplosion: ExplosionResult = {
          x: clusterX,
          y: clusterY,
          radius: 25,
        }

        // Cada sub-explosión puede dañar independientemente - permitir múltiples impactos
        this.worms.forEach((worm, playerId) => {
          const position = worm.getPositionPixels()
          const distance = Phaser.Math.Distance.Between(
            clusterExplosion.x,
            clusterExplosion.y,
            position.x,
            position.y
          )

          if (distance <= clusterExplosion.radius) {
            const factor = 1 - distance / clusterExplosion.radius
            const finalDamage = Math.round(clusterDamage * factor)

            if (finalDamage > 0) {
              worm.applyDamage(finalDamage)
              this.hudManager.updateHealth(playerId, worm.getHealth())
              logger.info('GameScene', `Cluster explosion ${i + 1} daña a ${playerId}: ${finalDamage}`)
            }
          }
        })
      })
    }
  }

  private applyDirectDamage(x: number, y: number, damage: number): void {
    let hitTarget = false
    
    this.worms.forEach((worm, playerId) => {
      const position = worm.getPositionPixels()
      const distance = Phaser.Math.Distance.Between(x, y, position.x, position.y)

      // Daño directo solo si está muy cerca (radio pequeño)
      if (distance <= 15) {
        worm.applyDamage(damage)
        this.hudManager.updateHealth(playerId, worm.getHealth())
        hitTarget = true
        logger.info('GameScene', `Daño directo a ${playerId}: ${damage}`)
        
        // Efecto visual de impacto
        this.assetManager.createExplosionEffect(position.x, position.y, 15, 'normal')
      }
    })
    
    if (!hitTarget) {
      logger.info('GameScene', 'Pistola no impactó ningún objetivo')
    }
  }

  private checkWinner(): void {
    const alivePlayers = MOCK_PLAYERS.filter((player) => {
      const worm = this.worms.get(player.id)
      return worm?.isAlive()
    })

    if (alivePlayers.length !== 1) {
      return
    }

    this.gameOver = true
    this.hudManager.showWinner(alivePlayers[0].name)
    this.hudManager.showMessage(`Fin de partida: ${alivePlayers[0].name} gana`)
  }

  private applyExplosionDamage(explosion: ExplosionResult, baseDamage?: number): void {
    const damage = baseDamage || COMBAT_CONFIG.EXPLOSION_DAMAGE
    
    this.worms.forEach((worm, playerId) => {
      const position = worm.getPositionPixels()
      const distance = Phaser.Math.Distance.Between(
        explosion.x,
        explosion.y,
        position.x,
        position.y
      )

      if (distance > explosion.radius) {
        return
      }

      const factor = 1 - distance / explosion.radius
      const finalDamage = Math.round(damage * factor)

      worm.applyDamage(finalDamage)
      this.hudManager.updateHealth(playerId, worm.getHealth())

      // Sincronizar daño en modo multijugador
      if (this.isMultiplayer && colyseusService.isConnected()) {
        const currentPlayer = this.turnManager.getCurrentPlayer()
        if (currentPlayer.id === this.localPlayerId) {
          colyseusService.sendGameStateUpdate({
            type: 'damage',
            playerId: playerId,
            health: worm.getHealth(),
            damage: finalDamage
          })
        }
      }

      logger.info('GameScene', `Daño aplicado a ${playerId}: ${finalDamage}`)
    })
  }

  private applyExplosionForce(explosion: ExplosionResult): void {
    this.worms.forEach((worm) => {
      const body = worm.getBody()
      const position = worm.getPositionPixels()

      const dx = position.x - explosion.x
      const dy = position.y - explosion.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance === 0 || distance > explosion.radius) {
        return
      }

      const nx = dx / distance
      const ny = dy / distance
      const factor = 1 - distance / explosion.radius

      body.applyLinearImpulse(
        planck.Vec2(
          nx * COMBAT_CONFIG.EXPLOSION_FORCE * factor,
          ny * COMBAT_CONFIG.EXPLOSION_FORCE * factor
        ),
        body.getWorldCenter(),
        true
      )
    })
  }

  private resetActiveWorm(player: PlayerData): void {
    const worm = this.worms.get(player.id)

    if (!worm) {
      return
    }

    const resetPosition =
      player.id === 'player-1'
        ? { x: 420, y: 260 }
        : { x: 760, y: 260 }

    worm.resetPosition(resetPosition.x, resetPosition.y)

    logger.info('GameScene', `Worm activo reiniciado: ${player.name}`)
    this.hudManager.showMessage(`Reset de ${player.name}`)
  }

  private scheduleNextTurn(delayMs: number = 300): void {
    if (this.nextTurnPending || this.gameOver) return
    // In multiplayer, only the active player drives turn changes
    if (this.isMultiplayer && this.turnManager.getCurrentPlayer().id !== this.localPlayerId) return
    this.nextTurnPending = true
    this.time.delayedCall(delayMs, () => {
      this.nextTurnPending = false
      this.nextTurn()
    })
  }

  private nextTurn(): void {
    // Usar datos reales del multijugador si están disponibles
    const players = this.gameData?.players || MOCK_PLAYERS
    
    const alivePlayerIds = players.filter((player: any) => {
      const worm = this.worms.get(player.id)
      return worm?.isAlive()
    }).map((player: any) => player.id)

    if (alivePlayerIds.length <= 1) {
      this.checkWinner()
      return
    }

    const currentPlayer = this.turnManager.getCurrentPlayer()
    const currentWorm = this.worms.get(currentPlayer.id)

    currentWorm?.stopAllMovement()

    // Limpiar el shooter actual
    this.currentShooter = null

    const nextPlayer = this.turnManager.nextTurn(alivePlayerIds)
    this.syncActiveWorm()
    this.updateTurnUI()

    const nextWorm = this.worms.get(nextPlayer.id)

    if (!nextWorm) {
      throw new Error('No se encontró el worm del siguiente jugador')
    }

    this.weaponController.resetForNewTurn(nextWorm.getDirection())
    this.startTurnTimer()

    logger.info('GameScene', `Cambio de turno: ${nextPlayer.name}`)
    this.hudManager.showMessage(`Turno de ${nextPlayer.name}`)

    // Sincronizar cambio de turno en modo multijugador
    if (this.isMultiplayer && colyseusService.isConnected() && currentPlayer.id === this.localPlayerId) {
      colyseusService.sendTurnEnd({
        currentPlayerId: currentPlayer.id,
        nextPlayerId: nextPlayer.id
      })
    }
  }

  private syncActiveWorm(): void {
    const currentPlayer = this.turnManager.getCurrentPlayer()

    this.worms.forEach((worm, playerId) => {
      worm.setActive(playerId === currentPlayer.id)
    })
  }

  private updateTurnUI(): void {
    const currentPlayer = this.turnManager.getCurrentPlayer()
    this.hudManager.updateTurn(currentPlayer.name)
  }

  private updateWeaponUI(): void {
    const angle = this.weaponController.getAimAngleDeg().toFixed(0)
    const power = this.weaponController.getPower().toFixed(1)
    const shotState = this.weaponController.hasShotThisTurn() ? 'Sí' : 'No'
    
    const currentWeapon = this.weaponController.getCurrentWeapon()
    const weaponData = WEAPON_CONFIG[currentWeapon]
    const weaponManager = this.weaponController.getWeaponManager()
    const ammo = weaponManager.getAmmo(currentWeapon)

    this.hudManager.updateWeapon(angle, power, shotState, weaponData.name, ammo)
    this.hudManager.updateWeaponList(currentWeapon)
  }

  private updateWorms(): void {
    this.worms.forEach((worm) => {
      worm.update()
    })
  }

  private remoteAimLines = new Map<string, Phaser.GameObjects.Graphics>()
  private lastAimBroadcast = 0

  private updateAimLine(): void {
    this.aimLine.clear()

    if (this.currentProjectile) return

    const currentPlayer = this.turnManager.getCurrentPlayer()
    const activeWorm = this.worms.get(currentPlayer.id)
    if (!activeWorm) return

    const position = activeWorm.getPositionPixels()
    const angle = this.weaponController.getAimAngleRad()
    const length = 50 + this.weaponController.getPower() * 4
    const endX = position.x + Math.cos(angle) * length
    const endY = position.y + Math.sin(angle) * length

    this.aimLine.lineStyle(2, 0xffff88, 0.9)
    this.aimLine.beginPath()
    this.aimLine.moveTo(position.x, position.y)
    this.aimLine.lineTo(endX, endY)
    this.aimLine.strokePath()

    // Broadcast aim to remote players (throttled to ~10fps)
    if (this.isMultiplayer && colyseusService.isConnected() &&
        currentPlayer.id === this.localPlayerId &&
        this.time.now - this.lastAimBroadcast > 100) {
      this.lastAimBroadcast = this.time.now
      colyseusService.sendPlayerAction('aim', {
        x: position.x, y: position.y,
        angle, length,
        playerId: this.localPlayerId
      })
    }
  }

  private drawRemoteAimLine(data: any): void {
    let line = this.remoteAimLines.get(data.playerId)
    if (!line) {
      line = this.add.graphics()
      line.setDepth(50)
      this.remoteAimLines.set(data.playerId, line)
    }
    line.clear()
    if (!this.currentProjectile) {
      const endX = data.x + Math.cos(data.angle) * data.length
      const endY = data.y + Math.sin(data.angle) * data.length
      line.lineStyle(2, 0xff8844, 0.7)
      line.beginPath()
      line.moveTo(data.x, data.y)
      line.lineTo(endX, endY)
      line.strokePath()
    }
  }

  private updateWormHealthTexts(): void {
    this.wormHealthTexts.forEach((healthText, playerId) => {
      const worm = this.worms.get(playerId)
      const nameText = this.wormNameTexts.get(playerId)
      if (worm && worm.isAlive()) {
        const position = worm.getPositionPixels()
        healthText.setPosition(position.x, position.y - 50)
        healthText.setText(worm.getHealth().toString())
        if (nameText) nameText.setPosition(position.x, position.y - 68)

        const health = worm.getHealth()
        if (health > 70) {
          healthText.setColor('#4ade80')
        } else if (health > 30) {
          healthText.setColor('#fbbf24')
        } else {
          healthText.setColor('#ef4444')
        }
      } else {
        healthText.setVisible(false)
        nameText?.setVisible(false)
      }
    })
  }

  private stepPhysics(): void {
    planckWorldManager.step()
  }

  private async connectToServer(): Promise<void> {
    try {
      // Si estamos en modo multijugador, configurar sincronización
      if (this.isMultiplayer && colyseusService.isConnected()) {
        this.setupGameNetworking()
        this.statusText.setText('Estado: sincronización multijugador activa')
        logger.info('GameScene', 'Sincronización de juego configurada')
      } else {
        // Modo original para compatibilidad
        const room = await colyseusService.connectOrCreateRoom()

        this.statusText.setText(`Estado: conectado a room "${room.name}"`)
        this.sessionText.setText(`SessionId: ${room.sessionId}`)

        colyseusService.onPong((message: PongMessage) => {
          logger.info('GameScene', `Pong recibido: ${JSON.stringify(message)}`)
          this.hudManager.showMessage(`Pong recibido (ok: ${String(message.ok)})`)
        })

        colyseusService.sendPing({
          sentAt: Date.now(),
        })
      }
    } catch (error) {
      logger.error('GameScene', `Error al conectar: ${String(error)}`)
      this.statusText.setText('Estado: error de conexión')
      this.hudManager.showMessage('Error: no fue posible conectar al servidor')
    }
  }

  private setupGameNetworking(): void {
    // Configurar eventos de sincronización del juego
    colyseusService.onPlayerAction((data) => {
      this.handleRemotePlayerAction(data)
    })

    colyseusService.onTurnEnd((data) => {
      this.handleRemoteTurnEnd(data)
    })

    colyseusService.onGameStateUpdate((data) => {
      this.handleRemoteGameStateUpdate(data)
    })

    logger.info('GameScene', 'Eventos de red del juego configurados')
  }

  private handleRemotePlayerAction(data: any): void {
    logger.info('GameScene', `Acción remota recibida: ${data.type} de ${data.playerId}`)
    
    switch (data.type) {
      case 'move':
        this.handleRemoteMove(data)
        break
      case 'shoot':
        this.handleRemoteShoot(data)
        break
      case 'terrain_destroy':
        this.handleRemoteTerrainDestroy(data)
        break
      case 'aim':
        this.drawRemoteAimLine(data)
        break
    }
  }

  private handleRemoteMove(data: any): void {
    const worm = this.worms.get(data.playerId)
    if (worm) {
      // Sincronizar posición del worm remoto
      worm.setPosition(data.x, data.y)
    }
  }

  private handleRemoteShoot(data: any): void {
    const weaponData = WEAPON_CONFIG[data.weaponType as WeaponType] as any
    if (!weaponData) return

    // Special weapons
    if (data.weaponType === WEAPON_TYPES.LASER) {
      this.fireLaser(data.x, data.y, data.angle, weaponData)
      return
    }
    if (data.weaponType === WEAPON_TYPES.FLAME_THROWER) {
      this.fireFlamethrower(data.x, data.y, data.angle, weaponData)
      return
    }

    const projectileBody = createProjectileBody(this.world, data.x, data.y, data.weaponType)
    const velocity = (data.power ?? this.weaponController.getPower()) * weaponData.projectileSpeed
    projectileBody.setLinearVelocity(
      planck.Vec2(Math.cos(data.angle) * velocity, Math.sin(data.angle) * velocity)
    )

    const projectileGraphic = this.assetManager.createProjectileSprite(
      data.weaponType, weaponData.projectileSize, weaponData.projectileColor
    )
    projectileGraphic.setPosition(data.x, data.y)
    this.assetManager.createMuzzleFlash(data.x, data.y, data.angle)

    const projectile: ProjectileBinding = {
      body: projectileBody,
      graphic: projectileGraphic,
      weaponType: data.weaponType,
      createdAt: this.time.now,
      bounceCount: 0,
      trailPoints: [],
      lastTrailTime: 0,
    }

    if (weaponData.hasTimer && weaponData.fuseTime) {
      projectile.fuseTimer = this.time.now + weaponData.fuseTime
    }

    this.activeProjectiles.push(projectile)
    if (!this.currentProjectile) {
      this.currentProjectile = projectile
    }
  }

  private handleRemoteTerrainDestroy(data: any): void {
    // Sincronizar destrucción del terreno
    this.destroyTerrainAt(data.x, data.y, data.radius)
    this.rebuildTerrainPhysics()
  }

  private handleRemoteTurnEnd(data: any): void {
    logger.info('GameScene', `Fin de turno remoto de ${data.playerId}`)
    if (data.playerId === this.localPlayerId) return // ignore our own echo

    this.nextTurnPending = false

    if (data.nextPlayerId) {
      this.turnManager.setCurrentPlayer(data.nextPlayerId)
      this.syncActiveWorm()
      this.updateTurnUI()
      const nextWorm = this.worms.get(data.nextPlayerId)
      if (nextWorm) this.weaponController.resetForNewTurn(nextWorm.getDirection())
      this.startTurnTimer()
      this.hudManager.showMessage(`Turno de ${this.turnManager.getCurrentPlayer().name}`)
    }
  }

  private handleRemoteGameStateUpdate(data: any): void {
    logger.info('GameScene', `Actualización de estado remoto: ${JSON.stringify(data)}`)
    
    if (data.type === 'damage') {
      const worm = this.worms.get(data.playerId)
      if (worm) {
        worm.setHealth(data.health)
        this.hudManager.updateHealth(data.playerId, data.health)
      }
    }
  }

  shutdown(): void {
    void colyseusService.leaveRoom()

    if (this.currentProjectile) {
      this.currentProjectile.graphic.destroy()
      this.world.destroyBody(this.currentProjectile.body)
      this.currentProjectile = null
    }

    this.worms.forEach((worm) => {
      worm.destroy()
    })

    this.worms.clear()
    this.aimLine.destroy()
    this.hudManager.destroy()
    this.weaponMenuManager.destroy()
    
    // Limpiar textos de HP y nombres
    this.wormHealthTexts.forEach((text) => { text.destroy() })
    this.wormHealthTexts.clear()
    this.wormNameTexts.forEach((text) => { text.destroy() })
    this.wormNameTexts.clear()
    this.remoteAimLines.forEach((g) => g.destroy())
    this.remoteAimLines.clear()
    
    planckWorldManager.destroyWorld()
  }
}