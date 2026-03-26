import Phaser from 'phaser'
import { WEAPON_TYPES, WEAPON_CONFIG } from '../constants/weapons'
import type { WeaponType } from '../types/weapons'
import { logger } from '../../utils/logger'

const WEAPON_EMOJIS: Record<string, string> = {
  bazooka:       '🚀',
  grenade:       '💣',
  missile:       '🎯',
  cluster_bomb:  '💥',
  pistol:        '🔫',
  laser:         '⚡',
  flame_thrower: '🔥',
}

export class WeaponMenuManager {
  private scene: Phaser.Scene
  private isVisible = false
  private container!: Phaser.GameObjects.Container
  private selectedWeapon: WeaponType = WEAPON_TYPES.BAZOOKA
  private onWeaponSelect?: (weapon: WeaponType) => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  public create(onWeaponSelect: (weapon: WeaponType) => void): void {
    this.onWeaponSelect = onWeaponSelect

    const cx = 800  // fixed world center X (1600/2)
    const cy = 400  // fixed world center Y (800/2)

    this.container = this.scene.add.container(cx, cy)
    this.container.setDepth(1000)
    this.container.setVisible(false)

    const weapons = Object.values(WEAPON_TYPES)
    const cols = 4
    const slotW = 130
    const slotH = 110
    const gap = 12
    const rows = Math.ceil(weapons.length / cols)
    const panelW = cols * (slotW + gap) + gap
    const panelH = rows * (slotH + gap) + gap + 80

    // Panel background
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x111122, 0.96)
    bg.lineStyle(3, 0x4a90e2, 1)
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16)
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16)
    this.container.add(bg)

    // Title
    const title = this.scene.add.text(0, -panelH / 2 + 28, '⚔️  SELECCIONAR ARMA  ⚔️', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5)
    this.container.add(title)

    const hint = this.scene.add.text(0, -panelH / 2 + 54, 'Click para seleccionar · M para cerrar', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#888888',
    }).setOrigin(0.5)
    this.container.add(hint)

    // Weapon slots
    const startX = -(cols * (slotW + gap) - gap) / 2 + slotW / 2
    const startY = -panelH / 2 + 80 + slotH / 2

    weapons.forEach((weaponType, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (slotW + gap)
      const y = startY + row * (slotH + gap)
      const slot = this.createSlot(weaponType, x, y, slotW, slotH, i + 1)
      this.container.add(slot)
    })
  }

  private createSlot(
    weaponType: WeaponType,
    x: number, y: number,
    w: number, h: number,
    keyNum: number
  ): Phaser.GameObjects.Container {
    const slot = this.scene.add.container(x, y)
    const cfg = WEAPON_CONFIG[weaponType] as any
    const emoji = WEAPON_EMOJIS[weaponType] ?? '❓'
    const isSelected = this.selectedWeapon === weaponType

    const bg = this.scene.add.graphics()
    const drawBg = (hover: boolean, selected: boolean) => {
      bg.clear()
      const fill = selected ? 0x1a4a2a : hover ? 0x2a3a5a : 0x1a1a2e
      const border = selected ? 0x4ade80 : hover ? 0x7ab0f2 : 0x334466
      bg.fillStyle(fill, 1)
      bg.lineStyle(2, border, 1)
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10)
    }
    drawBg(false, isSelected)

    // Key number badge
    const badge = this.scene.add.text(-w / 2 + 8, -h / 2 + 8, keyNum.toString(), {
      fontFamily: 'Arial Bold',
      fontSize: '13px',
      color: '#ffdd44',
    }).setOrigin(0, 0)

    // Big emoji icon
    const icon = this.scene.add.text(0, -10, emoji, {
      fontSize: '38px',
    }).setOrigin(0.5)

    // Weapon name
    const name = this.scene.add.text(0, h / 2 - 22, cfg.name, {
      fontFamily: 'Arial Bold',
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5)

    // Ammo indicator
    const ammoStr = cfg.ammo === -1 ? '∞' : `×${cfg.ammo}`
    const ammo = this.scene.add.text(w / 2 - 8, -h / 2 + 8, ammoStr, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(1, 0)

    slot.add([bg, badge, icon, name, ammo])
    slot.setSize(w, h)
    slot.setInteractive({ useHandCursor: true })

    slot.on('pointerover', () => drawBg(true, this.selectedWeapon === weaponType))
    slot.on('pointerout', () => drawBg(false, this.selectedWeapon === weaponType))
    slot.on('pointerdown', () => {
      this.selectedWeapon = weaponType
      // Redraw all slots
      this.container.destroy()
      this.create(this.onWeaponSelect!)
      if (this.onWeaponSelect) this.onWeaponSelect(weaponType)
      this.hide()
      logger.info('WeaponMenuManager', `Arma seleccionada: ${weaponType}`)
    })

    return slot
  }

  public show(): void {
    this.isVisible = true
    this.container.setVisible(true)
    this.container.setScale(0.85)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: 'Back.easeOut',
    })
  }

  public hide(): void {
    this.isVisible = false
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.85,
      alpha: 0,
      duration: 130,
      ease: 'Power2',
      onComplete: () => this.container.setVisible(false),
    })
  }

  public isMenuVisible(): boolean {
    return this.isVisible
  }

  public destroy(): void {
    this.container.destroy()
  }
}
