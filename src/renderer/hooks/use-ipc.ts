import { useState, useEffect, useCallback } from 'react'
import type { IpcResult, IpcError } from '@shared/ipc'

/**
 * Hook for read operations that auto-fetch on mount.
 * Wraps an IPC fetcher returning IpcResult<T> and provides
 * loading, error, and data states with a refetch function.
 */
export function useIpc<T>(fetcher: () => Promise<IpcResult<T>>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<IpcError | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError({
        code: 'IPC_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/**
 * Hook for write (mutation) operations triggered manually.
 * Returns a mutate function that accepts an IPC action,
 * manages loading/error state, and returns the result data or null.
 */
export function useIpcMutation<TResult = void>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<IpcError | null>(null)

  const mutate = useCallback(async <T extends TResult>(action: () => Promise<IpcResult<T>>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await action()
      if (result.success) {
        return result.data
      } else {
        setError(result.error)
        return null
      }
    } catch (err) {
      setError({
        code: 'MUTATION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { mutate, loading, error }
}
