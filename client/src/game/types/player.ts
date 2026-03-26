export interface PlayerData {
  id: string
  name: string
  color: number
  isReady?: boolean
  isHost?: boolean
  isConnected?: boolean
  avatar?: string
  stats?: {
    wins: number
    losses: number
    totalDamage: number
    accuracy: number
  }
}