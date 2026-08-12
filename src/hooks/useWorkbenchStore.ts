import { useCallback, useEffect, useRef, useState } from 'react'
import {
  exportWorkbenchData,
  importWorkbenchData,
  loadWorkbenchData,
  resetWorkbenchData,
  saveWorkbenchData,
} from '../data/store'
import type { WorkbenchData } from '../data/types'

export function useWorkbenchStore() {
  const [data, setData] = useState<WorkbenchData>(() => loadWorkbenchData())
  const [hydrated, setHydrated] = useState(false)
  const skipFirst = useRef(true)

  useEffect(() => {
    setData(loadWorkbenchData())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    saveWorkbenchData(data)
  }, [data, hydrated])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'teacher-workbench-data-v1' && event.newValue) {
        try {
          setData(JSON.parse(event.newValue) as WorkbenchData)
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((updater: (current: WorkbenchData) => WorkbenchData) => {
    setData((current) => updater(current))
  }, [])

  const patch = useCallback(<K extends keyof WorkbenchData>(key: K, value: WorkbenchData[K] | ((prev: WorkbenchData[K]) => WorkbenchData[K])) => {
    setData((current) => ({
      ...current,
      [key]: typeof value === 'function' ? (value as (prev: WorkbenchData[K]) => WorkbenchData[K])(current[key]) : value,
    }))
  }, [])

  const reset = useCallback(() => {
    const next = resetWorkbenchData()
    setData(next)
  }, [])

  const exportJson = useCallback(() => exportWorkbenchData(data), [data])

  const importJson = useCallback((json: string) => {
    const next = importWorkbenchData(json)
    setData(next)
  }, [])

  return { data, hydrated, update, patch, reset, exportJson, importJson }
}

export type WorkbenchStore = ReturnType<typeof useWorkbenchStore>
