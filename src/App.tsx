import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Database, GitCompareArrows, Globe2, Info, Layers3, LoaderCircle, Map as MapIcon, Route, Share2, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { ChangePanel } from './components/ChangePanel'
import { CompareYearControl } from './components/CompareYearControl'
import { LayerPanel } from './components/LayerPanel'
import { StoryPanel } from './components/StoryPanel'
import { TerritoryPanel } from './components/TerritoryPanel'
import { Timeline } from './components/Timeline'
import { eventsNearYear, historicalEvents } from './data/events'
import { defaultLayers, pointsForYear, routesForYear } from './data/layers'
import { getStory } from './data/stories'
import { prefetchHistoricalMap, useDatasetIndex, useHistoricalMap } from './hooks/useHistoricalData'
import { useSoundscape } from './hooks/useSoundscape'
import { buildChangeSet } from './lib/changes'
import { entityKey, groupEntities } from './lib/entities'
import { buildTimelineYears, findNearestYearIndex, formatYear, getEraLabel, getSnapshotTransition } from './lib/time'
import { parseAtlasUrl, serializeAtlasUrl } from './lib/urlState'
import type { GlobeViewpoint, HistoricalEntityIndex, HistoricalEvent, HistoricalFeature, HistoricalPoint, HistoricalRoute } from './types'
import './App.css'

type GlobeMode = 'atlas' | 'earth'
const GlobeView = lazy(() => import('./components/GlobeView').then((module) => ({ default: module.GlobeView })))
const initialUrl = parseAtlasUrl(window.location.search)
const initialStory = getStory(initialUrl.story || null)
const initialStoryStep = initialStory?.steps[initialUrl.storyStep || 0]
const initialStoryEvent = historicalEvents.find((event) => event.id === (initialUrl.event || initialStoryStep?.eventId))

const usableFeatures = (map: ReturnType<typeof useHistoricalMap>['map']) => map?.features.filter(
  (item): item is HistoricalFeature => Boolean(item.properties?.NAME && item.properties.NAME !== '?'),
) || []

function App() {
  const { index, error: indexError } = useDatasetIndex()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedKey, setSelectedKey] = useState<string | null>(initialUrl.entity || initialStoryStep?.entity || initialStoryEvent?.entity || null)
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(initialStoryEvent || null)
  const [selectedPoint, setSelectedPoint] = useState<HistoricalPoint | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<HistoricalRoute | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [watchingEntity, setWatchingEntity] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [storyLibraryOpen, setStoryLibraryOpen] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState<string | null>(initialUrl.story || null)
  const [storyStep, setStoryStep] = useState(initialUrl.storyStep || 0)
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  const [layers, setLayers] = useState(initialUrl.layers || defaultLayers)
  const [comparisonOpen, setComparisonOpen] = useState(initialUrl.compareYear !== undefined)
  const [comparisonIndex, setComparisonIndex] = useState(-1)
  const [changesOpen, setChangesOpen] = useState(false)
  const [viewpoint, setViewpoint] = useState<GlobeViewpoint | undefined>(initialUrl.view)
  const [shareCopied, setShareCopied] = useState(false)
  const [globeMode, setGlobeMode] = useState<GlobeMode>(initialUrl.mode || 'atlas')
  const { soundEnabled, toggleSound, chime } = useSoundscape()
  const snapshots = useMemo(() => index?.maps || [], [index])
  const timelineYears = useMemo(() => buildTimelineYears(snapshots, historicalEvents.map((event) => event.year)), [snapshots])
  const selectedYear = timelineYears[selectedIndex]
  const comparisonYear = timelineYears[comparisonIndex]
  const transition = useMemo(
    () => selectedYear === undefined ? { currentIndex: -1, nextIndex: -1, progress: 0 } : getSnapshotTransition(snapshots, selectedYear),
    [selectedYear, snapshots],
  )
  const sourceIndex = transition.currentIndex
  const snapshot = snapshots[sourceIndex] || null
  const nextSnapshot = snapshots[transition.nextIndex] || null
  const { map, loadedFilename, loading, error: mapError } = useHistoricalMap(snapshot)
  const { map: pendingNextMap, loadedFilename: nextLoadedFilename } = useHistoricalMap(nextSnapshot === snapshot ? null : nextSnapshot)
  const nextMap = nextLoadedFilename === nextSnapshot?.filename ? pendingNextMap : null
  const features = useMemo(() => usableFeatures(map), [map])
  const nextFeatures = useMemo(() => usableFeatures(nextMap), [nextMap])

  const comparisonTransition = useMemo(
    () => comparisonYear === undefined ? { currentIndex: -1, nextIndex: -1, progress: 0 } : getSnapshotTransition(snapshots, comparisonYear),
    [comparisonYear, snapshots],
  )
  const comparisonSnapshot = snapshots[comparisonTransition.currentIndex] || null
  const comparisonNextSnapshot = snapshots[comparisonTransition.nextIndex] || null
  const { map: comparisonMap, loadedFilename: comparisonLoadedFilename, loading: comparisonLoading } = useHistoricalMap(comparisonOpen ? comparisonSnapshot : null)
  const { map: pendingComparisonNextMap, loadedFilename: comparisonNextLoadedFilename } = useHistoricalMap(comparisonOpen && comparisonNextSnapshot !== comparisonSnapshot ? comparisonNextSnapshot : null)
  const comparisonNextMap = comparisonNextLoadedFilename === comparisonNextSnapshot?.filename ? pendingComparisonNextMap : null
  const comparisonFeatures = useMemo(() => usableFeatures(comparisonMap), [comparisonMap])
  const comparisonNextFeatures = useMemo(() => usableFeatures(comparisonNextMap), [comparisonNextMap])

  const displayFeatures = transition.progress >= .5 && nextFeatures.length > 0 ? nextFeatures : features
  const comparisonDisplayFeatures = comparisonTransition.progress >= .5 && comparisonNextFeatures.length > 0 ? comparisonNextFeatures : comparisonFeatures
  const entities = useMemo(() => groupEntities(displayFeatures), [displayFeatures])
  const nearbyEvents = useMemo(() => selectedYear === undefined || !layers.events ? [] : eventsNearYear(selectedYear), [layers.events, selectedYear])
  const comparisonEvents = useMemo(() => comparisonYear === undefined || !layers.events ? [] : eventsNearYear(comparisonYear), [comparisonYear, layers.events])
  const overlayPoints = useMemo(() => selectedYear === undefined ? [] : pointsForYear(selectedYear, layers), [layers, selectedYear])
  const overlayRoutes = useMemo(() => selectedYear === undefined ? [] : routesForYear(selectedYear, layers), [layers, selectedYear])
  const comparisonPoints = useMemo(() => comparisonYear === undefined ? [] : pointsForYear(comparisonYear, layers), [comparisonYear, layers])
  const comparisonRoutes = useMemo(() => comparisonYear === undefined ? [] : routesForYear(comparisonYear, layers), [comparisonYear, layers])
  const activeStory = getStory(activeStoryId)
  const changes = useMemo(() => {
    if (comparisonOpen && comparisonDisplayFeatures.length > 0) return buildChangeSet(comparisonDisplayFeatures, displayFeatures)
    return buildChangeSet(features, nextFeatures.length > 0 ? nextFeatures : features)
  }, [comparisonDisplayFeatures, comparisonOpen, displayFeatures, features, nextFeatures])
  const changeKinds = useMemo(() => new Map(changes.items.map((item) => [item.key, item.kind])), [changes])

  useEffect(() => {
    if (!index || selectedIndex >= 0) return
    const years = buildTimelineYears(index.maps, historicalEvents.map((event) => event.year))
    const story = getStory(initialUrl.story || null)
    const target = story?.steps[initialUrl.storyStep || 0]?.year ?? initialUrl.year ?? -323
    setSelectedIndex(findNearestYearIndex(years, target))
    const compareTarget = initialUrl.compareYear ?? index.maps[Math.max(0, getSnapshotTransition(index.maps, target).currentIndex - 1)]?.year ?? -500
    setComparisonIndex(findNearestYearIndex(years, compareTarget))
  }, [index, selectedIndex])

  useEffect(() => {
    if (!playing || timelineYears.length === 0) return
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        const next = current + 1
        const watched = watchingEntity ? index?.entities.find((entity) => entity.key === watchingEntity) : undefined
        if (current >= timelineYears.length - 1 || (watched && timelineYears[next] > watched.lastYear)) {
          setPlaying(false)
          setWatchingEntity(null)
          return current
        }
        return next
      })
    }, 950)
    return () => window.clearInterval(timer)
  }, [index?.entities, playing, timelineYears, watchingEntity])

  useEffect(() => {
    if (!playing || sourceIndex < 0) return
    void prefetchHistoricalMap(snapshots[sourceIndex + 1])
  }, [playing, snapshots, sourceIndex])

  useEffect(() => {
    if (!selectedKey || selectedEvent || activeStory || watchingEntity || !snapshot || loadedFilename !== snapshot.filename || loading) return
    if (!entities.some((entity) => entity.key === selectedKey)) setSelectedKey(null)
  }, [activeStory, entities, loadedFilename, loading, selectedEvent, selectedKey, snapshot, watchingEntity])

  useEffect(() => {
    if (selectedYear === undefined) return
    const timer = window.setTimeout(() => {
      const search = serializeAtlasUrl({
        year: selectedYear,
        entity: selectedEvent ? undefined : selectedKey || undefined,
        event: selectedEvent?.id,
        mode: globeMode,
        compareYear: comparisonOpen ? comparisonYear : undefined,
        story: activeStoryId || undefined,
        storyStep: activeStoryId ? storyStep : undefined,
        layers,
        view: viewpoint,
      })
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [activeStoryId, comparisonOpen, comparisonYear, globeMode, layers, selectedEvent, selectedKey, selectedYear, storyStep, viewpoint])

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
    setWatchingEntity(null)
    setActiveStoryId(null)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    chime(330 + (nextIndex % 5) * 35)
  }

  const jumpToEntity = (entity: HistoricalEntityIndex) => {
    setSelectedIndex(findNearestYearIndex(timelineYears, entity.peakYear))
    setSelectedKey(entity.key)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    setPlaying(false)
    chime(523.25)
  }

  const clearSelection = () => {
    setSelectedKey(null)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
  }

  const selectEvent = (event: HistoricalEvent) => {
    setSelectedEvent(event)
    setSelectedKey(event.entity || null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    chime(659.25)
  }

  const selectPoint = (point: HistoricalPoint) => {
    setSelectedPoint(point)
    setSelectedKey(point.entity || null)
    setSelectedEvent(null)
    setSelectedRoute(null)
    chime(554.37)
  }

  const selectRoute = (route: HistoricalRoute) => {
    setSelectedRoute(route)
    setSelectedPoint(null)
    setSelectedEvent(null)
    setSelectedKey(null)
    chime(392)
  }

  const goToStoryStep = (nextStep: number, storyId = activeStoryId) => {
    const story = getStory(storyId)
    const step = story?.steps[nextStep]
    if (!story || !step) return
    const event = historicalEvents.find((item) => item.id === step.eventId) || null
    setActiveStoryId(story.id)
    setStoryStep(nextStep)
    setSelectedIndex(findNearestYearIndex(timelineYears, step.year))
    setSelectedEvent(event)
    setSelectedKey(step.entity || event?.entity || null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setPlaying(false)
    setWatchingEntity(null)
  }

  const watchEntityHistory = (entity: HistoricalEntityIndex) => {
    setSelectedIndex(findNearestYearIndex(timelineYears, entity.firstYear))
    setSelectedKey(entity.key)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    setWatchingEntity(entity.key)
    setPlaying(true)
  }

  const toggleComparison = () => {
    if (!comparisonOpen && comparisonIndex < 0) setComparisonIndex(Math.max(0, selectedIndex - 1))
    setComparisonOpen((current) => !current)
  }

  const swapComparison = () => {
    if (comparisonIndex < 0) return
    setSelectedIndex(comparisonIndex)
    setComparisonIndex(selectedIndex)
  }

  const shareCurrentView = async () => {
    const search = serializeAtlasUrl({
      year: selectedYear,
      entity: selectedEvent ? undefined : selectedKey || undefined,
      event: selectedEvent?.id,
      mode: globeMode,
      compareYear: comparisonOpen ? comparisonYear : undefined,
      story: activeStoryId || undefined,
      storyStep: activeStoryId ? storyStep : undefined,
      layers,
      view: viewpoint,
    })
    const relative = `${window.location.pathname}${search}${window.location.hash}`
    window.history.replaceState(null, '', relative)
    const url = new URL(relative, window.location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch {
      setShareCopied(false)
    }
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
          <nav className="atlas-tools" aria-label="Atlas tools">
            <button type="button" onClick={() => setStoryLibraryOpen(true)}><Sparkles size={14} /> Stories</button>
            <button type="button" onClick={() => setLayerPanelOpen(true)}><Layers3 size={14} /> Layers</button>
            <button type="button" className={comparisonOpen ? 'active' : ''} onClick={toggleComparison}><GitCompareArrows size={14} /> Compare</button>
            <button type="button" className={changesOpen ? 'active' : ''} onClick={() => setChangesOpen((current) => !current)}><Route size={14} /> Changes</button>
          </nav>
          <div className="segmented-control" aria-label="Globe appearance">
            <button type="button" className={globeMode === 'atlas' ? 'active' : ''} onClick={() => setGlobeMode('atlas')} title="Atlas globe"><MapIcon size={14} /> Atlas</button>
            <button type="button" className={globeMode === 'earth' ? 'active' : ''} onClick={() => setGlobeMode('earth')} title="Realistic Earth"><Globe2 size={14} /> Earth</button>
          </div>
          <button type="button" className="header-icon-button" onClick={toggleSound} aria-label={soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'} title={soundEnabled ? 'Mute ambient sound' : 'Enable subtle ambient sound'}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" className={`header-icon-button ${shareCopied ? 'copied' : ''}`} onClick={() => void shareCurrentView()} aria-label={shareCopied ? 'Link copied' : 'Copy shareable link'} title={shareCopied ? 'Link copied' : 'Copy this exact view'}><Share2 size={15} /></button>
          <button type="button" className="about-button" onClick={() => setAboutOpen(true)}><Info size={16} /> About</button>
        </div>
      </header>

      <main className={`workspace ${comparisonOpen ? 'comparison-active' : ''}`}>
        <section className="globe-column primary-globe">
          <div className="time-readout" aria-live="polite">
            <span>{selectedYear !== undefined ? getEraLabel(selectedYear) : 'Opening the globe'}</span>
            <h1>{selectedYear !== undefined ? formatYear(selectedYear) : '—'}</h1>
            {snapshot && (loadedFilename !== snapshot.filename
              ? <small>Traveling to {formatYear(selectedYear)}</small>
              : <small>{snapshot.year === selectedYear || !nextSnapshot || nextSnapshot === snapshot
                ? 'A mapped moment in history'
                : `Between the ${formatYear(snapshot.year)} and ${formatYear(nextSnapshot.year)} reconstructions`}</small>)}
          </div>
          <Suspense fallback={<div className="globe-loading"><LoaderCircle size={18} className="spin" /> Preparing the globe</div>}><GlobeView
            features={features}
            nextFeatures={nextFeatures}
            transitionProgress={nextMap ? transition.progress : 0}
            selectedKey={selectedKey}
            events={nearbyEvents}
            points={overlayPoints}
            routes={overlayRoutes}
            selectedEvent={selectedEvent}
            selectedPoint={selectedPoint}
            selectedRoute={selectedRoute}
            mode={globeMode}
            showChanges={changesOpen}
            changeKinds={changeKinds}
            initialView={viewpoint}
            onViewChange={setViewpoint}
            history={index?.entities || []}
            onSelect={(feature) => { setSelectedKey(entityKey(feature)); setSelectedEvent(null); setSelectedPoint(null); setSelectedRoute(null); chime(440) }}
            onEventSelect={selectEvent}
            onPointSelect={selectPoint}
            onRouteSelect={selectRoute}
            onClearSelection={clearSelection}
          /></Suspense>
          <StoryPanel
            libraryOpen={storyLibraryOpen}
            activeStory={activeStory}
            stepIndex={storyStep}
            onLibraryClose={() => setStoryLibraryOpen(false)}
            onStorySelect={(story) => { setStoryLibraryOpen(false); goToStoryStep(0, story.id) }}
            onStepChange={goToStoryStep}
            onExit={() => setActiveStoryId(null)}
          />
          {changesOpen && selectedYear !== undefined && (comparisonOpen ? comparisonYear !== undefined : nextSnapshot) && (
            <ChangePanel
              changes={changes}
              fromYear={comparisonOpen ? comparisonYear as number : snapshot?.year || selectedYear}
              toYear={comparisonOpen ? selectedYear : nextSnapshot?.year || selectedYear}
              onClose={() => setChangesOpen(false)}
              onEntitySelect={(key) => { setSelectedKey(key); setSelectedEvent(null); setSelectedPoint(null); setSelectedRoute(null) }}
            />
          )}
          {(loading || (!index && !visibleError)) && <div className="loading-pill"><LoaderCircle size={15} className="spin" /> Traveling through time</div>}
          {visibleError && (
            <div className="error-card">
              <strong>The historical map could not be loaded.</strong><span>{visibleError}</span>
              <button type="button" onClick={() => window.location.reload()}>Try again</button>
            </div>
          )}
        </section>

        {comparisonOpen && comparisonYear !== undefined && (
          <section className="globe-column comparison-globe" aria-label={`Comparison globe for ${formatYear(comparisonYear)}`}>
            <div className="time-readout compare-readout">
              <span>Comparison view</span>
              <h1>{formatYear(comparisonYear)}</h1>
              <small>{comparisonLoadedFilename !== comparisonSnapshot?.filename ? 'Loading reconstruction' : `Source map around ${formatYear(comparisonSnapshot?.year || comparisonYear)}`}</small>
              <CompareYearControl years={timelineYears} year={comparisonYear} onChange={setComparisonIndex} onSwap={swapComparison} />
            </div>
            <Suspense fallback={<div className="globe-loading"><LoaderCircle size={18} className="spin" /> Preparing comparison</div>}><GlobeView
              features={comparisonFeatures}
              nextFeatures={comparisonNextFeatures}
              transitionProgress={comparisonNextMap ? comparisonTransition.progress : 0}
              selectedKey={selectedKey}
              events={comparisonEvents}
              points={comparisonPoints}
              routes={comparisonRoutes}
              selectedEvent={null}
              selectedPoint={null}
              selectedRoute={selectedRoute}
              mode={globeMode}
              showChanges={changesOpen}
              changeKinds={changeKinds}
              history={index?.entities || []}
              onSelect={(feature) => { setSelectedKey(entityKey(feature)); setSelectedEvent(null); setSelectedPoint(null); chime(440) }}
              onEventSelect={selectEvent}
              onPointSelect={selectPoint}
              onRouteSelect={selectRoute}
              onClearSelection={clearSelection}
            /></Suspense>
            {comparisonLoading && <div className="loading-pill"><LoaderCircle size={15} className="spin" /> Loading comparison</div>}
          </section>
        )}

        <TerritoryPanel
          entities={entities}
          history={index?.entities || []}
          selectedKey={selectedKey}
          selectedEvent={selectedEvent}
          selectedPoint={selectedPoint}
          selectedRoute={selectedRoute}
          nearbyEvents={nearbyEvents}
          year={selectedYear}
          query={query}
          onQueryChange={setQuery}
          onSelect={(entity) => { setSelectedKey(entity.key); setSelectedEvent(null); chime(440) }}
          onHistoricalSelect={jumpToEntity}
          onEventSelect={selectEvent}
          onHistoryYearSelect={(target) => selectYearIndex(findNearestYearIndex(timelineYears, target))}
          onWatchEntity={watchEntityHistory}
          watchingEntity={watchingEntity}
          sourceYear={(transition.progress >= .5 && nextFeatures.length > 0 ? nextSnapshot : snapshot)?.year}
          datasetSource={index?.source}
          sourceCommit={index?.sourceCommit}
          license={index?.license}
          onClear={clearSelection}
        />
      </main>

      <Timeline
        years={timelineYears}
        selectedIndex={selectedIndex}
        playing={playing}
        onSelectedIndexChange={selectYearIndex}
        onPlayingChange={(nextPlaying) => { setPlaying(nextPlaying); if (!nextPlaying) setWatchingEntity(null) }}
      />

      <LayerPanel open={layerPanelOpen} layers={layers} onChange={setLayers} onClose={() => setLayerPanelOpen(false)} />

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setAboutOpen(false)} aria-label="Close about dialog">×</button>
            <div className="eyebrow">About Chrono Globe</div>
            <h2 id="about-title">History has fuzzy edges.</h2>
            <p>The timeline combines regular steps with exact source dates and featured moments. Between mapped reconstructions, the two known extents blend progressively so growth, division, and disappearance are easier to follow.</p>
            <p>The blended shapes are a visual transition, not a claim that a border followed that exact path in every intervening year.</p>
            <p>Ancient borders often represented influence, settlement, or tribute rather than surveyed lines. Use this as an educational starting point, not a definitive source for legal, academic, or territorial claims.</p>
            <p>City, site, migration, trade, and expedition layers are selective teaching aids. Route lines join representative waypoints and do not claim to show every branch or an exact path.</p>
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
