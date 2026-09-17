import { useCallback, useEffect, useRef, useState } from 'react'
import { claimHourlyTipSlot, nextPetTip, petTipLine } from '../lib/pet-tips'

export function useHourlyPetTip(greetingName: string, enabled: boolean) {
  const [speech, setSpeech] = useState('')
  const lastTip = useRef<string | null>(null)

  const dismiss = useCallback(() => {
    setSpeech('')
  }, [])

  const speak = useCallback(() => {
    const tip = nextPetTip(lastTip.current)
    lastTip.current = tip
    setSpeech(petTipLine(greetingName, tip))
  }, [greetingName])

  useEffect(() => {
    if (!enabled) return undefined
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (!claimHourlyTipSlot()) return
      speak()
    }
    tick()
    const id = window.setInterval(tick, 15_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, speak])

  return { speech, dismiss, speak }
}
