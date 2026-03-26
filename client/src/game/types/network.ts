export interface PingMessage {
  sentAt: number
}

export interface PongMessage {
  ok: boolean
  echo: PingMessage | null
}