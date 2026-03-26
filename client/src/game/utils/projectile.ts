import planck from 'planck-js'
import { WEAPON_CONFIG } from '../constants/weapons'
import { pixelsToMeters } from './physics'
import type { WeaponType } from '../types/weapons'

export function createProjectileBody(
  world: planck.World,
  xPixels: number,
  yPixels: number,
  weaponType: WeaponType
): planck.Body {
  const config = WEAPON_CONFIG[weaponType]
  
  const body = world.createBody({
    type: 'dynamic',
    bullet: true,
    position: planck.Vec2(
      pixelsToMeters(xPixels),
      pixelsToMeters(yPixels)
    ),
  })

  body.createFixture({
    shape: planck.Circle(pixelsToMeters(config.projectileSize)),
    density: 1.0,
    restitution: weaponType === 'grenade' ? 0.6 : 0.2,
    friction: weaponType === 'grenade' ? 0.8 : 0.4,
    userData: { type: 'projectile', weaponType },
  })

  return body
}