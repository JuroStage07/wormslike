"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_NAMES = exports.SERVER_PORT = void 0;
exports.SERVER_PORT = Number(process.env.PORT ?? 2567);
exports.ROOM_NAMES = {
    BATTLE: 'battle',
    PRIVATE_ROOM: 'private_room',
    QUICK_MATCH: 'quick_match',
};
