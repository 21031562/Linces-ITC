export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} no encontrado.`)
