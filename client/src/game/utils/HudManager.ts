import Phaser from 'phaser'
import { UI_CONFIG } from '../constants/ui'
import type { HealthBarUI, HudMessageState } from '../types/ui'
import type { PlayerData } from '../types/player'
import { WEAPON_CONFIG } from '../constants/weapons'
import type { WeaponType } from '../types/weapons'

export class HudManager {
  private scene: Phaser.Scene

  private panel!: Phaser.GameObjects.Rectangle
  private titleText!: Phaser.GameObjects.Text
  private turnText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private weaponText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private winnerText!: Phaser.GameObjects.Text
  private weaponListText!: Phaser.GameObjects.Text

  private healthBars = new Map<string, HealthBarUI>()
  private messageState: HudMessageState | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  public create(players: PlayerData[]): void {
    this.panel = this.scene.add.rectangle(
      UI_CONFIG.PANEL_X,
      UI_CONFIG.PANEL_Y,
      UI_CONFIG.PANEL_WIDTH,
      UI_CONFIG.PANEL_HEIGHT,
      0x111111,
      0.82
    ).setOrigin(0, 0)

    this.panel.setStrokeStyle(2, 0x444444)

    this.titleText = this.scene.add.text(
      UI_CONFIG.PANEL_X + 16,
      UI_CONFIG.PANEL_Y + 12,
      'Worms Web HUD',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
      }
    )

    this.turnText = this.scene.add.text(
      UI_CONFIG.PANEL_X + 16,
      UI_CONFIG.PANEL_Y + 42,
      'Turno actual: -',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffff88',
      }
    )

    this.timerText = this.scene.add.text(
      UI_CONFIG.PANEL_X + 260,
      UI_CONFIG.PANEL_Y + 42,
      'Tiempo: 20.0s',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#88ddff',
      }
    )

    this.weaponText = this.scene.add.text(
      UI_CONFIG.PANEL_X + 16,
      UI_CONFIG.PANEL_Y + 70,
      'Ángulo: - | Potencia: - | Disparó: -',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffdd88',
      }
    )

    this.messageText = this.scene.add.text(
      UI_CONFIG.PANEL_X + 16,
      UI_CONFIG.PANEL_Y + 96,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      }
    )

    this.winnerText = this.scene.add.text(
      this.scene.scale.width / 2,
      60,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '36px',
        color: '#ffff88',
      }
    ).setOrigin(0.5)

    // Weapon selection display
    this.weaponListText = this.scene.add.text(
      this.scene.scale.width - 300,
      UI_CONFIG.PANEL_Y + 100,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#cccccc',
      }
    )

    this.updateWeaponList()

    players.forEach((player, index) => {
      const top = UI_CONFIG.PANEL_Y + 124 + index * 28
      const left = UI_CONFIG.PANEL_X + 16

      const label = this.scene.add.text(left, top, player.name, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      })

      const background = this.scene.add.rectangle(
        left + 120,
        top + 8,
        UI_CONFIG.HEALTH_BAR_WIDTH,
        UI_CONFIG.HEALTH_BAR_HEIGHT,
        0x333333
      ).setOrigin(0, 0.5)

      const fill = this.scene.add.rectangle(
        left + 120,
        top + 8,
        UI_CONFIG.HEALTH_BAR_WIDTH,
        UI_CONFIG.HEALTH_BAR_HEIGHT,
        player.wormColor
      ).setOrigin(0, 0.5)

      const valueText = this.scene.add.text(
        left + 270,
        top - 2,
        '100 HP',
        {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
        }
      )

      this.healthBars.set(player.id, {
        label,
        background,
        fill,
        valueText,
      })
    })
  }

  public updateTurn(playerName: string): void {
    this.turnText.setText(`Turno actual: ${playerName}`)
  }

  public updateTimer(remainingMs: number): void {
    const seconds = Math.max(0, remainingMs) / 1000
    const color =
      seconds <= 5 ? '#ff8888' : seconds <= 10 ? '#ffd166' : '#88ddff'

    this.timerText.setText(`Tiempo: ${seconds.toFixed(1)}s`)
    this.timerText.setColor(color)
  }

  public updateWeapon(angle: string, power: string, hasShot: string, weaponName: string, ammo: number): void {
    const ammoText = ammo === -1 ? '∞' : ammo.toString()
    this.weaponText.setText(
      `${weaponName} (${ammoText}) | Ángulo: ${angle}° | Potencia: ${power} | Disparó: ${hasShot}`
    )
  }

  public updateHealth(playerId: string, health: number): void {
    const bar = this.healthBars.get(playerId)

    if (!bar) {
      return
    }

    const clamped = Phaser.Math.Clamp(health, 0, 100)
    const ratio = clamped / 100

    bar.fill.width = UI_CONFIG.HEALTH_BAR_WIDTH * ratio
    bar.valueText.setText(`${clamped} HP`)
  }

  public updateWeaponList(currentWeapon?: WeaponType): void {
    const weapons = Object.values(WEAPON_CONFIG)
    let weaponListStr = 'ARSENAL:\n'
    
    weapons.forEach((weapon, index) => {
      const number = index + 1
      const weaponType = Object.keys(WEAPON_CONFIG)[index] as WeaponType
      const isSelected = currentWeapon === weaponType
      const prefix = isSelected ? '► ' : `${number}. `
      
      // Obtener munición (esto requiere acceso al WeaponManager, lo haremos simple por ahora)
      const ammoText = weapon.ammo === -1 ? '∞' : weapon.ammo.toString()
      
      weaponListStr += `${prefix}${weapon.name} (${ammoText})\n`
    })

    this.weaponListText.setText(weaponListStr)
    
    // Cambiar color según arma seleccionada
    if (currentWeapon) {
      const weaponData = WEAPON_CONFIG[currentWeapon]
      this.weaponListText.setTint(weaponData.projectileColor)
    }
  }

  public showMessage(text: string): void {
    this.messageText.setText(text)
    this.messageState = {
      text,
      expiresAt: this.scene.time.now + UI_CONFIG.EVENT_MESSAGE_DURATION_MS,
    }
  }

  public update(): void {
    if (this.messageState && this.scene.time.now >= this.messageState.expiresAt) {
      this.messageText.setText('')
      this.messageState = null
    }
  }

  public showWinner(playerName: string): void {
    this.winnerText.setText(`Ganador: ${playerName}`)
  }

  public clearWinner(): void {
    this.winnerText.setText('')
  }

  public destroy(): void {
    this.panel.destroy()
    this.titleText.destroy()
    this.turnText.destroy()
    this.timerText.destroy()
    this.weaponText.destroy()
    this.messageText.destroy()
    this.winnerText.destroy()
    this.weaponListText.destroy()

    this.healthBars.forEach((bar) => {
      bar.label.destroy()
      bar.background.destroy()
      bar.fill.destroy()
      bar.valueText.destroy()
    })

    this.healthBars.clear()
  }
}