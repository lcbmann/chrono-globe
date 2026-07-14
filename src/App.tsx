import { useEffect, useMemo, useState } from 'react'
import { Database, Info, LoaderCircle } from 'lucide-react'
import { GlobeView } from './components/GlobeView'
import { TerritoryPanel } from './components/TerritoryPanel'
import { Timeline } from './components/Timeline'
import { useDatasetIndex, useHistoricalMap } from './hooks/useHistoricalData'
import { entityKey, groupEntities } from './lib/entities'
import { findNearestSnapshotIndex, formatYear, getEraLabel } from './lib/time'
import type { EntitySummary, HistoricalFeature } from './types'
import './App.css'

function App() {
  const { index, error: indexError } = useDatasetIndex()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const snapshots = index?.maps || []
  const snapshot = snapshots[selectedIndex] || null
  const { map, loadedFilename, loading, error: mapError } = useHistoricalMap(snapshot)
  const features = useMemo<HistoricalFeature[]>(() => {
    if (!map || loadedFilename !== snapshot?.filename) return []
    return map.features.filter((item): item is HistoricalFeature => Boolean(item.properties?.NAME))
  }, [loadedFilename, map, snapshot?.filename])
  const entities = useMemo(() => groupEntities(features), [features])

  useEffect(() => {
    if (!index || selectedIndex >= 0) return
    setSelectedIndex(findNearestSnapshotIndex(index.maps, -323))
  }, [index, selectedIndex])

  useEffect(() => {
    if (selectedKey && !entities.some((entity) => entity.key === selectedKey)) setSelectedKey(null)
  }, [entities, selectedKey])

  useEffect(() => {
    if (!playing || snapshots.length === 0) return
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= snapshots.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [playing, snapshots.length])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft' && selectedIndex > 0) setSelectedIndex(selectedIndex - 1)
      if (event.key === 'ArrowRight' && selectedIndex < snapshots.length - 1) setSelectedIndex(selectedIndex + 1)
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((current) => !current)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [selectedIndex, snapshots.length])

  const visibleError = indexError || mapError

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <div><strong>Chrono Globe</strong><span>The world, through time</span></div>
        </div>
        <div className="header-actions">
          {index && <span className="dataset-status" title={`${index.maps.length} locally stored historical reconstructions`}><Database size={14} /> {index.maps.length} reconstructions</span>}
          <button type="button" className="about-button" onClick={() => setAboutOpen(true)}><Info size={16} /> About the map</button>
        </div>
      </header>

      <main className="workspace">
        <section className="globe-column">
          <div className="time-readout" aria-live="polite">
            <span>{snapshot ? getEraLabel(snapshot.year) : 'Loading atlas'}</span>
            <h1>{snapshot ? formatYear(snapshot.year) : '—'}</h1>
            {snapshot && <small>Reconstruction {selectedIndex + 1} of {snapshots.length}</small>}
          </div>
          <GlobeView
            features={features}
            selectedKey={selectedKey}
            onSelect={(feature) => setSelectedKey(entityKey(feature))}
            onClearSelection={() => setSelectedKey(null)}
          />
          {(loading || (!index && !visibleError)) && <div className="loading-pill"><LoaderCircle size={15} className="spin" /> Loading reconstruction</div>}
          {visibleError && (
            <div className="error-card">
              <strong>The atlas data could not be loaded.</strong><span>{visibleError}</span>
              <button type="button" onClick={() => window.location.reload()}>Try again</button>
            </div>
          )}
        </section>

        <TerritoryPanel
          entities={entities}
          selectedKey={selectedKey}
          query={query}
          onQueryChange={setQuery}
          onSelect={(entity: EntitySummary) => setSelectedKey(entity.key)}
          onClear={() => setSelectedKey(null)}
        />
      </main>

      <Timeline
        snapshots={snapshots}
        selectedIndex={selectedIndex}
        playing={playing}
        onSelectedIndexChange={(nextIndex) => { setSelectedIndex(nextIndex); setPlaying(false) }}
        onPlayingChange={setPlaying}
      />

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setAboutOpen(false)} aria-label="Close about dialog">×</button>
            <div className="eyebrow">About this atlas</div>
            <h2 id="about-title">History has fuzzy edges.</h2>
            <p>Chrono Globe shows broad, global reconstructions at selected moments in time. Ancient borders often represented influence, settlement, or tribute rather than surveyed lines.</p>
            <p>Use it to explore patterns and ask better questions—not as a definitive source for legal, academic, or territorial claims.</p>
            <div className="confidence-legend">
              <span><i className="precision precision-1" /> Approximate</span><span><i className="precision precision-2" /> Moderate</span><span><i className="precision precision-3" /> Documented</span>
            </div>
            <a href={index?.source || 'https://github.com/aourednik/historical-basemaps'} target="_blank" rel="noreferrer">View the source dataset</a>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
