// URL del servidor Colyseus
// En desarrollo: ws://localhost:2568
// En producción: setea VITE_SERVER_URL en las variables de entorno de Render/Vercel
const DEFAULT_SERVER = import.meta.env.DEV
  ? 'ws://localhost:2568'
  : 'wss://wormslikely.onrender.com'

export const NETWORK_CONFIG = {
  SERVER_URL: (import.meta.env.VITE_SERVER_URL as string) ?? DEFAULT_SERVER,
  ROOM_NAME: 'battle',
  PRIVATE_ROOM: 'private_room',
  QUICK_MATCH: 'quick_match',
} as const