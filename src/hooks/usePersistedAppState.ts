import { useCallback, useEffect, useState } from 'react'
import { clearAppState, loadAppState, saveAppState } from '../lib/storage'
import type { PersistedAppState } from '../lib/types'

export function usePersistedAppState() {
  const [state, setState] = useState<PersistedAppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true

    void loadAppState()
      .then((loadedState) => {
        if (!active) {
          return
        }

        setState(loadedState)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to read the local GymTracker data.')
      })
      .finally(() => {
        if (active) {
          setHydrated(true)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !state) {
      return undefined
    }

    let active = true

    void saveAppState(state)
      .then(() => {
        if (active) {
          setSaveError(null)
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        setSaveError(
          error instanceof Error ? error.message : 'Unable to persist the latest local changes.',
        )
      })

    return () => {
      active = false
    }
  }, [hydrated, state])

  const resetLocalData = useCallback(async () => {
    await clearAppState()
    const fresh = await loadAppState()
    setState(fresh)
    setLoadError(null)
    setSaveError(null)
    setHydrated(true)
  }, [])

  return {
    state,
    setState,
    hydrated,
    loadError,
    saveError,
    resetLocalData,
  }
}
