import Phaser from 'phaser'
import type { PlayerData } from '../types/player'
import type { WeaponType } from '../types/weapons'
import { WEAPON_CONFIG } from '../constants/weapons'

export class HudManager {
  private scene: Phaser.Scene
  private turnText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private weaponText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private winnerText!: Phaser.GameObjects.Text
  private playerHealthBars: Map<string, Phaser.GameObjects.Graphics> = new Map()
  private playerHealthTexts: Map<string, Phaser.GameObjects.Text> = new Map()
  private playerNameTexts: Map<string, Phaser.GameObjects.Text> = new Map()
  private weaponListContainer!: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  public create(players: PlayerData[]): void {
    this.createTurnDisplay()
    this.createTimerDisplay()
    this.createWeaponDisplay()
    this.createMessageDisplay()
    this.createPlayerHealthBars(players)
    this.createWeaponList()
  }

  private createTurnDisplay(): void {
    this.turnText = this.scene.add.text(40, 40, 'Turno: -', {
      fontFamily: 'Arial Bold',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(100)
  }

  private createTimerDisplay(): void {
    this.timerText = this.scene.add.text(40, 75, 'Tiempo: 30s', {
      fontFamily: 'Arial Bold',
      fontSize: '20px',
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(100)
  }

  private createWeaponDisplay(): void {
    this.weaponText = this.scene.add.text(40, 110, 'Arma: Bazooka\nÁngulo: 0° | Potencia: 1.0\nDisparado: No | Munición: ∞', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setDepth(100)
  }

  private createMessageDisplay(): void {
    this.messageText = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height - 60,
      '',
      {
        fontFamily: 'Arial Bold',
        fontSize: '22px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setDepth(100).setVisible(false)
  }

  private createPlayerHealthBars(players: PlayerData[]): void {
    const startX = this.scene.scale.width - 280
    const startY = 40
    const barWidth = 200
    const barHeight = 20
    const spacing = 60

    players.forEach((player, index) => {
      const y = startY + index * spacing
      const nameText = this.scene.add.text(startX, y, player.name, {
        fontFamily: 'Arial Bold',
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(100)
      this.playerNameTexts.set(player.id, nameText)

      const barBg = this.scene.add.graphics()
      barBg.fillStyle(0x333333, 0.8)
      barBg.fillRect(startX, y + 22, barWidth, barHeight)
      barBg.setDepth(99)

      const healthBar = this.scene.add.graphics()
      healthBar.setDepth(100)
      this.playerHealthBars.set(player.id, healthBar)

      const healthText = this.scene.add.text(startX + barWidth / 2, y + 32, '100', {
        fontFamily: 'Arial Bold',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(101)
      this.playerHealthTexts.set(player.id, healthText)

      const colorIndicator = this.scene.add.circle(startX - 15, y + 8, 8, player.color)
      colorIndicator.setStrokeStyle(2, 0xffffff)
      colorIndicator.setDepth(100)

      this.updateHealth(player.id, 100)
    })
  }

  private createWeaponList(): void {
    const startX = 40
    const startY = 200
    this.weaponListContainer = this.scene.add.container(startX, startY)
    this.weaponListContainer.setDepth(100)
    const title = this.scene.add.text(0, 0, '🔫 Arsenal:', {
      fontFamily: 'Arial Bold',
      fontSize: '16px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.weaponListContainer.add(title)
  }

  public updateTurn(playerName: string): void {
    this.turnText.setText('Turno: ' + playerName)
  }

  public updateTimer(remainingMs: number): void {
    const seconds = Math.ceil(remainingMs / 1000)
    this.timerText.setText('Tiempo: ' + seconds + 's')
    if (seconds <= 5) {
      this.timerText.setColor('#ef4444')
      if (seconds <= 3) {
        this.timerText.setScale(1.2)
      }
    } else if (seconds <= 10) {
      this.timerText.setColor('#fbbf24')
      this.timerText.setScale(1)
    } else {
      this.timerText.setColor('#4ade80')
      this.timerText.setScale(1)
    }
  }

  public updateWeapon(angle: string, power: string, shotState: string, weaponName: string, ammo: number): void {
    const ammoStr = ammo === -1 ? '∞' : ammo.toString()
    this.weaponText.setText('Arma: ' + weaponName + '\nÁngulo: ' + angle + '° | Potencia: ' + power + '\nDisparado: ' + shotState + ' | Munición: ' + ammoStr)
  }

  public updateWeaponList(currentWeapon: WeaponType): void {
    this.weaponListContainer.removeAll(true)
    const title = this.scene.add.text(0, 0, '🔫 Arsenal:', {
      fontFamily: 'Arial Bold',
      fontSize: '16px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.weaponListContainer.add(title)
    let yOffset = 25
    Object.entries(WEAPON_CONFIG).forEach(([weaponType, config], index) => {
      const isSelected = weaponType === currentWeapon
      const keyNum = index + 1
      const weaponText = this.scene.add.text(0, yOffset, keyNum + '. ' + config.name + (isSelected ? ' ◄' : ''), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: isSelected ? '#4ade80' : '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
      })
      this.weaponListContainer.add(weaponText)
      yOffset += 20
    })
  }

  public updateHealth(playerId: string, health: number): void {
    const healthBar = this.playerHealthBars.get(playerId)
    const healthText = this.playerHealthTexts.get(playerId)
    if (!healthBar || !healthText) return
    const barWidth = 200
    const barHeight = 20
    const startX = this.scene.scale.width - 280
    const playerIndex = Array.from(this.playerHealthBars.keys()).indexOf(playerId)
    const y = 40 + playerIndex * 60 + 22
    healthBar.clear()
    const healthPercent = Math.max(0, Math.min(100, health)) / 100
    const currentBarWidth = barWidth * healthPercent
    let barColor = 0x4ade80
    if (health <= 30) {
      barColor = 0xef4444
    } else if (health <= 60) {
      barColor = 0xfbbf24
    }
    healthBar.fillStyle(barColor, 1)
    healthBar.fillRect(startX, y, currentBarWidth, barHeight)
    healthText.setText(Math.max(0, health).toString())
  }

  public showMessage(message: string, duration: number = 2000): void {
    this.messageText.setText(message)
    this.messageText.setVisible(true)
    this.messageText.setAlpha(1)
    this.scene.tweens.add({
      targets: this.messageText,
      alpha: 0,
      duration: 500,
      delay: duration - 500,
      onComplete: () => {
        this.messageText.setVisible(false)
      }
    })
  }

  public showWinner(playerName: string): void {
    this.winnerText = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      '🏆 ' + playerName + ' GANA! 🏆',
      {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setDepth(200)
    this.scene.tweens.add({
      targets: this.winnerText,
      scale: 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  public update(): void {}

  public destroy(): void {
    this.playerHealthBars.clear()
    this.playerHealthTexts.clear()
    this.playerNameTexts.clear()
  }
}
