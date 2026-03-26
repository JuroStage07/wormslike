export const NETWORK_CONFIG = {
  // En producción setea VITE_SERVER_URL en Vercel apuntando a tu Railway URL
  // Ejemplo: wss://tu-app.railway.app
  SERVER_URL: import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2568',
  ROOM_NAME: 'battle',
  PRIVATE_ROOM: 'private_room',
  QUICK_MATCH: 'quick_match',
} as const