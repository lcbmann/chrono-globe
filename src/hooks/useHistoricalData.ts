import { useEffect, useState } from 'react'
import type { DatasetIndex, HistoricalMap, Snapshot } from '../types'

const mapCache = new Map<string, HistoricalMap>()
const pendingMaps = new Map<string, Promise<HistoricalMap>>()
const baseUrl = import.meta.env.BASE_URL

const fetchJson = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${baseUrl}data/${path}`, { signal })
  if (!response.ok) throw new Error(`Data request failed (${response.status})`)
  return response.json() as Promise<T>
}

const loadHistoricalMap = (snapshot: Snapshot, signal?: AbortSignal) => {
  const cached = mapCache.get(snapshot.filename)
  if (cached) return Promise.resolve(cached)
  const existing = pendingMaps.get(snapshot.filename)
  if (existing) return existing
  const request = fetchJson<HistoricalMap>(snapshot.filename, signal).then((map) => {
    mapCache.set(snapshot.filename, map)
    pendingMaps.delete(snapshot.filename)
    return map
  }).catch((error: unknown) => {
    pendingMaps.delete(snapshot.filename)
    throw error
  })
  pendingMaps.set(snapshot.filename, request)
  return request
}

export const prefetchHistoricalMap = (snapshot: Snapshot | undefined) => {
  if (!snapshot) return Promise.resolve(null)
  return loadHistoricalMap(snapshot).catch(() => null)
}

export const useDatasetIndex = () => {
  const [index, setIndex] = useState<DatasetIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<DatasetIndex>('index.json', controller.signal)
      .then(setIndex)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load the data index')
      })
    return () => controller.abort()
  }, [])

  return { index, error }
}

export const useHistoricalMap = (snapshot: Snapshot | null) => {
  const [map, setMap] = useState<HistoricalMap | null>(null)
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!snapshot) return
    const cached = mapCache.get(snapshot.filename)
    if (cached) {
      setMap(cached)
      setLoadedFilename(snapshot.filename)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    loadHistoricalMap(snapshot, controller.signal)
      .then((nextMap) => {
        setMap(nextMap)
        setLoadedFilename(snapshot.filename)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load this moment in history')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [snapshot])

  return { map, loadedFilename, loading, error }
}
