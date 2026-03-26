import Phaser from 'phaser'
import { COMBAT_CONFIG } from '../constants/combat'
import type { WeaponState } from '../types/combat'
import type { WormDirection } from '../types/worm'
import { WeaponManager } from '../utils/WeaponManager'
import type { WeaponType } from '../types/weapons'

export class WeaponController {
  private state: WeaponState
  private weaponManager: WeaponManager

  constructor() {
    this.state = {
      aimAngleDeg: -45,
      power: COMBAT_CONFIG.DEFAULT_POWER,
      hasShotThisTurn: false,
    }
    this.weaponManager = new WeaponManager()
  }

  public getCurrentWeapon(): WeaponType {
    return this.weaponManager.getCurrentWeapon()
  }

  public getWeaponManager(): WeaponManager {
    return this.weaponManager
  }

  public switchWeapon(weaponType: WeaponType): boolean {
    return this.weaponManager.switchWeapon(weaponType)
  }

  public resetForNewTurn(direction: WormDirection): void {
    this.state.aimAngleDeg = direction === 'right' ? -45 : -135
    this.state.power = COMBAT_CONFIG.DEFAULT_POWER
    this.state.hasShotThisTurn = false
  }

  public aimUp(): void {
    this.state.aimAngleDeg = Math.max(
      this.state.aimAngleDeg - COMBAT_CONFIG.AIM_STEP_DEG,
      this.getMinAngle()
    )
  }

  public aimDown(): void {
    this.state.aimAngleDeg = Math.min(
      this.state.aimAngleDeg + COMBAT_CONFIG.AIM_STEP_DEG,
      this.getMaxAngle()
    )
  }

  public increasePower(): void {
    this.state.power = Math.min(
      COMBAT_CONFIG.MAX_POWER,
      this.state.power + COMBAT_CONFIG.POWER_STEP
    )
  }

  public decreasePower(): void {
    this.state.power = Math.max(
      COMBAT_CONFIG.MIN_POWER,
      this.state.power - COMBAT_CONFIG.POWER_STEP
    )
  }

  public markShot(): boolean {
    if (!this.weaponManager.consumeAmmo()) {
      return false
    }
    this.state.hasShotThisTurn = true
    return true
  }

  public hasShotThisTurn(): boolean {
    return this.state.hasShotThisTurn
  }

  public getAimAngleDeg(): number {
    return this.state.aimAngleDeg
  }

  public getAimAngleRad(): number {
    return Phaser.Math.DegToRad(this.state.aimAngleDeg)
  }

  public getPower(): number {
    return this.state.power
  }

  private getMinAngle(): number {
    return -170
  }

  private getMaxAngle(): number {
    return -10
  }
}