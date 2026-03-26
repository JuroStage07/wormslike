import type { PlayerData } from '../types/player'
import type { TurnState } from '../types/turn'

export class TurnManager {
  private players: PlayerData[]
  private currentIndex: number

  constructor(players: PlayerData[]) {
    if (players.length === 0) {
      throw new Error('TurnManager requiere al menos un jugador')
    }

    this.players = players
    this.currentIndex = 0
  }

  public getCurrentPlayer(): PlayerData {
    return this.players[this.currentIndex]
  }

  public getTurnState(): TurnState {
    return {
      currentPlayerId: this.getCurrentPlayer().id,
      turnNumber: this.currentIndex + 1,
    }
  }

  public nextTurn(allowedPlayerIds?: string[]): PlayerData {
    const allowed = allowedPlayerIds ?? this.players.map((player) => player.id)

    if (allowed.length === 0) {
      throw new Error('No hay jugadores válidos para el siguiente turno')
    }

    let attempts = 0

    do {
      this.currentIndex = (this.currentIndex + 1) % this.players.length
      attempts += 1

      if (allowed.includes(this.players[this.currentIndex].id)) {
        return this.players[this.currentIndex]
      }
    } while (attempts <= this.players.length)

    return this.players[this.currentIndex]
  }

  public getPlayers(): PlayerData[] {
    return this.players
  }

  public setCurrentPlayer(playerId: string): void {
    const index = this.players.findIndex((player) => player.id === playerId)

    if (index === -1) {
      throw new Error(`Jugador no encontrado: ${playerId}`)
    }

    this.currentIndex = index
  }
}