import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useIpc, useIpcMutation } from '../use-ipc'
import type { IpcResult, IpcError } from '@shared/ipc'

describe('useIpc', () => {
  it('should show loading state initially', () => {
    const fetcher = vi.fn(
      () => new Promise<IpcResult<string>>(() => {}), // never resolves
    )
    const { result } = renderHook(() => useIpc(fetcher))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should set data on successful response', async () => {
    const mockData = [{ id: 1, name: 'Test' }]
    const fetcher = vi.fn(
      async (): Promise<IpcResult<typeof mockData>> => ({
        success: true,
        data: mockData,
      }),
    )

    const { result } = renderHook(() => useIpc(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('should set error on error response', async () => {
    const ipcError: IpcError = {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    }
    const fetcher = vi.fn(
      async (): Promise<IpcResult<string>> => ({
        success: false,
        error: ipcError,
      }),
    )

    const { result } = renderHook(() => useIpc(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual(ipcError)
  })

  it('should set error when fetcher throws an exception', async () => {
    const fetcher = vi.fn(async (): Promise<IpcResult<string>> => {
      throw new Error('Network failure')
    })

    const { result } = renderHook(() => useIpc(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({
      code: 'IPC_ERROR',
      message: 'Network failure',
    })
  })

  it('should refetch data when refetch is called', async () => {
    let callCount = 0
    const fetcher = vi.fn(async (): Promise<IpcResult<string>> => {
      callCount++
      return { success: true, data: `result-${callCount}` }
    })

    const { result } = renderHook(() => useIpc(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBe('result-1')

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.data).toBe('result-2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('useIpcMutation', () => {
  it('should start in not-loading state', () => {
    const { result } = renderHook(() => useIpcMutation())

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.mutate).toBeInstanceOf(Function)
  })

  it('should set loading during mutation and return data on success', async () => {
    const { result } = renderHook(() => useIpcMutation<string>())

    let resolveAction: (value: IpcResult<string>) => void
    const action = () =>
      new Promise<IpcResult<string>>((resolve) => {
        resolveAction = resolve
      })

    let mutatePromise: Promise<string | null>

    act(() => {
      mutatePromise = result.current.mutate(action)
    })

    // While the mutation is in-flight, loading should be true
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveAction!({ success: true, data: 'created' })
      await mutatePromise!
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return data from successful mutation', async () => {
    const { result } = renderHook(() => useIpcMutation<string>())

    let returnedData: string | null = null

    await act(async () => {
      returnedData = await result.current.mutate(async () => ({
        success: true as const,
        data: 'created-item',
      }))
    })

    expect(returnedData).toBe('created-item')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should set error on failed mutation and return null', async () => {
    const { result } = renderHook(() => useIpcMutation())

    const ipcError: IpcError = {
      code: 'VALIDATION_ERROR',
      message: 'Name is required',
    }

    let returnedData: unknown = 'not-null'

    await act(async () => {
      returnedData = await result.current.mutate(async () => ({
        success: false as const,
        error: ipcError,
      }))
    })

    expect(returnedData).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toEqual(ipcError)
  })

  it('should set error when mutation action throws', async () => {
    const { result } = renderHook(() => useIpcMutation())

    let returnedData: unknown = 'not-null'

    await act(async () => {
      returnedData = await result.current.mutate(async () => {
        throw new Error('Connection lost')
      })
    })

    expect(returnedData).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toEqual({
      code: 'MUTATION_ERROR',
      message: 'Connection lost',
    })
  })
})
