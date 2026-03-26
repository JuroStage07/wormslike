import { WEAPON_TYPES, WEAPON_CONFIG } from '../constants/weapons'
import type { WeaponType, WeaponData, WeaponState } from '../types/weapons'
import { logger } from '../../utils/logger'

export class WeaponManager {
  private state: WeaponState

  constructor() {
    this.state = {
      currentWeapon: WEAPON_TYPES.BAZOOKA,
      ammoCount: new Map(),
    }

    // Inicializar munición
    Object.values(WEAPON_TYPES).forEach((weaponType) => {
      const config = WEAPON_CONFIG[weaponType]
      this.state.ammoCount.set(weaponType, config.ammo === -1 ? -1 : config.ammo)
    })
  }

  public getCurrentWeapon(): WeaponType {
    return this.state.currentWeapon
  }

  public getCurrentWeaponData(): WeaponData {
    return WEAPON_CONFIG[this.state.currentWeapon]
  }

  public switchWeapon(weaponType: WeaponType): boolean {
    if (!this.hasAmmo(weaponType)) {
      logger.info('WeaponManager', `No hay munición para ${WEAPON_CONFIG[weaponType].name}`)
      return false
    }

    this.state.currentWeapon = weaponType
    logger.info('WeaponManager', `Arma cambiada a: ${WEAPON_CONFIG[weaponType].name}`)
    return true
  }

  public hasAmmo(weaponType: WeaponType): boolean {
    const ammo = this.state.ammoCount.get(weaponType) ?? 0
    return ammo === -1 || ammo > 0
  }

  public getAmmo(weaponType: WeaponType): number {
    return this.state.ammoCount.get(weaponType) ?? 0
  }

  public consumeAmmo(): boolean {
    const currentAmmo = this.state.ammoCount.get(this.state.currentWeapon) ?? 0
    
    if (currentAmmo === -1) {
      return true // Munición infinita
    }

    if (currentAmmo <= 0) {
      return false
    }

    this.state.ammoCount.set(this.state.currentWeapon, currentAmmo - 1)
    return true
  }

  public getAllWeapons(): Array<{ type: WeaponType; data: WeaponData; ammo: number }> {
    return Object.values(WEAPON_TYPES).map((weaponType) => ({
      type: weaponType,
      data: WEAPON_CONFIG[weaponType],
      ammo: this.getAmmo(weaponType),
    }))
  }

  public resetAmmo(): void {
    Object.values(WEAPON_TYPES).forEach((weaponType) => {
      const config = WEAPON_CONFIG[weaponType]
      this.state.ammoCount.set(weaponType, config.ammo === -1 ? -1 : config.ammo)
    })
  }

  public getWeaponByNumber(number: number): WeaponType | null {
    const weapons = Object.values(WEAPON_TYPES)
    if (number >= 1 && number <= weapons.length) {
      return weapons[number - 1]
    }
    return null
  }

  public getWeaponDescription(weaponType: WeaponType): string {
    const config = WEAPON_CONFIG[weaponType]
    const ammo = this.getAmmo(weaponType)
    const ammoText = ammo === -1 ? '∞' : ammo.toString()
    
    return `${config.name} (${ammoText}) - ${config.description}`
  }
}