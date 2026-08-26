import { useEffect, useMemo, useState } from 'react'
import type { HistoricalMap } from '../types'
import { findTerritoryPack, territoriesForYear, type TemporalTerritoryManifest, type TemporalTerritoryPack } from '../lib/territoryData'

const baseUrl = `${import.meta.env.BASE_URL}data/sources/cliopatria/`
const packCache = new Map<string, HistoricalMap>()
const pendingPacks = new Map<string, Promise<HistoricalMap>>()
// Modern packs can expand to tens of megabytes as parsed objects. Keeping only
// the current and adjacent century avoids mobile memory spikes during timelapse.
const packCacheLimit = 2
let manifestRequest: Promise<TemporalTerritoryManifest> | null = null

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`Cliopatria data request failed (${response.status})`)
  return response.json() as Promise<T>
}

const loadManifest = () => {
  if (!manifestRequest) manifestRequest = fetchJson<TemporalTerritoryManifest>('manifest.json').catch((error: unknown) => {
    manifestRequest = null
    throw error
  })
  return manifestRequest
}

const rememberPack = (filename: string, map: HistoricalMap) => {
  packCache.delete(filename)
  packCache.set(filename, map)
  while (packCache.size > packCacheLimit) {
    const oldest = packCache.keys().next().value
    if (oldest === undefined) break
    packCache.delete(oldest)
  }
}

const loadPack = (pack: TemporalTerritoryPack) => {
  const cached = packCache.get(pack.filename)
  if (cached) {
    packCache.delete(pack.filename)
    packCache.set(pack.filename, cached)
    return Promise.resolve(cached)
  }
  const pending = pendingPacks.get(pack.filename)
  if (pending) return pending
  let request: Promise<HistoricalMap>
  request = fetchJson<HistoricalMap>(pack.filename).then((map) => {
    rememberPack(pack.filename, map)
    if (pendingPacks.get(pack.filename) === request) pendingPacks.delete(pack.filename)
    return map
  }).catch((error: unknown) => {
    if (pendingPacks.get(pack.filename) === request) pendingPacks.delete(pack.filename)
    throw error
  })
  pendingPacks.set(pack.filename, request)
  return request
}

export const prefetchCliopatriaPack = (pack: TemporalTerritoryPack | null | undefined) => {
  if (!pack) return Promise.resolve(null)
  return loadPack(pack).catch(() => null)
}

export const useCliopatriaTerritories = (year: number | undefined, enabled = true, includeRelations = false) => {
  const [manifest, setManifest] = useState<TemporalTerritoryManifest | null>(null)
  const [map, setMap] = useState<HistoricalMap | null>(null)
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadManifest()
      .then((nextManifest) => {
        if (!active) return
        setManifest(nextManifest)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load the Cliopatria catalog')
      })
    return () => { active = false }
  }, [attempt])

  const pack = useMemo(() => findTerritoryPack(manifest, year), [manifest, year])

  useEffect(() => {
    let active = true
    if (!enabled || !pack) {
      setMap(null)
      setLoadedFilename(null)
      setLoading(false)
      return () => { active = false }
    }
    const cached = packCache.get(pack.filename)
    if (cached) {
      setMap(cached)
      setLoadedFilename(pack.filename)
      setLoading(false)
      setError(null)
      return () => { active = false }
    }
    setLoading(true)
    setError(null)
    loadPack(pack)
      .then((nextMap) => {
        if (!active) return
        setMap(nextMap)
        setLoadedFilename(pack.filename)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load detailed territories for this period')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, enabled, pack])

  const ready = Boolean(pack && loadedFilename === pack.filename)
  const features = useMemo(
    () => ready ? territoriesForYear(map, year, includeRelations) : [],
    [includeRelations, map, ready, year],
  )
  const retry = () => {
    if (pack) {
      packCache.delete(pack.filename)
      pendingPacks.delete(pack.filename)
    }
    setAttempt((current) => current + 1)
  }

  return { manifest, pack, features, ready, loading, error, retry }
}
