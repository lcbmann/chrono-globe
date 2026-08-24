import { useEffect, useState } from 'react'
import type { DatasetIndex, HistoricalMap, Snapshot } from '../types'

const mapCache = new Map<string, HistoricalMap>()
const pendingMaps = new Map<string, Promise<HistoricalMap>>()
const mapCacheLimit = 8
const baseUrl = import.meta.env.BASE_URL

const cachedMap = (filename: string) => {
  const map = mapCache.get(filename)
  if (!map) return undefined
  mapCache.delete(filename)
  mapCache.set(filename, map)
  return map
}

const rememberMap = (filename: string, map: HistoricalMap) => {
  mapCache.delete(filename)
  mapCache.set(filename, map)
  while (mapCache.size > mapCacheLimit) {
    const oldest = mapCache.keys().next().value
    if (oldest === undefined) break
    mapCache.delete(oldest)
  }
}

const fetchJson = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${baseUrl}data/${path}`, { signal })
  if (!response.ok) throw new Error(`Data request failed (${response.status})`)
  return response.json() as Promise<T>
}

const loadHistoricalMap = (snapshot: Snapshot) => {
  const cached = cachedMap(snapshot.filename)
  if (cached) return Promise.resolve(cached)
  const existing = pendingMaps.get(snapshot.filename)
  if (existing) return existing
  // Map loads are shared by visible views and prefetching. Keeping the shared
  // request independent from any one component prevents an old view's cleanup
  // from aborting data that a newer view is still waiting for.
  let request: Promise<HistoricalMap>
  request = fetchJson<HistoricalMap>(snapshot.filename).then((map) => {
    if (pendingMaps.get(snapshot.filename) === request) {
      rememberMap(snapshot.filename, map)
      pendingMaps.delete(snapshot.filename)
    }
    return map
  }).catch((error: unknown) => {
    if (pendingMaps.get(snapshot.filename) === request) pendingMaps.delete(snapshot.filename)
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
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchJson<DatasetIndex>('index.json', controller.signal)
      .then(setIndex)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load the data index')
    })
    return () => controller.abort()
  }, [attempt])

  return { index, error, retry: () => setAttempt((current) => current + 1) }
}

export const useHistoricalMap = (snapshot: Snapshot | null) => {
  const [map, setMap] = useState<HistoricalMap | null>(null)
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (!snapshot) {
      setMap(null)
      setLoadedFilename(null)
      setLoading(false)
      setError(null)
      return () => { active = false }
    }
    const cached = cachedMap(snapshot.filename)
    if (cached) {
      setMap(cached)
      setLoadedFilename(snapshot.filename)
      setLoading(false)
      setError(null)
      return () => { active = false }
    }

    setLoading(true)
    setError(null)
    loadHistoricalMap(snapshot)
      .then((nextMap) => {
        if (!active) return
        setMap(nextMap)
        setLoadedFilename(snapshot.filename)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Could not load this moment in history')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [attempt, snapshot])

  const retry = () => {
    if (snapshot) {
      mapCache.delete(snapshot.filename)
      pendingMaps.delete(snapshot.filename)
    }
    setAttempt((current) => current + 1)
  }

  return { map, loadedFilename, loading, error, retry }
}
