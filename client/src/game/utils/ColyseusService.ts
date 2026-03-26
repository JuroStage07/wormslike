import { Client, Room } from '@colyseus/sdk'
import { NETWORK_CONFIG } from '../constants/network'
import type { PingMessage, PongMessage } from '../types/network'
import { logger } from '../../utils/logger'

interface RoomOptions {
  roomCode?: string
  playerName?: string
  isPrivate?: boolean
}

interface ChatMessage {
  sender: string
  message: string
  timestamp: number
}

interface PlayerState {
  id: string
  name: string
  isReady: boolean
  isHost: boolean
  isConnected: boolean
}

class ColyseusService {
  private client: Client
  private room: Room | null = null
  private playerName: string = 'Player'
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private gameStartCallback: ((data: { mapId: string }) => void) | null = null

  constructor() {
    this.client = new Client(NETWORK_CONFIG.SERVER_URL)
  }

  public setPlayerName(name: string): void {
    this.playerName = name
  }

  public async connectOrCreateRoom(): Promise<Room> {
    if (this.room) {
      return this.room
    }

    logger.info('ColyseusService', `Conectando a room "${NETWORK_CONFIG.ROOM_NAME}"...`)

    this.room = await this.client.joinOrCreate(NETWORK_CONFIG.ROOM_NAME, {
      playerName: this.playerName
    })

    this.setupRoomEvents()

    logger.info(
      'ColyseusService',
      `Conectado a room "${this.room.name}" con sessionId "${this.room.sessionId}"`
    )

    return this.room
  }

  public async createPrivateRoom(options: RoomOptions = {}): Promise<Room> {
    logger.info('ColyseusService', 'Creando sala privada...')

    this.room = await this.client.create(NETWORK_CONFIG.PRIVATE_ROOM, {
      playerName: options.playerName || this.playerName,
      roomCode: options.roomCode,
      isPrivate: true
    })

    this.setupRoomEvents()

    logger.info('ColyseusService', `Sala privada creada con código: ${this.room.roomId}`)
    return this.room
  }

  public async joinPrivateRoom(roomCode: string, playerName?: string): Promise<Room> {
    logger.info('ColyseusService', `Uniéndose a sala privada: ${roomCode}`)

    this.room = await this.client.joinById(roomCode, {
      playerName: playerName || this.playerName
    })

    this.setupRoomEvents()

    logger.info('ColyseusService', `Conectado a sala privada: ${roomCode}`)
    return this.room
  }

  public async joinQuickMatch(): Promise<Room> {
    logger.info('ColyseusService', 'Buscando partida rápida...')

    this.room = await this.client.joinOrCreate(NETWORK_CONFIG.QUICK_MATCH, {
      playerName: this.playerName
    })

    this.setupRoomEvents()

    logger.info('ColyseusService', 'Conectado a partida rápida')
    return this.room
  }

  private setupRoomEvents(): void {
    if (!this.room) return

    // Eventos de conexión - usar la API correcta de Colyseus
    this.room.onJoin(() => {
      logger.info('ColyseusService', 'Jugador se unió a la sala')
      this.reconnectAttempts = 0
    })

    this.room.onLeave((code: number) => {
      logger.info('ColyseusService', `Jugador salió de la sala (código: ${code})`)
      
      // Intentar reconexión automática si no fue intencional
      if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection()
      }
    })

    this.room.onError((code: number, message?: string) => {
      logger.error('ColyseusService', `Error en la sala: ${code} - ${message}`)
    })

    // Eventos de estado
    this.room.onStateChange((_state: any) => {
      logger.info('ColyseusService', 'Estado de la sala actualizado')
    })

    // Evento de información de sala
    this.room.onMessage('room_info', (data: any) => {
      logger.info('ColyseusService', `Información de sala recibida: ${JSON.stringify(data)}`)
    })

    // CRÍTICO: Configurar evento game_started aquí para que esté disponible inmediatamente
    this.room.onMessage('game_started', (data: any) => {
      logger.info('ColyseusService', 'Recibido game_started del servidor')
      if (this.gameStartCallback) {
        this.gameStartCallback({ mapId: data?.mapId || 'classic' })
      }
    })
  }

  private async attemptReconnection(): Promise<void> {
    this.reconnectAttempts++
    logger.info('ColyseusService', `Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    try {
      await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts))
      
      // Intentar reconectar creando una nueva room
      if (this.room) {
        await this.connectOrCreateRoom()
        logger.info('ColyseusService', 'Reconexión exitosa')
      }
    } catch (error) {
      logger.error('ColyseusService', `Error en reconexión: ${error}`)
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('ColyseusService', 'Máximo de intentos de reconexión alcanzado')
      }
    }
  }

  public getRoom(): Room | null {
    return this.room
  }

  public getRoomCode(): string | null {
    return this.room?.roomId || null
  }

  public isConnected(): boolean {
    return this.room !== null
  }

  // Métodos de chat
  public sendChatMessage(message: string): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar mensaje')
    }

    this.room.send('chat_message', {
      message,
      timestamp: Date.now()
    })
  }

  public onChatMessage(callback: (data: ChatMessage) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar chat')
    }

    this.room.onMessage('chat_message', callback)
  }

  // Métodos de estado de jugador
  public setReady(isReady: boolean): void {
    if (!this.room) {
      throw new Error('No hay room activa para cambiar estado')
    }

    this.room.send('player_ready', { isReady })
  }

  public onPlayerStateChange(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar cambios de estado')
    }

    this.room.onMessage('players_update', callback)
  }

  // Métodos de juego
  public startGame(mapId: string = 'classic'): void {
    if (!this.room) {
      throw new Error('No hay room activa para iniciar juego')
    }

    this.room.send('start_game', { mapId })
  }

  public onGameStart(callback: (data: { mapId: string }) => void): void {
    this.gameStartCallback = callback
  }

  // Métodos de sincronización del juego
  public sendPlayerAction(actionType: string, data: any): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar acción')
    }

    this.room.send('player_action', {
      type: actionType,
      ...data
    })
  }

  public onPlayerAction(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar acciones')
    }

    this.room.onMessage('player_action', callback)
  }

  public sendTurnEnd(data: any): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar fin de turno')
    }

    this.room.send('turn_end', data)
  }

  public onTurnEnd(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar fin de turno')
    }

    this.room.onMessage('turn_end', callback)
  }

  public sendGameStateUpdate(data: any): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar actualización de estado')
    }

    this.room.send('game_state_update', data)
  }

  public onGameStateUpdate(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar actualizaciones de estado')
    }

    this.room.onMessage('game_state_update', callback)
  }

  // Métodos de sincronización de mapa
  public sendMapData(mapData: any): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar datos del mapa')
    }

    this.room.send('map_data', mapData)
  }

  public onMapData(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar datos del mapa')
    }

    this.room.onMessage('map_data', callback)
  }

  public requestMapData(): void {
    if (!this.room) {
      throw new Error('No hay room activa para solicitar datos del mapa')
    }

    this.room.send('request_map_data')
  }

  // Métodos de sincronización de jugadores listos
  public sendPlayerReady(): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar estado listo')
    }

    this.room.send('player_loading_ready')
  }

  public onPlayerReady(callback: (data: any) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar jugadores listos')
    }

    this.room.onMessage('player_loading_ready', callback)
  }

  public onAllPlayersReady(callback: () => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar todos listos')
    }

    this.room.onMessage('all_players_ready', callback)
  }

  // Métodos existentes
  public sendPing(payload: PingMessage): void {
    if (!this.room) {
      throw new Error('No hay room activa para enviar ping')
    }

    this.room.send('ping', payload)
  }

  public onPong(callback: (message: PongMessage) => void): void {
    if (!this.room) {
      throw new Error('No hay room activa para registrar onPong')
    }

    this.room.onMessage('pong', callback)
  }

  public async leaveRoom(): Promise<void> {
    if (!this.room) {
      return
    }

    await this.room.leave()
    logger.info('ColyseusService', 'Room cerrada correctamente')
    this.room = null
  }
}

export const colyseusService = new ColyseusService()