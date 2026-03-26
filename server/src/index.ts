import { Server } from 'colyseus'
import { createServer } from 'http'
import express from 'express'
import { ROOM_NAMES, SERVER_PORT } from './config/env'
import { BattleRoom } from './rooms/BattleRoom'
import { logger } from './utils/logger'

const app = express()

// CORS para permitir conexiones desde el cliente en producción
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const httpServer = createServer(app)
const gameServer = new Server({ server: httpServer })

gameServer.define(ROOM_NAMES.BATTLE, BattleRoom)
gameServer.define(ROOM_NAMES.PRIVATE_ROOM, BattleRoom)
gameServer.define(ROOM_NAMES.QUICK_MATCH, BattleRoom)

httpServer.listen(SERVER_PORT, () => {
  logger.info('Server', `Servidor escuchando en puerto ${SERVER_PORT}`)
  logger.info('Server', `Salas registradas: ${Object.values(ROOM_NAMES).join(', ')}`)
})