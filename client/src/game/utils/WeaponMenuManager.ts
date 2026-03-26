import Phaser from 'phaser'
import { WEAPON_MENU_CONFIG, WEAPON_MENU_ASSETS } from '../constants/weaponMenu'
import { WEAPON_TYPES } from '../constants/weapons'
import type { WeaponType } from '../types/weapons'
import { logger } from '../../utils/logger'

export class WeaponMenuManager {
  private scene: Phaser.Scene
  private isVisible = false
  private container!: Phaser.GameObjects.Container
  private background!: Phaser.GameObjects.Rectangle
  private slots: Phaser.GameObjects.Container[] = []
  private selectedWeapon: WeaponType = WEAPON_TYPES.BAZOOKA
  private onWeaponSelect?: (weapon: WeaponType) => void
  private keyboardHandlers: Array<() => void> = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  public create(onWeaponSelect: (weapon: WeaponType) => void): void {
    this.onWeaponSelect = onWeaponSelect
    
    const centerX = this.scene.scale.width / 2
    const centerY = this.scene.scale.height / 2

    // Contenedor principal
    this.container = this.scene.add.container(centerX, centerY)
    this.container.setDepth(1000)
    this.container.setVisible(false)

    // Fondo del menú
    this.background = this.scene.add.rectangle(
      0, 0,
      WEAPON_MENU_CONFIG.PANEL_WIDTH,
      WEAPON_MENU_CONFIG.PANEL_HEIGHT,
      WEAPON_MENU_CONFIG.BACKGROUND_COLOR,
      0.95
    )
    this.background.setStrokeStyle(3, WEAPON_MENU_CONFIG.BORDER_COLOR)

    // Título
    const title = this.scene.add.text(0, -180, 'SELECCIONAR ARMA', {
      fontFamily: 'Arial Bold',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5)

    // Instrucciones
    const instructions = this.scene.add.text(0, -150, 'M: Cerrar | Click: Seleccionar | 1-8: Teclas rápidas', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cccccc'
    }).setOrigin(0.5)

    this.container.add([this.background, title, instructions])

    this.createWeaponGrid()
    this.setupKeyboardControls()
  }

  private createWeaponGrid(): void {
    const startX = -250
    const startY = -100
    
    // Crear etiquetas F1, F2, etc.
    const f1Label = this.scene.add.text(startX - 40, startY + 20, 'F1', {
      fontFamily: 'Arial Bold',
      fontSize: '18px',
      color: '#ffdd44'
    }).setOrigin(0.5)

    const f2Label = this.scene.add.text(startX - 40, startY + 120, 'F2', {
      fontFamily: 'Arial Bold',
      fontSize: '18px',
      color: '#ffdd44'
    }).setOrigin(0.5)

    this.container.add([f1Label, f2Label])

    // Crear slots F1 (armas principales)
    WEAPON_MENU_ASSETS.F1.forEach((weapon, index) => {
      const x = startX + (index * (WEAPON_MENU_CONFIG.SLOT_SIZE + WEAPON_MENU_CONFIG.SLOT_PADDING))
      const y = startY
      
      const slot = this.createWeaponSlot(weapon, x, y, index + 1)
      this.slots.push(slot)
      this.container.add(slot)
    })

    // Crear slots F2 (armas secundarias)
    WEAPON_MENU_ASSETS.F2.forEach((weapon, index) => {
      const x = startX + (index * (WEAPON_MENU_CONFIG.SLOT_SIZE + WEAPON_MENU_CONFIG.SLOT_PADDING))
      const y = startY + 100
      
      const slot = this.createWeaponSlot(weapon, x, y, index + 1)
      this.slots.push(slot)
      this.container.add(slot)
    })
  }

  private createWeaponSlot(
    weaponData: { key: string; name: string; color: number },
    x: number,
    y: number,
    keyNumber: number
  ): Phaser.GameObjects.Container {
    const slotContainer = this.scene.add.container(x, y)

    // Fondo del slot
    const slotBg = this.scene.add.rectangle(
      0, 0,
      WEAPON_MENU_CONFIG.SLOT_SIZE,
      WEAPON_MENU_CONFIG.SLOT_SIZE,
      0x333333,
      0.8
    )
    slotBg.setStrokeStyle(2, 0x666666)

    // Icono del arma (círculo coloreado por ahora)
    let weaponIcon: Phaser.GameObjects.GameObject
    
    if (weaponData.key === 'empty') {
      weaponIcon = this.scene.add.circle(0, 0, 20, 0x555555, 0.3)
    } else {
      weaponIcon = this.scene.add.circle(0, 0, 25, weaponData.color, 0.8)
      
      // Agregar símbolo según el arma
      let symbol = ''
      switch (weaponData.key) {
        case 'bazooka': symbol = '🚀'; break
        case 'grenade': symbol = '💣'; break
        case 'missile': symbol = '🎯'; break
        case 'cluster_bomb': symbol = '💥'; break
        case 'pistol': symbol = '🔫'; break
        case 'laser': symbol = '⚡'; break
        case 'flame_thrower': symbol = '🔥'; break
      }
      
      const symbolText = this.scene.add.text(0, 0, symbol, {
        fontSize: '20px'
      }).setOrigin(0.5)
      
      slotContainer.add(symbolText)
    }

    // Número de tecla
    const keyText = this.scene.add.text(-30, -30, keyNumber.toString(), {
      fontFamily: 'Arial Bold',
      fontSize: '14px',
      color: '#ffdd44'
    }).setOrigin(0.5)

    // Nombre del arma
    const nameText = this.scene.add.text(0, 45, weaponData.name, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5)

    slotContainer.add([slotBg, weaponIcon, keyText, nameText])

    // Hacer interactivo si no está vacío
    if (weaponData.key !== 'empty') {
      slotContainer.setSize(WEAPON_MENU_CONFIG.SLOT_SIZE, WEAPON_MENU_CONFIG.SLOT_SIZE)
      slotContainer.setInteractive({ useHandCursor: true })

      slotContainer.on('pointerover', () => {
        slotBg.fillColor = WEAPON_MENU_CONFIG.HOVER_COLOR
      })

      slotContainer.on('pointerout', () => {
        const isSelected = this.selectedWeapon === weaponData.key
        slotBg.fillColor = isSelected ? WEAPON_MENU_CONFIG.SELECTED_COLOR : 0x333333
      })

      slotContainer.on('pointerdown', () => {
        this.selectWeapon(weaponData.key as WeaponType)
      })

      // Marcar como seleccionado si es el arma actual
      if (this.selectedWeapon === weaponData.key) {
        slotBg.fillColor = WEAPON_MENU_CONFIG.SELECTED_COLOR
      }
    }

    return slotContainer
  }

  private setupKeyboardControls(): void {
    // Teclas numéricas para selección rápida (solo cuando el menú está visible)
    for (let i = 1; i <= 8; i++) {
      const handler = () => {
        if (this.isVisible) {
          this.selectWeaponByNumber(i)
        }
      }
      
      this.scene.input.keyboard?.on(`keydown-DIGIT${i}`, handler)
      this.keyboardHandlers.push(() => {
        this.scene.input.keyboard?.off(`keydown-DIGIT${i}`, handler)
      })
    }
  }

  private selectWeaponByNumber(number: number): void {
    const weaponKeys = Object.values(WEAPON_TYPES)
    if (number <= weaponKeys.length) {
      const weaponType = weaponKeys[number - 1]
      this.selectWeapon(weaponType)
    }
  }

  private selectWeapon(weaponType: WeaponType): void {
    this.selectedWeapon = weaponType
    this.updateSelection()
    
    if (this.onWeaponSelect) {
      this.onWeaponSelect(weaponType)
    }
    
    this.hide()
  }

  private updateSelection(): void {
    this.slots.forEach((slot, index) => {
      // El slotBg es el primer elemento del container del slot
      const slotBg = slot.list[0] as Phaser.GameObjects.Rectangle
      const weaponData = index < 6 ? WEAPON_MENU_ASSETS.F1[index] : WEAPON_MENU_ASSETS.F2[index - 6]
      
      if (weaponData && weaponData.key === this.selectedWeapon) {
        slotBg.fillColor = WEAPON_MENU_CONFIG.SELECTED_COLOR
      } else {
        slotBg.fillColor = 0x333333
      }
    })
  }

  public show(): void {
    logger.info('WeaponMenuManager', 'Mostrando menú de armas')
    this.isVisible = true
    this.container.setVisible(true)
    this.updateSelection()
    
    // Animación de entrada
    this.container.setScale(0.8)
    this.container.setAlpha(0)
    
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })
  }

  public hide(): void {
    this.isVisible = false
    
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.8,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false)
      }
    })
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  public isMenuVisible(): boolean {
    return this.isVisible
  }

  public destroy(): void {
    // Limpiar event listeners
    this.keyboardHandlers.forEach(cleanup => cleanup())
    this.keyboardHandlers = []
    
    this.container.destroy()
  }
}