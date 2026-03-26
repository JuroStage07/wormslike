import Phaser from 'phaser'
import { SCENE_KEYS } from '../../constants/game'
import { colyseusService } from '../utils/ColyseusService'
import { logger } from '../../utils/logger'
import { FIXED_MAPS, type FixedMapId } from '../constants/fixedMaps'

interface LoadingData {
  gameData: any
  localPlayerId: string
  isMultiplayer: boolean
}

export class LoadingScene extends Phaser.Scene {
  private _drawBar!: (progress: number) => void

  private gameData: any
  private localPlayerId: string = ''
  private isMultiplayer: boolean = false

  private statusText!: Phaser.GameObjects.Text
  private playersReadyText!: Phaser.GameObjects.Text
  private playersReady: Set<string> = new Set()
  private totalPlayers: number = 0
  private gameStarted: boolean = false

  constructor() {
    super(SCENE_KEYS.LOADING)
  }

  init(data: LoadingData): void {
    this.gameData = data.gameData
    this.localPlayerId = data.localPlayerId
    this.isMultiplayer = data.isMultiplayer
    this.totalPlayers = this.gameData?.players?.length || 1
    this.gameStarted = false
    this.playersReady = new Set()
  }

  create(): void {
    this.createBackground()
    this.createUI()

    if (!this.isMultiplayer) {
      this.time.delayedCall(800, () => this.launchGame())
      return
    }

    // Mark self as ready and notify server
    this.time.delayedCall(500, () => {
      this.playersReady.add(this.localPlayerId)
      this.updateStatus()

      if (colyseusService.isConnected()) {
        colyseusService.sendPlayerReady()

        colyseusService.onPlayerReady((data) => {
          if (!this.gameStarted) {
            this.playersReady.add(data.playerId)
            this.updateStatus()
            this.checkAllReady()
          }
        })

        colyseusService.onAllPlayersReady(() => {
          if (!this.gameStarted) {
            logger.info('LoadingScene', 'Todos listos - iniciando')
            this.launchGame()
          }
        })
      }

      this.checkAllReady()

      // Safety timeout: start anyway after 8s
      this.time.delayedCall(8000, () => {
        if (!this.gameStarted) {
          logger.warn('LoadingScene', 'Timeout - iniciando sin esperar')
          this.launchGame()
        }
      })
    })
  }

  private createBackground(): void {
    const w = this.scale.width
    const h = this.scale.height

    // Deep space gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x050510, 0x050510, 0x0d1a3a, 0x0d1a3a, 1)
    bg.fillRect(0, 0, w, h)

    // Stars
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = Math.random() < 0.15 ? 2 : 1
      const star = this.add.circle(x, y, r, 0xffffff, 0.4 + Math.random() * 0.6)
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 800 + Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000
      })
    }

    // Animated grid lines
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x1a3a6a, 0.3)
    for (let x = 0; x < w; x += 60) grid.lineBetween(x, 0, x, h)
    for (let y = 0; y < h; y += 60) grid.lineBetween(0, y, w, y)

    this.tweens.add({
      targets: grid,
      alpha: 0.1,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  private createUI(): void {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2
    const mapId = (this.gameData?.mapId || 'classic') as FixedMapId
    const mapData = FIXED_MAPS[mapId] || FIXED_MAPS.classic

    // Glowing title
    this.add.text(cx, cy - 160, 'WORMS WEB', {
      fontFamily: 'Arial Black',
      fontSize: '56px',
      color: '#ffffff',
      stroke: '#4ade80',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#4ade80', blur: 20, fill: true }
    }).setOrigin(0.5)

    // Map preview card
    const cardW = 280
    const cardH = 100
    const card = this.add.graphics()
    card.fillStyle(0x0d2040, 0.9)
    card.lineStyle(2, 0x4a90e2, 1)
    card.fillRoundedRect(cx - cardW / 2, cy - 100, cardW, cardH, 12)
    card.strokeRoundedRect(cx - cardW / 2, cy - 100, cardW, cardH, 12)

    this.add.text(cx, cy - 68, `${mapData.emoji}  ${mapData.name}`, {
      fontFamily: 'Arial Black',
      fontSize: '26px',
      color: '#4ade80'
    }).setOrigin(0.5)

    this.add.text(cx, cy - 38, mapData.description, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa'
    }).setOrigin(0.5)

    // Animated loading bar background
    const barW = 360
    const barH = 14
    const barX = cx - barW / 2
    const barY = cy + 20

    const barBg = this.add.graphics()
    barBg.fillStyle(0x1a2a4a, 1)
    barBg.lineStyle(1, 0x4a90e2, 0.5)
    barBg.fillRoundedRect(barX, barY, barW, barH, 7)
    barBg.strokeRoundedRect(barX, barY, barW, barH, 7)

    const barFill = this.add.graphics()
    const drawBar = (progress: number) => {
      barFill.clear()
      barFill.fillStyle(0x4ade80, 1)
      barFill.fillRoundedRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * progress), barH - 4, 5)
    }
    drawBar(0)

    // Animate bar to ~80% while waiting, then 100% when launching
    this.tweens.add({
      targets: { v: 0 },
      v: 0.8,
      duration: 3000,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => drawBar(tween.getValue() ?? 0)
    })

    // Status text
    this.statusText = this.add.text(cx, cy + 55, 'Preparando batalla...', {
      fontFamily: 'Arial Bold',
      fontSize: '18px',
      color: '#4ade80'
    }).setOrigin(0.5)

    // Players ready counter
    this.playersReadyText = this.add.text(cx, cy + 85, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)

    // Animated dots
    let dots = 0
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4
        if (!this.gameStarted) {
          this.statusText.setText('Preparando batalla' + '.'.repeat(dots))
        }
      }
    })

    // Store bar fill reference for launch animation
    this._drawBar = drawBar
  }

  private updateStatus(): void {
    const count = this.playersReady.size
    const total = this.totalPlayers
    this.playersReadyText.setText(`Jugadores listos: ${count} / ${total}`)
  }

  private checkAllReady(): void {
    if (this.playersReady.size >= this.totalPlayers) {
      this.time.delayedCall(400, () => this.launchGame())
    }
  }

  private launchGame(): void {
    if (this.gameStarted) return
    this.gameStarted = true

    this.statusText.setText('¡Todos listos! Iniciando...')
    this.statusText.setColor('#ffdd44')

    // Fill bar to 100%
    if (this._drawBar) {
      this._drawBar(1)
    }

    this.time.delayedCall(600, () => {
      this.scene.start(SCENE_KEYS.GAME, {
        gameData: this.gameData,
        localPlayerId: this.localPlayerId,
        isMultiplayer: this.isMultiplayer
      })
    })
  }
}
