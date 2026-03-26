"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const colyseus_1 = require("colyseus");
const env_1 = require("./config/env");
const BattleRoom_1 = require("./rooms/BattleRoom");
const logger_1 = require("./utils/logger");
const gameServer = new colyseus_1.Server();
// Registrar diferentes tipos de salas
gameServer.define(env_1.ROOM_NAMES.BATTLE, BattleRoom_1.BattleRoom);
gameServer.define(env_1.ROOM_NAMES.PRIVATE_ROOM, BattleRoom_1.BattleRoom);
gameServer.define(env_1.ROOM_NAMES.QUICK_MATCH, BattleRoom_1.BattleRoom);
gameServer.listen(env_1.SERVER_PORT).then(() => {
    logger_1.logger.info('Server', `Servidor HTTP + Colyseus escuchando en http://localhost:${env_1.SERVER_PORT}`);
    logger_1.logger.info('Server', `Salas registradas: ${Object.values(env_1.ROOM_NAMES).join(', ')}`);
}).catch((error) => {
    logger_1.logger.error('Server', `Error al iniciar servidor: ${error}`);
});
