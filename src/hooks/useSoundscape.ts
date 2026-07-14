import { useCallback, useEffect, useRef, useState } from 'react'

export const useSoundscape = () => {
  const [enabled, setEnabled] = useState(true)
  const contextRef = useRef<AudioContext | null>(null)
  const ambientRef = useRef<{ oscillators: OscillatorNode[]; gain: GainNode } | null>(null)

  const startAmbient = useCallback(() => {
    if (ambientRef.current) return
    const AudioContextClass = window.AudioContext
    const context = contextRef.current || new AudioContextClass()
    contextRef.current = context
    void context.resume()
    const gain = context.createGain()
    gain.gain.value = 0.018
    gain.connect(context.destination)
    const oscillators = [55, 82.41].map((frequency, index) => {
      const oscillator = context.createOscillator()
      const filter = context.createBiquadFilter()
      oscillator.type = index === 0 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      filter.type = 'lowpass'
      filter.frequency.value = 180
      oscillator.connect(filter).connect(gain)
      oscillator.start()
      return oscillator
    })
    ambientRef.current = { oscillators, gain }
  }, [])

  const stopAmbient = useCallback(() => {
    const ambient = ambientRef.current
    if (!ambient) return
    ambient.gain.gain.setTargetAtTime(0, contextRef.current?.currentTime || 0, .08)
    window.setTimeout(() => ambient.oscillators.forEach((oscillator) => oscillator.stop()), 450)
    ambientRef.current = null
  }, [])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      if (current) stopAmbient()
      else startAmbient()
      return !current
    })
  }, [startAmbient, stopAmbient])

  const chime = useCallback((frequency = 440) => {
    if (!enabled || !contextRef.current) return
    const context = contextRef.current
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(.045, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .22)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + .24)
  }, [enabled])

  useEffect(() => () => {
    ambientRef.current?.oscillators.forEach((oscillator) => oscillator.stop())
    void contextRef.current?.close()
  }, [])

  useEffect(() => {
    if (!enabled || ambientRef.current) return
    const begin = () => startAmbient()
    window.addEventListener('pointerdown', begin, { once: true, capture: true })
    window.addEventListener('keydown', begin, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', begin, { capture: true })
      window.removeEventListener('keydown', begin, { capture: true })
    }
  }, [enabled, startAmbient])

  return { soundEnabled: enabled, toggleSound: toggle, chime }
}
