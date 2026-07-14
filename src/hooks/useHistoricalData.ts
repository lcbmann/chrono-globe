import { useEffect, useState } from 'react'
import type { DatasetIndex, HistoricalMap, Snapshot } from '../types'

const mapCache = new Map<string, HistoricalMap>()
const baseUrl = import.meta.env.BASE_URL

const fetchJson = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${baseUrl}data/${path}`, { signal })
  if (!response.ok) throw new Error(`Data request failed (${response.status})`)
  return response.json() as Promise<T>
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
    fetchJson<HistoricalMap>(snapshot.filename, controller.signal)
      .then((nextMap) => {
        mapCache.set(snapshot.filename, nextMap)
        setMap(nextMap)
        setLoadedFilename(snapshot.filename)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load this reconstruction')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [snapshot])

  return { map, loadedFilename, loading, error }
}
