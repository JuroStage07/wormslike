export const SERVER_PORT = Number(process.env.PORT ?? 2568)

export const ROOM_NAMES = {
  BATTLE: 'battle',
  PRIVATE_ROOM: 'private_room',
  QUICK_MATCH: 'quick_match',
} as const