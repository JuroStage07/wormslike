import { Room, Client } from 'colyseus'
import { logger } from '../utils/logger'

interface RoomOptions {
  playerName?: string
  roomCode?: string
  isPrivate?: boolean
}

interface PlayerState {
  id: string
  name: string
  isReady: boolean
  isHost: boolean
  isConnected: boolean
}

export class BattleRoom extends Room {
  private players: Map<string, PlayerState> = new Map()
  private hostId: string = ''
  private roomCode: string = ''
  private isPrivate: boolean = false
  private mapData: any = null // Datos del mapa sincronizado
  private playersReady: Set<string> = new Set() // Jugadores listos para iniciar

  onCreate(options: RoomOptions): void {
    this.isPrivate = options.isPrivate || false
    this.roomCode = options.roomCode || this.generateRoomCode()
    
    // Si es sala privada, usar el código personalizado como roomId
    if (this.isPrivate && options.roomCode) {
      this.roomId = options.roomCode
    }
    
    logger.info('BattleRoom', `Room creada: ${this.roomId} (Código: ${this.roomCode}, Privada: ${this.isPrivate})`)

    // Configurar mensajes
    this.setupMessageHandlers()
    
    // Configurar límites de la sala
    this.maxClients = 8
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  private setupMessageHandlers(): void {
    // Mensaje de ping existente
    this.onMessage('ping', (client, message) => {
      logger.info('BattleRoom', `Ping de ${client.sessionId}: ${JSON.stringify(message)}`)
      client.send('pong', {
        ok: true,
        echo: message ?? null,
      })
    })

    // Mensaje de chat
    this.onMessage('chat_message', (client, data) => {
      const player = this.players.get(client.sessionId)
      if (player) {
        logger.info('BattleRoom', `Chat de ${player.name}: ${data.message}`)
        
        // Reenviar a todos los clientes
        this.broadcast('chat_message', {
          sender: player.name,
          message: data.message,
          timestamp: Date.now()
        })
      }
    })

    // Cambio de estado ready
    this.onMessage('player_ready', (client, data) => {
      const player = this.players.get(client.sessionId)
      if (player) {
        player.isReady = data.isReady
        logger.info('BattleRoom', `${player.name} cambió estado ready: ${data.isReady}`)
        
        // Notificar cambio de estado a todos
        this.broadcastPlayerUpdate()
      }
    })

    // Iniciar juego (solo host)
    this.onMessage('start_game', (client, data) => {
      if (client.sessionId === this.hostId && this.canStartGame()) {
        const mapId = data?.mapId || 'classic'
        logger.info('BattleRoom', `Iniciando juego con mapa: ${mapId}`)
        this.broadcast('game_started', { mapId })
      }
    })

    // Sincronización del juego
    this.onMessage('player_action', (client, data) => {
      logger.info('BattleRoom', `Acción de ${client.sessionId}: ${data.type}`)
      // Reenviar la acción a todos los otros clientes
      this.broadcast('player_action', {
        playerId: client.sessionId,
        ...data
      }, { except: client })
    })

    this.onMessage('turn_end', (client, data) => {
      logger.info('BattleRoom', `Fin de turno de ${client.sessionId}`)
      // Notificar a todos los clientes sobre el cambio de turno
      this.broadcast('turn_end', {
        playerId: client.sessionId,
        ...data
      })
    })

    this.onMessage('game_state_update', (client, data) => {
      logger.info('BattleRoom', `Actualización de estado de ${client.sessionId}`)
      // Sincronizar estado del juego entre todos los clientes
      this.broadcast('game_state_update', {
        playerId: client.sessionId,
        ...data
      }, { except: client })
    })

    // Sincronización de mapa (solo host puede enviar)
    this.onMessage('map_data', (client, data) => {
      if (client.sessionId === this.hostId) {
        logger.info('BattleRoom', `Host enviando datos del mapa: ${data.preset}`)
        this.mapData = data
        
        // Reenviar datos del mapa a todos los otros clientes
        this.broadcast('map_data', data, { except: client })
      }
    })

    // Solicitar datos del mapa (para clientes que se unen tarde)
    this.onMessage('request_map_data', (client) => {
      if (this.mapData) {
        logger.info('BattleRoom', `Enviando datos del mapa a ${client.sessionId}`)
        client.send('map_data', this.mapData)
      }
    })

    // Sincronización de jugadores listos para iniciar
    this.onMessage('player_loading_ready', (client) => {
      logger.info('BattleRoom', `Jugador ${client.sessionId} está listo para iniciar`)
      this.playersReady.add(client.sessionId)
      
      // Notificar a todos que este jugador está listo
      this.broadcast('player_loading_ready', {
        playerId: client.sessionId
      })
      
      // Verificar si todos están listos
      if (this.playersReady.size >= this.players.size) {
        logger.info('BattleRoom', 'Todos los jugadores están listos - enviando señal de inicio')
        this.broadcast('all_players_ready')
        this.playersReady.clear() // Limpiar para futuras partidas
      }
    })
  }

  onJoin(client: Client, options: RoomOptions): void {
    const playerName = options.playerName || `Player${this.clients.length}`
    
    // Si es el primer jugador, es el host
    const isHost = this.players.size === 0
    if (isHost) {
      this.hostId = client.sessionId
    }

    const playerState: PlayerState = {
      id: client.sessionId,
      name: playerName,
      isReady: false,
      isHost,
      isConnected: true
    }

    this.players.set(client.sessionId, playerState)
    
    logger.info('BattleRoom', `${playerName} se unió (${client.sessionId}) - Host: ${isHost}`)

    // Enviar información de la sala al cliente
    client.send('room_info', {
      roomCode: this.roomCode,
      isPrivate: this.isPrivate,
      isHost
    })

    // Notificar cambio de jugadores inmediatamente
    this.broadcastPlayerUpdate()
  }

  onLeave(client: Client): void {
    const player = this.players.get(client.sessionId)
    if (player) {
      logger.info('BattleRoom', `${player.name} salió (${client.sessionId})`)
      this.players.delete(client.sessionId)

      // Si era el host, asignar nuevo host
      if (client.sessionId === this.hostId && this.players.size > 0) {
        const newHost = Array.from(this.players.values())[0]
        this.hostId = newHost.id
        newHost.isHost = true
        logger.info('BattleRoom', `Nuevo host: ${newHost.name}`)
      }

      // Notificar cambio de jugadores
      this.broadcastPlayerUpdate()
    }
  }

  onDispose(): void {
    logger.info('BattleRoom', `Room ${this.roomId} eliminada`)
  }

  private broadcastPlayerUpdate(): void {
    const playersArray = Array.from(this.players.values())
    
    logger.info('BattleRoom', `Enviando actualización de jugadores: ${playersArray.length} jugadores`)
    
    this.broadcast('players_update', {
      players: playersArray
    })
  }

  private canStartGame(): boolean {
    const connectedPlayers = Array.from(this.players.values()).filter(p => p.isConnected)
    return connectedPlayers.length >= 2 && 
           connectedPlayers.every(p => p.isReady || p.isHost)
  }

  // Método para obtener información de la sala
  public getRoomInfo() {
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      isPrivate: this.isPrivate,
      playerCount: this.players.size,
      maxPlayers: this.maxClients,
      players: Array.from(this.players.values())
    }
  }
}