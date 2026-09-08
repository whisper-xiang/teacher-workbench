import { useCallback, useEffect, useState } from 'react'
import {
  HEALTH_EVENT,
  loadHealthPet,
  punchHealth,
  undoHealth,
  updateHealthGoals,
  type HealthGoals,
  type HealthId,
  type HealthPetState,
} from '../lib/health-pet'

export function useHealthPet() {
  const [state, setState] = useState<HealthPetState>(() => loadHealthPet())

  useEffect(() => {
    const sync = () => setState(loadHealthPet())
    window.addEventListener(HEALTH_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(HEALTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const punch = useCallback((id: HealthId) => {
    setState(punchHealth(id))
  }, [])

  const undo = useCallback((id: HealthId) => {
    setState(undoHealth(id))
  }, [])

  const setGoals = useCallback((patch: Partial<HealthGoals>) => {
    setState(updateHealthGoals(patch))
  }, [])

  return { state, punch, undo, setGoals }
}
