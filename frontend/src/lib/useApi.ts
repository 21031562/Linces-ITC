import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

/** Carga datos con estados de carga/error y opción de reintentar. */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    setError(null)
    loader()
      .then((d) => vivo && setData(d))
      .catch((e: unknown) =>
        vivo && setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Ocurrió un error inesperado.')),
      )
      .finally(() => vivo && setLoading(false))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload, setData }
}
