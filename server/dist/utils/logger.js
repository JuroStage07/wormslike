"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function formatMessage(level, scope, message) {
    return `[${level.toUpperCase()}][${scope}] ${message}`;
}
exports.logger = {
    info(scope, message) {
        console.info(formatMessage('info', scope, message));
    },
    warn(scope, message) {
        console.warn(formatMessage('warn', scope, message));
    },
    error(scope, message) {
        console.error(formatMessage('error', scope, message));
    },
};
