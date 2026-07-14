import { useEffect, useMemo, useState } from 'react'
import { Database, Globe2, Info, LoaderCircle, Map, Volume2, VolumeX } from 'lucide-react'
import { GlobeView } from './components/GlobeView'
import { TerritoryPanel } from './components/TerritoryPanel'
import { Timeline } from './components/Timeline'
import { eventsNearYear } from './data/events'
import { prefetchHistoricalMap, useDatasetIndex, useHistoricalMap } from './hooks/useHistoricalData'
import { useSoundscape } from './hooks/useSoundscape'
import { entityKey, groupEntities } from './lib/entities'
import { buildTimelineYears, findNearestYearIndex, findSourceSnapshotIndex, formatYear, getEraLabel } from './lib/time'
import type { HistoricalEntityIndex, HistoricalEvent, HistoricalFeature } from './types'
import './App.css'

type GlobeMode = 'atlas' | 'earth'

function App() {
  const { index, error: indexError } = useDatasetIndex()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [globeMode, setGlobeMode] = useState<GlobeMode>('atlas')
  const { soundEnabled, toggleSound, chime } = useSoundscape()
  const snapshots = useMemo(() => index?.maps || [], [index])
  const timelineYears = useMemo(() => buildTimelineYears(snapshots), [snapshots])
  const selectedYear = timelineYears[selectedIndex]
  const sourceIndex = selectedYear === undefined ? -1 : findSourceSnapshotIndex(snapshots, selectedYear)
  const snapshot = snapshots[sourceIndex] || null
  const { map, loadedFilename, loading, error: mapError } = useHistoricalMap(snapshot)
  const features = useMemo<HistoricalFeature[]>(() => {
    if (!map) return []
    return map.features.filter((item): item is HistoricalFeature => Boolean(item.properties?.NAME && item.properties.NAME !== '?'))
  }, [map])
  const entities = useMemo(() => groupEntities(features), [features])
  const nearbyEvents = useMemo(() => selectedYear === undefined ? [] : eventsNearYear(selectedYear), [selectedYear])

  useEffect(() => {
    if (!index || selectedIndex >= 0) return
    setSelectedIndex(findNearestYearIndex(buildTimelineYears(index.maps), -323))
  }, [index, selectedIndex])

  useEffect(() => {
    if (!playing || timelineYears.length === 0) return
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= timelineYears.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 950)
    return () => window.clearInterval(timer)
  }, [playing, timelineYears.length])

  useEffect(() => {
    if (!playing || sourceIndex < 0) return
    void prefetchHistoricalMap(snapshots[sourceIndex + 1])
  }, [playing, snapshots, sourceIndex])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft' && selectedIndex > 0) setSelectedIndex(selectedIndex - 1)
      if (event.key === 'ArrowRight' && selectedIndex < timelineYears.length - 1) setSelectedIndex(selectedIndex + 1)
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((current) => !current)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [selectedIndex, timelineYears.length])

  const selectYearIndex = (nextIndex: number) => {
    setSelectedIndex(nextIndex)
    setPlaying(false)
    setSelectedEvent(null)
    chime(330 + (nextIndex % 5) * 35)
  }

  const jumpToEntity = (entity: HistoricalEntityIndex) => {
    setSelectedIndex(findNearestYearIndex(timelineYears, entity.peakYear))
    setSelectedKey(entity.key)
    setSelectedEvent(null)
    setPlaying(false)
    chime(523.25)
  }

  const visibleError = indexError || mapError

  return (
    <div className={`app-shell mode-${globeMode}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <div><strong>Chrono Globe</strong><span>The world, through time</span></div>
        </div>
        <div className="header-actions">
          {index && <span className="dataset-status" title={`${index.maps.length} moments in world history`}><Database size={14} /> {index.maps.length} mapped moments</span>}
          <div className="segmented-control" aria-label="Globe appearance">
            <button type="button" className={globeMode === 'atlas' ? 'active' : ''} onClick={() => setGlobeMode('atlas')} title="Atlas globe"><Map size={14} /> Atlas</button>
            <button type="button" className={globeMode === 'earth' ? 'active' : ''} onClick={() => setGlobeMode('earth')} title="Realistic Earth"><Globe2 size={14} /> Earth</button>
          </div>
          <button type="button" className="header-icon-button" onClick={toggleSound} aria-label={soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'} title={soundEnabled ? 'Mute ambient sound' : 'Enable subtle ambient sound'}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" className="about-button" onClick={() => setAboutOpen(true)}><Info size={16} /> About</button>
        </div>
      </header>

      <main className="workspace">
        <section className="globe-column">
          <div className="time-readout" aria-live="polite">
            <span>{selectedYear !== undefined ? getEraLabel(selectedYear) : 'Opening the globe'}</span>
            <h1>{selectedYear !== undefined ? formatYear(selectedYear) : '—'}</h1>
            {snapshot && (loadedFilename !== snapshot.filename
              ? <small>Traveling to {formatYear(selectedYear)}</small>
              : <small>{snapshot.year === selectedYear ? 'A mapped moment in history' : `The world around ${formatYear(snapshot.year)}`}</small>)}
          </div>
          <GlobeView
            features={features}
            selectedKey={selectedKey}
            events={nearbyEvents}
            selectedEvent={selectedEvent}
            mode={globeMode}
            history={index?.entities || []}
            onSelect={(feature) => { setSelectedKey(entityKey(feature)); setSelectedEvent(null); chime(440) }}
            onEventSelect={(event) => { setSelectedEvent(event); setSelectedKey(event.entity || null); chime(659.25) }}
            onClearSelection={() => { setSelectedKey(null); setSelectedEvent(null) }}
          />
          {(loading || (!index && !visibleError)) && <div className="loading-pill"><LoaderCircle size={15} className="spin" /> Traveling through time</div>}
          {visibleError && (
            <div className="error-card">
              <strong>The historical map could not be loaded.</strong><span>{visibleError}</span>
              <button type="button" onClick={() => window.location.reload()}>Try again</button>
            </div>
          )}
        </section>

        <TerritoryPanel
          entities={entities}
          history={index?.entities || []}
          selectedKey={selectedKey}
          selectedEvent={selectedEvent}
          nearbyEvents={nearbyEvents}
          year={selectedYear}
          query={query}
          onQueryChange={setQuery}
          onSelect={(entity) => { setSelectedKey(entity.key); setSelectedEvent(null); chime(440) }}
          onHistoricalSelect={jumpToEntity}
          onEventSelect={(event) => { setSelectedEvent(event); setSelectedKey(event.entity || null); chime(659.25) }}
          onClear={() => { setSelectedKey(null); setSelectedEvent(null) }}
        />
      </main>

      <Timeline
        years={timelineYears}
        selectedIndex={selectedIndex}
        playing={playing}
        onSelectedIndexChange={selectYearIndex}
        onPlayingChange={setPlaying}
      />

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setAboutOpen(false)} aria-label="Close about dialog">×</button>
            <div className="eyebrow">About Chrono Globe</div>
            <h2 id="about-title">History has fuzzy edges.</h2>
            <p>The timeline moves in decades through recorded history. Between mapped moments, borders remain steady, then dissolve smoothly into the next view as territories grow, divide, and disappear.</p>
            <p>Ancient borders often represented influence, settlement, or tribute rather than surveyed lines. Use this as an educational starting point, not a definitive source for legal, academic, or territorial claims.</p>
            <div className="confidence-legend">
              <span><i className="precision precision-1" /> Approximate</span><span><i className="precision precision-2" /> Moderate</span><span><i className="precision precision-3" /> Documented</span>
            </div>
            <a href={index?.source || 'https://github.com/aourednik/historical-basemaps'} target="_blank" rel="noreferrer">Map data &amp; credits</a>
            <a href="https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/" target="_blank" rel="noreferrer">NASA Blue Marble imagery</a>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
