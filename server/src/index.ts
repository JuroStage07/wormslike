import { Server } from 'colyseus'
import { ROOM_NAMES, SERVER_PORT } from './config/env'
import { BattleRoom } from './rooms/BattleRoom'
import { logger } from './utils/logger'

const gameServer = new Server()

gameServer.define(ROOM_NAMES.BATTLE, BattleRoom)
gameServer.define(ROOM_NAMES.PRIVATE_ROOM, BattleRoom)
gameServer.define(ROOM_NAMES.QUICK_MATCH, BattleRoom)

gameServer.listen(SERVER_PORT).then(() => {
  logger.info('Server', `Servidor escuchando en puerto ${SERVER_PORT}`)
  logger.info('Server', `Salas: ${Object.values(ROOM_NAMES).join(', ')}`)
}).catch((err: unknown) => {
  logger.error('Server', `Error al iniciar: ${String(err)}`)
})
