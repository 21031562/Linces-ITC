export type ErrorCode =
  | 'VALIDATION'
  | 'INVALID_CREDENTIALS'
  | 'SII_UNAVAILABLE'
  | 'SII_ERROR'
  | 'NO_SESSION'
  | 'SESSION_EXPIRED'
  | 'SESSION_IDLE'
  | 'TOKEN_EXPIRED'
  | 'CSRF'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NOT_ELIGIBLE'
  | 'GONE'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL'

export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const Errors = {
  noSession: () => new AppError(401, 'NO_SESSION', 'No has iniciado sesión.'),
  expired: () => new AppError(401, 'SESSION_EXPIRED', 'Tu sesión expiró. Vuelve a iniciar sesión.'),
  idle: () => new AppError(401, 'SESSION_IDLE', 'Tu sesión se cerró por inactividad.'),
  tokenRejected: () =>
    new AppError(401, 'TOKEN_EXPIRED', 'El SII rechazó tu sesión (token inválido o expirado). Inicia sesión de nuevo.'),
  siiDown: () =>
    new AppError(503, 'SII_UNAVAILABLE', 'El SII del TecNM Celaya no está disponible en este momento. Intenta más tarde.'),
  siiError: () => new AppError(502, 'SII_ERROR', 'El SII respondió con un formato inesperado.'),
  vacantesDown: () =>
    new AppError(503, 'SERVICE_UNAVAILABLE', 'La bolsa de vacantes no está disponible. Intenta en unos segundos.'),
}
