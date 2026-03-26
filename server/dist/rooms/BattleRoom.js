"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleRoom = void 0;
const colyseus_1 = require("colyseus");
const logger_1 = require("../utils/logger");
class BattleRoom extends colyseus_1.Room {
    players = new Map();
    hostId = '';
    roomCode = '';
    isPrivate = false;
    onCreate(options) {
        this.isPrivate = options.isPrivate || false;
        this.roomCode = options.roomCode || this.generateRoomCode();
        // Si es sala privada, usar el código personalizado como roomId
        if (this.isPrivate && options.roomCode) {
            this.roomId = options.roomCode;
        }
        logger_1.logger.info('BattleRoom', `Room creada: ${this.roomId} (Código: ${this.roomCode}, Privada: ${this.isPrivate})`);
        // Configurar mensajes
        this.setupMessageHandlers();
        // Configurar límites de la sala
        this.maxClients = 8;
    }
    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    setupMessageHandlers() {
        // Mensaje de ping existente
        this.onMessage('ping', (client, message) => {
            logger_1.logger.info('BattleRoom', `Ping de ${client.sessionId}: ${JSON.stringify(message)}`);
            client.send('pong', {
                ok: true,
                echo: message ?? null,
            });
        });
        // Mensaje de chat
        this.onMessage('chat_message', (client, data) => {
            const player = this.players.get(client.sessionId);
            if (player) {
                logger_1.logger.info('BattleRoom', `Chat de ${player.name}: ${data.message}`);
                // Reenviar a todos los clientes
                this.broadcast('chat_message', {
                    sender: player.name,
                    message: data.message,
                    timestamp: Date.now()
                });
            }
        });
        // Cambio de estado ready
        this.onMessage('player_ready', (client, data) => {
            const player = this.players.get(client.sessionId);
            if (player) {
                player.isReady = data.isReady;
                logger_1.logger.info('BattleRoom', `${player.name} cambió estado ready: ${data.isReady}`);
                // Notificar cambio de estado a todos
                this.broadcastPlayerUpdate();
            }
        });
        // Iniciar juego (solo host)
        this.onMessage('start_game', (client) => {
            if (client.sessionId === this.hostId && this.canStartGame()) {
                logger_1.logger.info('BattleRoom', 'Iniciando juego...');
                this.broadcast('game_started');
            }
        });
    }
    onJoin(client, options) {
        const playerName = options.playerName || `Player${this.clients.length}`;
        // Si es el primer jugador, es el host
        const isHost = this.players.size === 0;
        if (isHost) {
            this.hostId = client.sessionId;
        }
        const playerState = {
            id: client.sessionId,
            name: playerName,
            isReady: false,
            isHost,
            isConnected: true
        };
        this.players.set(client.sessionId, playerState);
        logger_1.logger.info('BattleRoom', `${playerName} se unió (${client.sessionId}) - Host: ${isHost}`);
        // Enviar información de la sala al cliente
        client.send('room_info', {
            roomCode: this.roomCode,
            isPrivate: this.isPrivate,
            isHost
        });
        // Notificar cambio de jugadores
        this.broadcastPlayerUpdate();
    }
    onLeave(client) {
        const player = this.players.get(client.sessionId);
        if (player) {
            logger_1.logger.info('BattleRoom', `${player.name} salió (${client.sessionId})`);
            this.players.delete(client.sessionId);
            // Si era el host, asignar nuevo host
            if (client.sessionId === this.hostId && this.players.size > 0) {
                const newHost = Array.from(this.players.values())[0];
                this.hostId = newHost.id;
                newHost.isHost = true;
                logger_1.logger.info('BattleRoom', `Nuevo host: ${newHost.name}`);
            }
            // Notificar cambio de jugadores
            this.broadcastPlayerUpdate();
        }
    }
    onDispose() {
        logger_1.logger.info('BattleRoom', `Room ${this.roomId} eliminada`);
    }
    broadcastPlayerUpdate() {
        const playersMap = new Map();
        this.players.forEach((player, id) => {
            playersMap.set(id, player);
        });
        this.broadcast('players_update', playersMap);
    }
    canStartGame() {
        const connectedPlayers = Array.from(this.players.values()).filter(p => p.isConnected);
        return connectedPlayers.length >= 2 &&
            connectedPlayers.every(p => p.isReady || p.isHost);
    }
    // Método para obtener información de la sala
    getRoomInfo() {
        return {
            roomId: this.roomId,
            roomCode: this.roomCode,
            isPrivate: this.isPrivate,
            playerCount: this.players.size,
            maxPlayers: this.maxClients,
            players: Array.from(this.players.values())
        };
    }
}
exports.BattleRoom = BattleRoom;
