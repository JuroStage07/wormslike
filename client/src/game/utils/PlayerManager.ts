import { logger } from '../../utils/logger'

export interface PlayerData {
  id: string
  name: string
  isReady: boolean
  isHost: boolean
  isConnected: boolean
  color: number
  avatar?: string
  stats?: {
    wins: number
    losses: number
    totalDamage: number
    accuracy: number
  }
}

export class PlayerManager {
  private players: Map<string, PlayerData> = new Map()
  private localPlayerId: string = ''
  private hostPlayerId: string = ''
  private localPlayerName: string = ''

  constructor() {
    this.generateLocalPlayerId()
  }

  public getLocalPlayerName(): string {
    return this.localPlayerName || this.generatePlayerName()
  }

  public setLocalPlayerName(name: string): void {
    this.localPlayerName = name.trim() || this.generatePlayerName()
    // Update the local player entry if it exists
    const local = this.players.get(this.localPlayerId)
    if (local) local.name = this.localPlayerName
  }

  private generateLocalPlayerId(): string {
    this.localPlayerId = 'player_' + Math.random().toString(36).substring(2, 9)
    return this.localPlayerId
  }

  public getLocalPlayerId(): string {
    return this.localPlayerId
  }

  public setLocalPlayerId(id: string): void {
    this.localPlayerId = id
  }

  public addPlayer(playerData: PlayerData): void {
    this.players.set(playerData.id, playerData)
    
    // Si el jugador es marcado como host, actualizar hostPlayerId
    if (playerData.isHost) {
      this.hostPlayerId = playerData.id
      logger.info('PlayerManager', `Host establecido: ${playerData.name} (${playerData.id})`)
    }

    logger.info('PlayerManager', `Jugador añadido: ${playerData.name} (${playerData.id}) - Host: ${playerData.isHost}`)
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId)
    if (player) {
      this.players.delete(playerId)
      logger.info('PlayerManager', `Jugador eliminado: ${player.name} (${playerId})`)

      // Si era el host, asignar nuevo host
      if (playerId === this.hostPlayerId && this.players.size > 0) {
        const newHost = Array.from(this.players.values())[0]
        this.hostPlayerId = newHost.id
        newHost.isHost = true
        logger.info('PlayerManager', `Nuevo host asignado: ${newHost.name}`)
      }
    }
  }

  public updatePlayer(playerId: string, updates: Partial<PlayerData>): void {
    const player = this.players.get(playerId)
    if (player) {
      Object.assign(player, updates)
      logger.info('PlayerManager', `Jugador actualizado: ${player.name}`)
    }
  }

  public getPlayer(playerId: string): PlayerData | undefined {
    return this.players.get(playerId)
  }

  public getAllPlayers(): PlayerData[] {
    return Array.from(this.players.values())
  }

  public getConnectedPlayers(): PlayerData[] {
    return this.getAllPlayers().filter(p => p.isConnected)
  }

  public getReadyPlayers(): PlayerData[] {
    return this.getAllPlayers().filter(p => p.isReady)
  }

  public getHost(): PlayerData | undefined {
    return this.players.get(this.hostPlayerId)
  }

  public isLocalPlayerHost(): boolean {
    return this.localPlayerId === this.hostPlayerId
  }

  public isLocalPlayerReady(): boolean {
    const localPlayer = this.players.get(this.localPlayerId)
    return localPlayer?.isReady || false
  }

  public canStartGame(): boolean {
    const connectedPlayers = this.getConnectedPlayers()
    // Permitir iniciar con 1 jugador (modo single player con bots)
    return connectedPlayers.length >= 1 && 
           connectedPlayers.every(p => p.isReady || p.isHost)
  }

  public addBot(): void {
    if (this.isFull()) {
      logger.warn('PlayerManager', 'No se puede agregar bot: sala llena')
      return
    }

    const botId = 'bot_' + Math.random().toString(36).substring(2, 9)
    const botData: PlayerData = {
      id: botId,
      name: this.generatePlayerName() + ' (Bot)',
      isReady: true, // Los bots siempre están listos
      isHost: false,
      isConnected: true,
      color: this.generatePlayerColor(),
      stats: {
        wins: 0,
        losses: 0,
        totalDamage: 0,
        accuracy: 0
      }
    }

    this.addPlayer(botData)
    logger.info('PlayerManager', `Bot agregado: ${botData.name}`)
  }

  public removeBot(): void {
    // Encontrar el primer bot y eliminarlo
    const bot = this.getAllPlayers().find(p => p.name.includes('(Bot)'))
    if (bot) {
      this.removePlayer(bot.id)
      logger.info('PlayerManager', `Bot eliminado: ${bot.name}`)
    }
  }

  public getBotCount(): number {
    return this.getAllPlayers().filter(p => p.name.includes('(Bot)')).length
  }

  public getHumanPlayerCount(): number {
    return this.getAllPlayers().filter(p => !p.name.includes('(Bot)')).length
  }

  public setPlayerReady(playerId: string, isReady: boolean): void {
    this.updatePlayer(playerId, { isReady })
  }

  public setPlayerConnected(playerId: string, isConnected: boolean): void {
    this.updatePlayer(playerId, { isConnected })
  }

  public generatePlayerName(): string {
    const adjectives = ['Brave', 'Swift', 'Mighty', 'Clever', 'Bold', 'Quick', 'Strong', 'Wise']
    const nouns = ['Worm', 'Warrior', 'Fighter', 'Champion', 'Hero', 'Legend', 'Master', 'Ace']
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const number = Math.floor(Math.random() * 100)
    
    return `${adjective}${noun}${number}`
  }

  public generatePlayerColor(): number {
    const colors = [
      0xff4444, // Rojo
      0x4444ff, // Azul
      0x44ff44, // Verde
      0xffff44, // Amarillo
      0xff44ff, // Magenta
      0x44ffff, // Cian
      0xff8844, // Naranja
      0x8844ff, // Púrpura
    ]
    
    // Evitar colores ya usados
    const usedColors = this.getAllPlayers().map(p => p.color)
    const availableColors = colors.filter(c => !usedColors.includes(c))
    
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)]
    }
    
    // Si todos los colores están usados, usar uno aleatorio
    return colors[Math.floor(Math.random() * colors.length)]
  }

  public clear(): void {
    this.players.clear()
    this.hostPlayerId = ''
    logger.info('PlayerManager', 'Lista de jugadores limpiada')
  }

  public setHost(playerId: string): void {
    // Remover host de todos los jugadores
    this.players.forEach(player => {
      player.isHost = false
    })
    
    // Establecer nuevo host
    const newHost = this.players.get(playerId)
    if (newHost) {
      newHost.isHost = true
      this.hostPlayerId = playerId
      logger.info('PlayerManager', `Nuevo host establecido: ${newHost.name} (${playerId})`)
    }
  }

  public getPlayerCount(): number {
    return this.players.size
  }

  public getMaxPlayers(): number {
    return 8 // Máximo de jugadores por sala
  }

  public isFull(): boolean {
    return this.getPlayerCount() >= this.getMaxPlayers()
  }

  public exportPlayersForGame(): PlayerData[] {
    return this.getConnectedPlayers().map(player => ({
      ...player,
      stats: player.stats || {
        wins: 0,
        losses: 0,
        totalDamage: 0,
        accuracy: 0
      }
    }))
  }
}