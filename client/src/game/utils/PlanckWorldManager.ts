import planck from 'planck-js'
import { PHYSICS_CONFIG } from '../constants/physics'
import { logger } from '../../utils/logger'

class PlanckWorldManager {
  private world: planck.World | null = null

  public createWorld(): planck.World {
    if (this.world) {
      return this.world
    }

    this.world = new planck.World(
      planck.Vec2(PHYSICS_CONFIG.GRAVITY_X, PHYSICS_CONFIG.GRAVITY_Y)
    )

    logger.info('PlanckWorldManager', 'Mundo físico creado')
    return this.world
  }

  public getWorld(): planck.World {
    if (!this.world) {
      throw new Error('El mundo físico no ha sido creado todavía')
    }

    return this.world
  }

  public step(): void {
    if (!this.world) {
      return
    }

    this.world.step(
      PHYSICS_CONFIG.TIME_STEP,
      PHYSICS_CONFIG.VELOCITY_ITERATIONS,
      PHYSICS_CONFIG.POSITION_ITERATIONS
    )
  }

  public destroyWorld(): void {
    this.world = null
    logger.info('PlanckWorldManager', 'Mundo físico destruido')
  }
}

export const planckWorldManager = new PlanckWorldManager()