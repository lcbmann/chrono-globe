import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CalendarDays, Database, GitCompareArrows, Globe2, Info, Layers3, LoaderCircle, Map as MapIcon, Menu, PanelRightOpen, Route, Share2, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { ChangePanel } from './components/ChangePanel'
import { CompareYearControl } from './components/CompareYearControl'
import { GlobeErrorBoundary } from './components/GlobeErrorBoundary'
import { IntroductionFlow } from './components/IntroductionFlow'
import { LayerPanel } from './components/LayerPanel'
import { StoryPanel } from './components/StoryPanel'
import { TerritoryPanel } from './components/TerritoryPanel'
import { Timeline } from './components/Timeline'
import { eventsNearYear, historicalEvents } from './data/events'
import { historicalPoints, historicalRoutes, layersForDeepLink, pointLayerKey, pointsForYear, routeLayerKey, routesForYear } from './data/layers'
import { getStory, historicalStories } from './data/stories'
import { prefetchCliopatriaPack, useCliopatriaTerritories } from './hooks/useCliopatriaData'
import { prefetchHistoricalMap, useDatasetIndex, useHistoricalMap } from './hooks/useHistoricalData'
import { useDialogFocus } from './hooks/useDialogFocus'
import { useSoundscape } from './hooks/useSoundscape'
import { buildChangeSet } from './lib/changes'
import { entityKey, groupEntities } from './lib/entities'
import { introductionVersion, shouldOfferIntroduction } from './lib/introduction'
import { composeTerritoryFeatures, findTerritoryPack, mergeHistoricalEntityIndexes, type TerritorySourceMode } from './lib/territoryData'
import { buildPlaybackYears, buildTimelineYears, findNearestYearIndex, formatYear, getEraLabel, getPlaybackDelay, getSnapshotTransition, type PlaybackRate } from './lib/time'
import { parseAtlasUrl, serializeAtlasUrl } from './lib/urlState'
import { defaultGlobeViewpoint } from './lib/viewpoint'
import type { ChangeSet, GlobeMode, GlobeViewpoint, HistoricalEntityIndex, HistoricalEvent, HistoricalFeature, HistoricalPoint, HistoricalRoute, Snapshot, TerritoryDataset } from './types'
import './App.css'

type MapSide = 'primary' | 'comparison'
interface FocusRequest { id: number; side: MapSide; frameId?: string; location?: { lat: number; lng: number } }
const GlobeView = lazy(() => import('./components/GlobeView').then((module) => ({ default: module.GlobeView })))
const emptyChangeSet: ChangeSet = { items: [], counts: { appeared: 0, disappeared: 0, expanded: 0, contracted: 0, control: 0, stable: 0 } }
const featuredEventYears = historicalEvents.map((event) => event.year)
const narrativeYears = [...new Set([...featuredEventYears, ...historicalStories.flatMap((story) => story.steps.map((step) => step.year))])]
const compactLayoutMedia = '(max-width: 680px), (max-width: 900px) and (max-height: 500px)'
const viewpointCommitDelay = 500
const sameShareViewpoint = (left: GlobeViewpoint | undefined, right: GlobeViewpoint) => Boolean(left
  && left.lat.toFixed(2) === right.lat.toFixed(2)
  && left.lng.toFixed(2) === right.lng.toFixed(2)
  && left.altitude.toFixed(2) === right.altitude.toFixed(2))
const initialUrl = parseAtlasUrl(window.location.search)
const initialStory = getStory(initialUrl.story || null)
const initialStoryStepIndex = initialStory?.steps.length ? Math.min(initialUrl.storyStep || 0, initialStory.steps.length - 1) : 0
const initialStoryStep = initialStory?.steps[initialStoryStepIndex]
const initialStoryEvent = historicalEvents.find((event) => event.id === (initialUrl.event || initialStoryStep?.eventId))
const initialPoint = initialStoryEvent ? undefined : historicalPoints.find((point) => point.id === (initialUrl.point || initialStoryStep?.pointId))
const initialRoute = initialStoryEvent ? undefined : historicalRoutes.find((route) => route.id === (initialUrl.route || initialStoryStep?.routeId))
const initialHasFocusTarget = Boolean(initialUrl.entity || initialStoryStep?.entity || initialStoryStep?.focus || initialStoryEvent || initialPoint || initialRoute)
const initialFocusSide: MapSide = initialUrl.compareYear !== undefined && initialUrl.side === 'comparison' ? 'comparison' : 'primary'
const initialLayers = layersForDeepLink(initialUrl.layers, initialPoint, initialRoute)
const territoryFrameNote = (
  mode: TerritorySourceMode,
  selectedYear: number | undefined,
  broadYear: number | undefined,
  detailReady: boolean,
  loading: boolean,
) => {
  if (loading) return selectedYear === undefined ? 'Loading reconstruction' : `Traveling to ${formatYear(selectedYear)}`
  if (mode === 'cliopatria') return detailReady && selectedYear !== undefined
    ? `Detailed source assertions for ${formatYear(selectedYear)}`
    : 'No detailed assertion at this date'
  if (mode === 'composite' && detailReady && selectedYear !== undefined) {
    return `Combined sources · broad frame ${broadYear === undefined ? 'unavailable' : formatYear(broadYear)}`
  }
  if (broadYear === undefined) return 'Reconstruction unavailable'
  return broadYear === selectedYear ? 'A mapped moment in history' : `Showing the ${formatYear(broadYear)} reconstruction`
}
const initialIntroductionEligible = (() => {
  try {
    return shouldOfferIntroduction(window.localStorage.getItem(introductionVersion), initialUrl)
  } catch {
    return shouldOfferIntroduction(null, initialUrl)
  }
})()

const usableFeatures = (map: ReturnType<typeof useHistoricalMap>['map']) => map?.features.filter(
  (item): item is HistoricalFeature => Boolean(item.properties?.NAME && item.properties.NAME !== '?'),
) || []
const emptyFeatures: HistoricalFeature[] = []

interface MapFrame {
  filename: string
  year: number
  features: HistoricalFeature[]
}

interface TerritoryFrame extends MapFrame {
  id: string
  targetYear: number
}

const useCommittedMapFrame = (snapshot: Snapshot | null, features: HistoricalFeature[], ready: boolean) => {
  const [frame, setFrame] = useState<MapFrame | null>(null)

  useEffect(() => {
    if (!snapshot) {
      setFrame(null)
      return
    }
    if (!ready) return
    setFrame((current) => current?.filename === snapshot.filename && current.features === features
      ? current
      : { filename: snapshot.filename, year: snapshot.year, features })
  }, [features, ready, snapshot])

  return frame
}

const useCommittedTerritoryFrame = (candidate: TerritoryFrame | null, ready: boolean) => {
  const [frame, setFrame] = useState<TerritoryFrame | null>(null)

  useEffect(() => {
    if (!candidate) {
      setFrame(null)
      return
    }
    if (!ready) return
    setFrame((current) => current?.id === candidate.id && current.features === candidate.features ? current : candidate)
  }, [candidate, ready])

  return frame
}

function App() {
  const { index, error: indexError, retry: retryIndex } = useDatasetIndex()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedKey, setSelectedKey] = useState<string | null>(initialUrl.entity || initialStoryStep?.entity || initialStoryEvent?.entity || initialPoint?.entity || null)
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(initialStoryEvent || null)
  const [selectedPoint, setSelectedPoint] = useState<HistoricalPoint | null>(initialPoint || null)
  const [selectedRoute, setSelectedRoute] = useState<HistoricalRoute | null>(initialRoute || null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const [watchingEntity, setWatchingEntity] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [introductionOpen, setIntroductionOpen] = useState(false)
  const [introductionInvitation, setIntroductionInvitation] = useState(initialIntroductionEligible)
  const [introductionAutoPending, setIntroductionAutoPending] = useState(initialIntroductionEligible)
  const [storyLibraryOpen, setStoryLibraryOpen] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState<string | null>(initialStory?.id || null)
  const [storyStep, setStoryStep] = useState(initialStoryStepIndex)
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  const [layers, setLayers] = useState(initialLayers)
  const [territorySourceMode, setTerritorySourceMode] = useState<TerritorySourceMode>('composite')
  const [comparisonOpen, setComparisonOpen] = useState(initialUrl.compareYear !== undefined)
  const [mobileCompareEditorOpen, setMobileCompareEditorOpen] = useState(false)
  const [comparisonIndex, setComparisonIndex] = useState(-1)
  const [changesOpen, setChangesOpen] = useState(false)
  const [viewpoint, setViewpoint] = useState<GlobeViewpoint | undefined>(initialUrl.view)
  const latestViewpointRef = useRef<GlobeViewpoint>(initialUrl.view || defaultGlobeViewpoint)
  const primaryViewpointRef = useRef<GlobeViewpoint>(initialUrl.view || defaultGlobeViewpoint)
  const comparisonViewpointRef = useRef<GlobeViewpoint>(initialUrl.view || defaultGlobeViewpoint)
  const viewpointTimerRef = useRef<number | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [globeMode, setGlobeMode] = useState<GlobeMode>(initialUrl.mode || 'atlas')
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(!initialStory && Boolean(initialUrl.entity || initialUrl.event || initialUrl.point || initialUrl.route))
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [activeMapSide, setActiveMapSide] = useState<MapSide>(initialFocusSide)
  const focusSequenceRef = useRef(initialHasFocusTarget ? 1 : 0)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(initialHasFocusTarget ? { id: 1, side: initialFocusSide, location: initialStoryStep?.focus } : null)
  const [mobileLayout, setMobileLayout] = useState(() => window.matchMedia(compactLayoutMedia).matches)
  const aboutDialogRef = useDialogFocus<HTMLElement>(aboutOpen, () => setAboutOpen(false))
  const mobileToolsDialogRef = useDialogFocus<HTMLDivElement>(mobileLayout && mobileToolsOpen, () => setMobileToolsOpen(false))
  const comparisonYearDialogRef = useDialogFocus<HTMLDivElement>(mobileLayout && mobileCompareEditorOpen, () => setMobileCompareEditorOpen(false))
  const requestFocus = useCallback((side: MapSide, frameId?: string, location?: { lat: number; lng: number }) => {
    focusSequenceRef.current += 1
    setFocusRequest({ id: focusSequenceRef.current, side, frameId, location })
  }, [])
  const consumeFocusRequest = useCallback((id: number) => {
    setFocusRequest((current) => current?.id === id ? null : current)
  }, [])
  const queueViewpointChange = useCallback((nextViewpoint: GlobeViewpoint) => {
    latestViewpointRef.current = nextViewpoint
    if (viewpointTimerRef.current !== null) window.clearTimeout(viewpointTimerRef.current)
    viewpointTimerRef.current = window.setTimeout(() => {
      const nextViewpoint = latestViewpointRef.current
      setViewpoint((current) => sameShareViewpoint(current, nextViewpoint) ? current : nextViewpoint)
      viewpointTimerRef.current = null
    }, viewpointCommitDelay)
  }, [])
  const recordPrimaryViewpoint = useCallback((nextViewpoint: GlobeViewpoint) => {
    primaryViewpointRef.current = nextViewpoint
    queueViewpointChange(nextViewpoint)
  }, [queueViewpointChange])
  const recordComparisonViewpoint = useCallback((nextViewpoint: GlobeViewpoint) => {
    comparisonViewpointRef.current = nextViewpoint
    queueViewpointChange(nextViewpoint)
  }, [queueViewpointChange])
  const activatePrimaryMap = useCallback((currentViewpoint?: GlobeViewpoint) => {
    if (currentViewpoint) primaryViewpointRef.current = currentViewpoint
    setActiveMapSide('primary')
    const nextViewpoint = currentViewpoint || primaryViewpointRef.current
    if (nextViewpoint) queueViewpointChange(nextViewpoint)
  }, [queueViewpointChange])
  const activateComparisonMap = useCallback((currentViewpoint?: GlobeViewpoint) => {
    if (currentViewpoint) comparisonViewpointRef.current = currentViewpoint
    setPlaying(false)
    setActiveMapSide('comparison')
    const nextViewpoint = currentViewpoint || comparisonViewpointRef.current
    if (nextViewpoint) queueViewpointChange(nextViewpoint)
  }, [queueViewpointChange])
  const activateMapSide = useCallback((side: MapSide) => {
    if (side === 'comparison') activateComparisonMap()
    else activatePrimaryMap()
  }, [activateComparisonMap, activatePrimaryMap])
  const { soundEnabled, toggleSound, chime } = useSoundscape()
  const {
    manifest: cliopatriaManifest,
    error: cliopatriaManifestError,
    retry: retryCliopatriaManifest,
  } = useCliopatriaTerritories(undefined, false)
  const snapshots = useMemo(() => index?.maps || [], [index])
  const detailedTerritoriesEnabled = territorySourceMode !== 'historical-basemaps'
  const historicalEntities = useMemo(
    () => mergeHistoricalEntityIndexes(
      (index?.entities || []).map((entity) => ({
        ...entity,
        datasetIds: entity.datasetIds?.length ? entity.datasetIds : ['historical-basemaps'],
      })),
      cliopatriaManifest?.entities || [],
    ),
    [cliopatriaManifest?.entities, index?.entities],
  )
  const territoryDatasets = useMemo<TerritoryDataset[]>(() => {
    const datasets = [...(index?.territoryDatasets || [])]
    if (cliopatriaManifest && !datasets.some((dataset) => dataset.id === cliopatriaManifest.datasetId)) {
      datasets.push({
        id: cliopatriaManifest.datasetId,
        title: cliopatriaManifest.title,
        sourceFamilyId: cliopatriaManifest.sourceFamilyId,
        source: cliopatriaManifest.source,
        license: cliopatriaManifest.license,
        licenseUrl: cliopatriaManifest.licenseUrl,
        revision: cliopatriaManifest.revision,
        scope: cliopatriaManifest.scope,
        coverage: cliopatriaManifest.coverage,
        methodology: cliopatriaManifest.methodology,
      })
    }
    return datasets
  }, [cliopatriaManifest, index?.territoryDatasets])
  const territoryFrameIdForYear = useCallback((baselineFilename: string | undefined, year: number | undefined) => {
    if (!baselineFilename || year === undefined) return baselineFilename
    const detailed = detailedTerritoriesEnabled && Boolean(findTerritoryPack(cliopatriaManifest, year))
    return `${baselineFilename}|${detailed ? `${territorySourceMode}:${year}` : 'historical-basemaps'}`
  }, [cliopatriaManifest, detailedTerritoriesEnabled, territorySourceMode])
  const frameIdForYear = useCallback((year: number) => {
    const nextTransition = getSnapshotTransition(snapshots, year)
    const current = snapshots[nextTransition.currentIndex]
    const next = snapshots[nextTransition.nextIndex]
    const baselineFilename = (nextTransition.progress >= .5 && next && next !== current ? next : current)?.filename
    return territoryFrameIdForYear(baselineFilename, year)
  }, [snapshots, territoryFrameIdForYear])
  const snapshotYears = useMemo(
    () => [...new Set([...snapshots.map((item) => item.year), ...(cliopatriaManifest?.changeYears || [])])].sort((left, right) => left - right),
    [cliopatriaManifest?.changeYears, snapshots],
  )
  const timelineYears = useMemo(
    () => buildTimelineYears(
      snapshots,
      [...narrativeYears, ...(cliopatriaManifest?.changeYears || [])],
      cliopatriaManifest?.coverage,
    ),
    [cliopatriaManifest?.changeYears, cliopatriaManifest?.coverage, snapshots],
  )
  const playbackYears = useMemo(
    () => buildPlaybackYears(
      snapshots,
      [...historicalEvents.map((event) => event.year), ...(cliopatriaManifest?.changeYears || [])],
      cliopatriaManifest?.coverage,
    ),
    [cliopatriaManifest?.changeYears, cliopatriaManifest?.coverage, snapshots],
  )
  const selectedYear = timelineYears[selectedIndex]
  const comparisonYear = timelineYears[comparisonIndex]
  const primaryCliopatria = useCliopatriaTerritories(selectedYear, detailedTerritoriesEnabled)
  const comparisonCliopatria = useCliopatriaTerritories(comparisonYear, detailedTerritoriesEnabled && comparisonOpen)
  const watchedEntity = useMemo(
    () => watchingEntity ? historicalEntities.find((entity) => entity.key === watchingEntity) || null : null,
    [historicalEntities, watchingEntity],
  )
  const transition = useMemo(
    () => selectedYear === undefined ? { currentIndex: -1, nextIndex: -1, progress: 0 } : getSnapshotTransition(snapshots, selectedYear),
    [selectedYear, snapshots],
  )
  const sourceIndex = transition.currentIndex
  const snapshot = snapshots[sourceIndex] || null
  const nextSnapshot = snapshots[transition.nextIndex] || null
  const targetSnapshot = transition.progress >= .5 && nextSnapshot && nextSnapshot !== snapshot ? nextSnapshot : snapshot
  const targetUsesNext = Boolean(targetSnapshot && targetSnapshot === nextSnapshot && nextSnapshot !== snapshot)
  const { map, loadedFilename, error: mapError, retry: retryMap } = useHistoricalMap(snapshot)
  const { map: pendingNextMap, loadedFilename: nextLoadedFilename, error: nextMapError, retry: retryNextMap } = useHistoricalMap(
    nextSnapshot !== snapshot && (targetUsesNext || playing || changesOpen) ? nextSnapshot : null,
  )
  const features = useMemo(
    () => loadedFilename === snapshot?.filename ? usableFeatures(map) : [],
    [loadedFilename, map, snapshot?.filename],
  )
  const nextFeatures = useMemo(
    () => nextLoadedFilename === nextSnapshot?.filename ? usableFeatures(pendingNextMap) : [],
    [nextLoadedFilename, nextSnapshot?.filename, pendingNextMap],
  )
  const targetFeatures = targetUsesNext ? nextFeatures : features
  const targetLoadedFilename = targetUsesNext ? nextLoadedFilename : loadedFilename
  const targetReady = Boolean(targetSnapshot && targetLoadedFilename === targetSnapshot.filename)
  const renderFrame = useCommittedMapFrame(targetSnapshot, targetFeatures, targetReady)
  const baselineDisplayFeatures = renderFrame?.features ?? emptyFeatures
  const primaryDetailExpected = Boolean(detailedTerritoriesEnabled && primaryCliopatria.pack)
  const primaryDetailSettled = !primaryDetailExpected || primaryCliopatria.ready || Boolean(primaryCliopatria.error)
  const candidateDisplayFeatures = useMemo(
    () => composeTerritoryFeatures(baselineDisplayFeatures, primaryCliopatria.features, territorySourceMode, selectedYear),
    [baselineDisplayFeatures, primaryCliopatria.features, selectedYear, territorySourceMode],
  )
  const expectedPrimaryFrameId = territoryFrameIdForYear(targetSnapshot?.filename, selectedYear)
  const primaryCandidateReady = Boolean(targetSnapshot && targetReady && renderFrame?.filename === targetSnapshot.filename
    && primaryDetailSettled && (territorySourceMode !== 'cliopatria' || !(primaryCliopatria.error || cliopatriaManifestError)))
  const primaryCandidateFrame = useMemo<TerritoryFrame | null>(() => renderFrame && expectedPrimaryFrameId && selectedYear !== undefined
    ? { ...renderFrame, id: expectedPrimaryFrameId, targetYear: selectedYear, features: candidateDisplayFeatures }
    : null, [candidateDisplayFeatures, expectedPrimaryFrameId, renderFrame, selectedYear])
  const committedPrimaryFrame = useCommittedTerritoryFrame(primaryCandidateFrame, primaryCandidateReady)
  const displayFeatures = committedPrimaryFrame?.features ?? emptyFeatures
  const primaryFrameId = committedPrimaryFrame?.id
  const displayLoading = Boolean(targetSnapshot && (
    !primaryCandidateReady || committedPrimaryFrame?.id !== expectedPrimaryFrameId
  ))
  const [renderedFrameId, setRenderedFrameId] = useState<string | null>(null)
  const playbackFrameReady = Boolean(expectedPrimaryFrameId && primaryCandidateReady
    && committedPrimaryFrame?.id === expectedPrimaryFrameId && renderedFrameId === expectedPrimaryFrameId)

  useEffect(() => {
    if (mobileLayout && comparisonOpen && activeMapSide === 'comparison') setRenderedFrameId(null)
  }, [activeMapSide, comparisonOpen, mobileLayout])

  const comparisonTransition = useMemo(
    () => comparisonYear === undefined ? { currentIndex: -1, nextIndex: -1, progress: 0 } : getSnapshotTransition(snapshots, comparisonYear),
    [comparisonYear, snapshots],
  )
  const comparisonSnapshot = snapshots[comparisonTransition.currentIndex] || null
  const comparisonNextSnapshot = snapshots[comparisonTransition.nextIndex] || null
  const comparisonTargetSnapshot = comparisonTransition.progress >= .5 && comparisonNextSnapshot && comparisonNextSnapshot !== comparisonSnapshot
    ? comparisonNextSnapshot
    : comparisonSnapshot
  const comparisonUsesNext = Boolean(comparisonTargetSnapshot && comparisonTargetSnapshot === comparisonNextSnapshot && comparisonNextSnapshot !== comparisonSnapshot)
  const { map: comparisonMap, loadedFilename: comparisonLoadedFilename, error: comparisonMapError, retry: retryComparisonMap } = useHistoricalMap(comparisonOpen ? comparisonSnapshot : null)
  const { map: pendingComparisonNextMap, loadedFilename: comparisonNextLoadedFilename, error: comparisonNextMapError, retry: retryComparisonNextMap } = useHistoricalMap(comparisonOpen && comparisonUsesNext ? comparisonNextSnapshot : null)
  const comparisonFeatures = useMemo(
    () => comparisonLoadedFilename === comparisonSnapshot?.filename ? usableFeatures(comparisonMap) : [],
    [comparisonLoadedFilename, comparisonMap, comparisonSnapshot?.filename],
  )
  const comparisonNextFeatures = useMemo(
    () => comparisonNextLoadedFilename === comparisonNextSnapshot?.filename ? usableFeatures(pendingComparisonNextMap) : [],
    [comparisonNextLoadedFilename, comparisonNextSnapshot?.filename, pendingComparisonNextMap],
  )
  const comparisonTargetFeatures = comparisonUsesNext ? comparisonNextFeatures : comparisonFeatures
  const comparisonTargetLoadedFilename = comparisonUsesNext ? comparisonNextLoadedFilename : comparisonLoadedFilename
  const comparisonTargetReady = Boolean(comparisonTargetSnapshot && comparisonTargetLoadedFilename === comparisonTargetSnapshot.filename)
  const comparisonFrame = useCommittedMapFrame(comparisonOpen ? comparisonTargetSnapshot : null, comparisonTargetFeatures, comparisonTargetReady)
  const baselineComparisonFeatures = comparisonFrame?.features ?? emptyFeatures
  const comparisonDetailExpected = Boolean(detailedTerritoriesEnabled && comparisonOpen && comparisonCliopatria.pack)
  const comparisonDetailSettled = !comparisonDetailExpected || comparisonCliopatria.ready || Boolean(comparisonCliopatria.error)
  const candidateComparisonFeatures = useMemo(
    () => composeTerritoryFeatures(baselineComparisonFeatures, comparisonCliopatria.features, territorySourceMode, comparisonYear),
    [baselineComparisonFeatures, comparisonCliopatria.features, comparisonYear, territorySourceMode],
  )
  const expectedComparisonFrameId = territoryFrameIdForYear(comparisonTargetSnapshot?.filename, comparisonYear)
  const comparisonCandidateReady = Boolean(comparisonOpen && comparisonTargetSnapshot && comparisonTargetReady
    && comparisonFrame?.filename === comparisonTargetSnapshot.filename && comparisonDetailSettled
    && (territorySourceMode !== 'cliopatria' || !(comparisonCliopatria.error || cliopatriaManifestError)))
  const comparisonCandidateFrame = useMemo<TerritoryFrame | null>(() => comparisonFrame && expectedComparisonFrameId && comparisonYear !== undefined
    ? { ...comparisonFrame, id: expectedComparisonFrameId, targetYear: comparisonYear, features: candidateComparisonFeatures }
    : null, [candidateComparisonFeatures, comparisonFrame, comparisonYear, expectedComparisonFrameId])
  const committedComparisonFrame = useCommittedTerritoryFrame(comparisonCandidateFrame, comparisonCandidateReady)
  const comparisonDisplayFeatures = committedComparisonFrame?.features ?? emptyFeatures
  const comparisonFrameId = committedComparisonFrame?.id
  const comparisonLoading = Boolean(comparisonOpen && comparisonTargetSnapshot && (
    !comparisonCandidateReady || committedComparisonFrame?.id !== expectedComparisonFrameId
  ))

  const entities = useMemo(() => groupEntities(displayFeatures), [displayFeatures])
  const comparisonEntities = useMemo(() => groupEntities(comparisonDisplayFeatures), [comparisonDisplayFeatures])
  const primaryDisplayYear = committedPrimaryFrame?.targetYear
  const comparisonDisplayYear = committedComparisonFrame?.targetYear
  const nearbyEvents = useMemo(() => primaryDisplayYear === undefined || !layers.events ? [] : eventsNearYear(primaryDisplayYear), [layers.events, primaryDisplayYear])
  const comparisonEvents = useMemo(() => comparisonDisplayYear === undefined || !layers.events ? [] : eventsNearYear(comparisonDisplayYear), [comparisonDisplayYear, layers.events])
  const overlayPoints = useMemo(() => primaryDisplayYear === undefined ? [] : pointsForYear(primaryDisplayYear, layers), [layers, primaryDisplayYear])
  const overlayRoutes = useMemo(() => primaryDisplayYear === undefined ? [] : routesForYear(primaryDisplayYear, layers), [layers, primaryDisplayYear])
  const comparisonPoints = useMemo(() => comparisonDisplayYear === undefined ? [] : pointsForYear(comparisonDisplayYear, layers), [comparisonDisplayYear, layers])
  const comparisonRoutes = useMemo(() => comparisonDisplayYear === undefined ? [] : routesForYear(comparisonDisplayYear, layers), [comparisonDisplayYear, layers])
  const activeStory = getStory(activeStoryId)
  const goToStoryStep = useCallback((nextStep: number, storyId: string | null = activeStoryId) => {
    const story = getStory(storyId)
    const step = story?.steps[nextStep]
    if (!story || !step) return
    activatePrimaryMap()
    const event = historicalEvents.find((item) => item.id === step.eventId) || null
    const point = historicalPoints.find((item) => item.id === step.pointId) || null
    const route = historicalRoutes.find((item) => item.id === step.routeId) || null
    if (point || route) {
      setLayers((current) => ({
        ...current,
        ...(point ? { [pointLayerKey(point)]: true } : {}),
        ...(route ? { [routeLayerKey(route)]: true } : {}),
      }))
    }
    requestFocus('primary', frameIdForYear(step.year), step.focus)
    setActiveStoryId(story.id)
    setStoryStep(nextStep)
    setSelectedIndex(findNearestYearIndex(timelineYears, step.year))
    setSelectedEvent(event)
    setSelectedKey(step.entity || event?.entity || point?.entity || null)
    setSelectedPoint(point)
    setSelectedRoute(route)
    setPlaying(false)
    setWatchingEntity(null)
    setMobileExplorerOpen(false)
  }, [activatePrimaryMap, activeStoryId, frameIdForYear, requestFocus, timelineYears])
  const changes = useMemo(() => {
    if (!changesOpen) return emptyChangeSet
    if (comparisonOpen && comparisonDisplayFeatures.length > 0) return buildChangeSet(comparisonDisplayFeatures, displayFeatures)
    return buildChangeSet(features, nextFeatures.length > 0 ? nextFeatures : features)
  }, [changesOpen, comparisonDisplayFeatures, comparisonOpen, displayFeatures, features, nextFeatures])
  const changeKinds = useMemo(() => new Map(changes.items.map((item) => [item.key, item.kind])), [changes])
  const sameSourceFrame = Boolean(comparisonOpen && primaryFrameId && primaryFrameId === comparisonFrameId)
  const changesLoading = changesOpen && (comparisonOpen
    ? comparisonLoading || displayLoading
    : Boolean(nextSnapshot && nextSnapshot !== snapshot && nextLoadedFilename !== nextSnapshot.filename))
  const explorerUsesComparison = comparisonOpen && activeMapSide === 'comparison'
  const explorerEntities = explorerUsesComparison ? comparisonEntities : entities
  const explorerEvents = explorerUsesComparison ? comparisonEvents : nearbyEvents
  const explorerYear = explorerUsesComparison ? comparisonDisplayYear ?? comparisonYear : primaryDisplayYear ?? selectedYear
  const explorerFrame = explorerUsesComparison ? committedComparisonFrame : committedPrimaryFrame
  const explorerLoading = explorerUsesComparison ? comparisonLoading : displayLoading

  useEffect(() => {
    const query = window.matchMedia(compactLayoutMedia)
    const updateLayout = () => setMobileLayout(query.matches)
    updateLayout()
    query.addEventListener('change', updateLayout)
    return () => query.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => () => {
    if (viewpointTimerRef.current !== null) window.clearTimeout(viewpointTimerRef.current)
  }, [])

  useEffect(() => {
    if (!index || (!cliopatriaManifest && !cliopatriaManifestError) || selectedIndex >= 0) return
    const years = buildTimelineYears(index.maps, [...narrativeYears, ...(cliopatriaManifest?.changeYears || [])], cliopatriaManifest?.coverage)
    const target = initialStoryStep?.year
      ?? initialUrl.year
      ?? initialStoryEvent?.year
      ?? initialPoint?.startYear
      ?? initialRoute?.startYear
      ?? -323
    setSelectedIndex(findNearestYearIndex(years, target))
    const compareTarget = initialUrl.compareYear ?? index.maps[Math.max(0, getSnapshotTransition(index.maps, target).currentIndex - 1)]?.year ?? -500
    setComparisonIndex(findNearestYearIndex(years, compareTarget))
  }, [cliopatriaManifest, cliopatriaManifestError, index, selectedIndex])

  useEffect(() => {
    if (!introductionAutoPending || !index || selectedIndex < 0) return
    setIntroductionAutoPending(false)
    setIntroductionInvitation(true)
    setIntroductionOpen(true)
  }, [index, introductionAutoPending, selectedIndex])

  useEffect(() => {
    if (!playing || selectedYear === undefined || !playbackFrameReady) return
    const targets = watchedEntity?.years || playbackYears
    const nextYear = targets.find((year) => year > selectedYear)
    const timer = window.setTimeout(() => {
      if (nextYear === undefined) {
        setPlaying(false)
        return
      }
      setSelectedIndex(findNearestYearIndex(timelineYears, nextYear))
    }, getPlaybackDelay(playbackRate, Boolean(watchedEntity)))
    return () => window.clearTimeout(timer)
  }, [playbackFrameReady, playbackRate, playbackYears, playing, selectedYear, timelineYears, watchedEntity])

  useEffect(() => {
    if (!playing || selectedYear === undefined || !playbackFrameReady) return
    const targets = watchedEntity?.years || playbackYears
    const upcomingYears = targets.filter((year) => year > selectedYear).slice(0, playbackRate > 1 ? 4 : 2)
    const queued = new Set<string>()
    upcomingYears.forEach((year) => {
      const nextTransition = getSnapshotTransition(snapshots, year)
      const current = snapshots[nextTransition.currentIndex]
      const next = snapshots[nextTransition.nextIndex]
      const target = nextTransition.progress >= .5 && next && next !== current ? next : current
      if (target && !queued.has(target.filename)) {
        queued.add(target.filename)
        void prefetchHistoricalMap(target)
      }
      if (detailedTerritoriesEnabled) void prefetchCliopatriaPack(findTerritoryPack(cliopatriaManifest, year))
    })
  }, [cliopatriaManifest, detailedTerritoriesEnabled, playbackFrameReady, playbackRate, playbackYears, playing, selectedYear, snapshots, watchedEntity])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false)
    }
    const pauseOnPageHide = () => setPlaying(false)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    window.addEventListener('pagehide', pauseOnPageHide)
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      window.removeEventListener('pagehide', pauseOnPageHide)
    }
  }, [])

  useEffect(() => {
    if (!selectedKey || selectedEvent || selectedPoint || selectedRoute || activeStory || watchingEntity || explorerLoading || !explorerFrame) return
    if (!explorerEntities.some((entity) => entity.key === selectedKey)) setSelectedKey(null)
  }, [activeStory, explorerEntities, explorerFrame, explorerLoading, selectedEvent, selectedKey, selectedPoint, selectedRoute, watchingEntity])

  useEffect(() => {
    if (selectedYear === undefined) return
    const timer = window.setTimeout(() => {
      const search = serializeAtlasUrl({
        year: selectedYear,
        entity: selectedEvent || selectedPoint || selectedRoute ? undefined : selectedKey || undefined,
        event: selectedEvent?.id,
        point: selectedPoint?.id,
        route: selectedRoute?.id,
        mode: globeMode,
        compareYear: comparisonOpen ? comparisonYear : undefined,
        side: comparisonOpen && activeMapSide === 'comparison' ? 'comparison' : undefined,
        story: activeStoryId || undefined,
        storyStep: activeStoryId ? storyStep : undefined,
        layers,
        view: viewpoint,
      })
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [activeMapSide, activeStoryId, comparisonOpen, comparisonYear, globeMode, layers, selectedEvent, selectedKey, selectedPoint, selectedRoute, selectedYear, storyStep, viewpoint])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const modalOpen = introductionOpen || aboutOpen || storyLibraryOpen || layerPanelOpen
      if (event.key === 'Escape') {
        if (modalOpen) return
        if (mobileToolsOpen) setMobileToolsOpen(false)
        else if (mobileExplorerOpen) setMobileExplorerOpen(false)
        return
      }
      if (modalOpen || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof HTMLElement && event.target.closest('button,a,input,select,textarea,[role="button"],[contenteditable="true"]')) return
      if (activeStoryId) {
        if (event.key === ' ') event.preventDefault()
        if (event.key === 'ArrowLeft' && storyStep > 0) {
          event.preventDefault()
          goToStoryStep(storyStep - 1)
        }
        if (event.key === 'ArrowRight' && storyStep < (getStory(activeStoryId)?.steps.length || 0) - 1) {
          event.preventDefault()
          goToStoryStep(storyStep + 1)
        }
        return
      }
      if (event.key === 'ArrowLeft' && selectedIndex > 0) {
        activatePrimaryMap()
        setSelectedIndex(selectedIndex - 1)
        setPlaying(false)
        setWatchingEntity(null)
        setActiveStoryId(null)
        setSelectedEvent(null)
        setSelectedPoint(null)
        setSelectedRoute(null)
      }
      if (event.key === 'ArrowRight' && selectedIndex < timelineYears.length - 1) {
        activatePrimaryMap()
        setSelectedIndex(selectedIndex + 1)
        setPlaying(false)
        setWatchingEntity(null)
        setActiveStoryId(null)
        setSelectedEvent(null)
        setSelectedPoint(null)
        setSelectedRoute(null)
      }
      if (event.key === ' ') {
        event.preventDefault()
        if (!playing) {
          activatePrimaryMap()
          if (!watchedEntity) {
            setActiveStoryId(null)
            setSelectedEvent(null)
            setSelectedPoint(null)
            setSelectedRoute(null)
          }
        }
        if (!playing && watchedEntity && selectedYear !== undefined && selectedYear >= watchedEntity.lastYear) {
          setSelectedIndex(findNearestYearIndex(timelineYears, watchedEntity.firstYear))
        } else if (!playing && !watchedEntity && selectedIndex >= timelineYears.length - 1) {
          setSelectedIndex(0)
        }
        setPlaying((current) => !current)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [aboutOpen, activatePrimaryMap, activeStoryId, goToStoryStep, introductionOpen, layerPanelOpen, mobileExplorerOpen, mobileToolsOpen, playing, selectedIndex, selectedYear, storyLibraryOpen, storyStep, timelineYears, watchedEntity])

  const pausePlayback = useCallback(() => setPlaying(false), [])

  const interruptPlayback = useCallback(() => {
    pausePlayback()
    setWatchingEntity(null)
  }, [pausePlayback])

  const selectYearIndex = (nextIndex: number) => {
    activatePrimaryMap()
    setSelectedIndex(nextIndex)
    interruptPlayback()
    setActiveStoryId(null)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    chime(330 + (nextIndex % 5) * 35)
  }

  const jumpToEntity = (entity: HistoricalEntityIndex) => {
    activatePrimaryMap()
    requestFocus('primary', frameIdForYear(entity.peakYear))
    setSelectedIndex(findNearestYearIndex(timelineYears, entity.peakYear))
    setSelectedKey(entity.key)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    interruptPlayback()
    setMobileExplorerOpen(true)
    chime(523.25)
  }

  const clearSelection = useCallback(() => {
    setFocusRequest(null)
    setSelectedKey(null)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    interruptPlayback()
  }, [interruptPlayback])

  const selectEvent = useCallback((event: HistoricalEvent, side: MapSide = 'primary') => {
    activateMapSide(side)
    requestFocus(side, side === 'comparison' ? comparisonFrameId : primaryFrameId)
    setSelectedEvent(event)
    setSelectedKey(event.entity || null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    interruptPlayback()
    setMobileExplorerOpen(true)
    chime(659.25)
  }, [activateMapSide, chime, comparisonFrameId, interruptPlayback, primaryFrameId, requestFocus])

  const selectPoint = useCallback((point: HistoricalPoint, side: MapSide = 'primary') => {
    activateMapSide(side)
    requestFocus(side, side === 'comparison' ? comparisonFrameId : primaryFrameId)
    setSelectedPoint(point)
    setSelectedKey(point.entity || null)
    setSelectedEvent(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    interruptPlayback()
    setMobileExplorerOpen(true)
    chime(554.37)
  }, [activateMapSide, chime, comparisonFrameId, interruptPlayback, primaryFrameId, requestFocus])

  const selectRoute = useCallback((route: HistoricalRoute, side: MapSide = 'primary') => {
    activateMapSide(side)
    requestFocus(side, side === 'comparison' ? comparisonFrameId : primaryFrameId)
    setSelectedRoute(route)
    setSelectedPoint(null)
    setSelectedEvent(null)
    setSelectedKey(null)
    setActiveStoryId(null)
    interruptPlayback()
    setMobileExplorerOpen(true)
    chime(392)
  }, [activateMapSide, chime, comparisonFrameId, interruptPlayback, primaryFrameId, requestFocus])

  const selectEntityKey = useCallback((key: string, side: MapSide = 'primary') => {
    activateMapSide(side)
    requestFocus(side, side === 'comparison' ? comparisonFrameId : primaryFrameId)
    interruptPlayback()
    setSelectedKey(key)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    setMobileExplorerOpen(true)
    chime(440)
  }, [activateMapSide, chime, comparisonFrameId, interruptPlayback, primaryFrameId, requestFocus])

  const selectPrimaryFeature = useCallback((feature: HistoricalFeature) => selectEntityKey(entityKey(feature), 'primary'), [selectEntityKey])
  const selectComparisonFeature = useCallback((feature: HistoricalFeature) => selectEntityKey(entityKey(feature), 'comparison'), [selectEntityKey])
  const selectPrimaryEvent = useCallback((event: HistoricalEvent) => selectEvent(event, 'primary'), [selectEvent])
  const selectComparisonEvent = useCallback((event: HistoricalEvent) => selectEvent(event, 'comparison'), [selectEvent])
  const selectPrimaryPoint = useCallback((point: HistoricalPoint) => selectPoint(point, 'primary'), [selectPoint])
  const selectComparisonPoint = useCallback((point: HistoricalPoint) => selectPoint(point, 'comparison'), [selectPoint])
  const selectPrimaryRoute = useCallback((route: HistoricalRoute) => selectRoute(route, 'primary'), [selectRoute])
  const selectComparisonRoute = useCallback((route: HistoricalRoute) => selectRoute(route, 'comparison'), [selectRoute])

  const watchEntityHistory = (entity: HistoricalEntityIndex) => {
    if (watchingEntity === entity.key && playing) {
      setPlaying(false)
      return
    }
    const restart = watchingEntity !== entity.key || selectedYear === undefined || selectedYear >= entity.lastYear
    if (restart) setSelectedIndex(findNearestYearIndex(timelineYears, entity.firstYear))
    activatePrimaryMap()
    requestFocus('primary', frameIdForYear(restart ? entity.firstYear : selectedYear as number))
    setSelectedKey(entity.key)
    setSelectedEvent(null)
    setSelectedPoint(null)
    setSelectedRoute(null)
    setActiveStoryId(null)
    setWatchingEntity(entity.key)
    setPlaying(true)
    setMobileExplorerOpen(false)
  }

  const toggleComparison = () => {
    pausePlayback()
    if (!comparisonOpen && comparisonIndex < 0) setComparisonIndex(Math.max(0, selectedIndex - 1))
    if (!comparisonOpen) {
      comparisonViewpointRef.current = latestViewpointRef.current || viewpoint
      setMobileCompareEditorOpen(false)
      activateMapSide(mobileLayout ? 'comparison' : 'primary')
      setActiveStoryId(null)
      setSelectedEvent(null)
      setSelectedPoint(null)
      setSelectedRoute(null)
      setStoryLibraryOpen(false)
      setMobileExplorerOpen(false)
    }
    else {
      activatePrimaryMap()
      setMobileCompareEditorOpen(false)
      setChangesOpen(false)
    }
    setComparisonOpen((current) => !current)
  }

  const swapComparison = () => {
    if (comparisonIndex < 0) return
    setSelectedIndex(comparisonIndex)
    setComparisonIndex(selectedIndex)
    if (activeMapSide === 'primary') activateComparisonMap()
    else activatePrimaryMap()
    interruptPlayback()
  }

  const selectChangedEntity = (item: (typeof changes.items)[number]) => {
    if (comparisonOpen) {
      selectEntityKey(item.key, item.kind === 'disappeared' ? 'comparison' : 'primary')
      return
    }
    if (item.kind === 'appeared' && nextSnapshot) {
      setSelectedIndex(findNearestYearIndex(timelineYears, nextSnapshot.year))
    }
    selectEntityKey(item.key, 'primary')
  }

  const shareCurrentView = async () => {
    const search = serializeAtlasUrl({
      year: selectedYear,
      entity: selectedEvent || selectedPoint || selectedRoute ? undefined : selectedKey || undefined,
      event: selectedEvent?.id,
      point: selectedPoint?.id,
      route: selectedRoute?.id,
      mode: globeMode,
      compareYear: comparisonOpen ? comparisonYear : undefined,
      side: comparisonOpen && activeMapSide === 'comparison' ? 'comparison' : undefined,
      story: activeStoryId || undefined,
      storyStep: activeStoryId ? storyStep : undefined,
      layers,
      view: latestViewpointRef.current || viewpoint,
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

  const closeIntroduction = () => {
    setIntroductionOpen(false)
    try {
      window.localStorage.setItem(introductionVersion, introductionVersion)
    } catch {
      // Browsing remains fully functional when storage is unavailable.
    }
  }

  const finishIntroductionWithExplorer = () => {
    closeIntroduction()
    setMobileToolsOpen(false)
    if (mobileLayout) setMobileExplorerOpen(true)
  }

  const finishIntroductionWithStories = () => {
    closeIntroduction()
    setMobileExplorerOpen(false)
    setMobileToolsOpen(false)
    setStoryLibraryOpen(true)
  }

  const replayIntroduction = () => {
    interruptPlayback()
    setAboutOpen(false)
    setStoryLibraryOpen(false)
    setLayerPanelOpen(false)
    setMobileExplorerOpen(false)
    setMobileToolsOpen(false)
    setIntroductionInvitation(false)
    setIntroductionOpen(true)
  }

  const primaryDetailError = territorySourceMode === 'cliopatria' ? primaryCliopatria.error || cliopatriaManifestError : null
  const comparisonDetailError = territorySourceMode === 'cliopatria' ? comparisonCliopatria.error || cliopatriaManifestError : null
  const visibleError = indexError || (targetUsesNext ? nextMapError : mapError) || primaryDetailError
  const comparisonError = (comparisonUsesNext ? comparisonNextMapError : comparisonMapError) || comparisonDetailError
  const retryVisibleData = indexError ? retryIndex
    : primaryDetailError ? (primaryCliopatria.error ? primaryCliopatria.retry : retryCliopatriaManifest)
      : targetUsesNext ? retryNextMap : retryMap
  const retryComparisonData = comparisonDetailError ? (comparisonCliopatria.error ? comparisonCliopatria.retry : retryCliopatriaManifest)
    : comparisonUsesNext ? retryComparisonNextMap : retryComparisonMap
  const territoryDatasetCount = new Set([
    ...(index?.territoryDatasets || []).map((dataset) => dataset.id),
    ...(cliopatriaManifest ? [cliopatriaManifest.datasetId] : []),
  ]).size
  const primarySourceNote = territoryFrameNote(
    territorySourceMode,
    selectedYear,
    committedPrimaryFrame?.year,
    primaryCliopatria.ready,
    displayLoading,
  )
  const comparisonSourceNote = territoryFrameNote(
    territorySourceMode,
    comparisonYear,
    committedComparisonFrame?.year,
    comparisonCliopatria.ready,
    comparisonLoading,
  )
  const primaryLoadingLabel = primaryDetailExpected && !primaryDetailSettled
    ? `Loading detailed territories for ${formatYear(selectedYear || 0)}`
    : `Loading the ${formatYear(targetSnapshot?.year || selectedYear || 0)} broad reconstruction`
  const comparisonLoadingLabel = comparisonDetailExpected && !comparisonDetailSettled
    ? `Loading detailed territories for ${formatYear(comparisonYear || 0)}`
    : `Loading the ${formatYear(comparisonTargetSnapshot?.year || comparisonYear || 0)} broad reconstruction`

  useEffect(() => {
    if (visibleError) setPlaying(false)
  }, [visibleError])

  return (
    <div className={`app-shell mode-${globeMode}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <div><strong>Chrono Globe</strong><span>The world, through time</span></div>
        </div>
        <div className="mobile-header-actions">
          <button type="button" data-dialog-return className={mobileExplorerOpen ? 'active' : ''} aria-expanded={mobileExplorerOpen} aria-controls="historical-explorer" onClick={() => { const opening = !mobileExplorerOpen; setMobileExplorerOpen(opening); setMobileToolsOpen(false); if (opening) { pausePlayback(); setChangesOpen(false); setActiveStoryId(null) } }}><PanelRightOpen size={17} /><span>Explore</span></button>
          <button type="button" data-dialog-return className={mobileToolsOpen ? 'active' : ''} aria-expanded={mobileToolsOpen} aria-controls="atlas-actions" onClick={() => { setMobileToolsOpen((current) => !current); setMobileExplorerOpen(false) }}>{mobileToolsOpen ? <X size={17} /> : <Menu size={17} />}<span>{mobileToolsOpen ? 'Close' : 'More'}</span></button>
        </div>
        {mobileToolsOpen && <button type="button" className="mobile-menu-backdrop" aria-label="Close atlas tools" onClick={() => setMobileToolsOpen(false)} />}
        <div
          ref={mobileToolsDialogRef}
          id="atlas-actions"
          className={`header-actions ${mobileToolsOpen ? 'mobile-open' : ''}`}
          role={mobileLayout && mobileToolsOpen ? 'dialog' : undefined}
          aria-modal={mobileLayout && mobileToolsOpen ? true : undefined}
          aria-label={mobileLayout && mobileToolsOpen ? 'Atlas tools' : undefined}
        >
          {index && <span className="dataset-status" title={`${territoryDatasetCount} independently registered territory collections and ${snapshotYears.length} dated source changes`}><Database size={14} /> {territoryDatasetCount} territory sources</span>}
          <nav className="atlas-tools" aria-label="Atlas tools">
            <button type="button" onClick={() => { pausePlayback(); setStoryLibraryOpen(true); setMobileToolsOpen(false) }}><Sparkles size={14} /> Stories</button>
            <button type="button" onClick={() => { pausePlayback(); setLayerPanelOpen(true); setMobileToolsOpen(false) }}><Layers3 size={14} /> Layers</button>
            <button type="button" className={comparisonOpen ? 'active' : ''} aria-pressed={comparisonOpen} onClick={() => { toggleComparison(); setMobileToolsOpen(false) }}><GitCompareArrows size={14} /> Compare</button>
            <button type="button" className={changesOpen ? 'active' : ''} aria-pressed={changesOpen} onClick={() => { pausePlayback(); setChangesOpen((current) => !current); setMobileToolsOpen(false) }}><Route size={14} /> Changes</button>
          </nav>
          <div className="segmented-control" aria-label="Globe appearance">
            <button type="button" className={globeMode === 'atlas' ? 'active' : ''} aria-pressed={globeMode === 'atlas'} onClick={() => { setGlobeMode('atlas'); setMobileToolsOpen(false) }} title="Dark atlas with coordinate grid"><MapIcon size={14} /> Atlas</button>
            <button type="button" className={globeMode === 'historical' ? 'active' : ''} aria-pressed={globeMode === 'historical'} onClick={() => { setGlobeMode('historical'); setMobileToolsOpen(false) }} title="Parchment-style historical globe"><BookOpen size={14} /> Parchment</button>
            <button type="button" className={globeMode === 'earth' ? 'active' : ''} aria-pressed={globeMode === 'earth'} onClick={() => { setGlobeMode('earth'); setMobileToolsOpen(false) }} title="Satellite-style physical Earth"><Globe2 size={14} /> Earth</button>
          </div>
          <button type="button" className="header-icon-button" onClick={() => { toggleSound(); setMobileToolsOpen(false) }} aria-label={soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'} title={soundEnabled ? 'Mute ambient sound' : 'Enable subtle ambient sound'}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span className="mobile-action-label">{soundEnabled ? 'Mute sound' : 'Enable sound'}</span>
          </button>
          <button type="button" className={`header-icon-button ${shareCopied ? 'copied' : ''}`} onClick={() => { void shareCurrentView(); setMobileToolsOpen(false) }} aria-label={shareCopied ? 'Link copied' : 'Copy shareable link'} title={shareCopied ? 'Link copied' : 'Copy this exact view'}><Share2 size={15} /><span className="mobile-action-label">{shareCopied ? 'Link copied' : 'Copy view link'}</span></button>
          <button type="button" className="about-button" onClick={() => { pausePlayback(); setAboutOpen(true); setMobileToolsOpen(false) }}><Info size={16} /> About</button>
        </div>
      </header>

      <main className={`workspace ${comparisonOpen ? `comparison-active mobile-compare-${activeMapSide}` : ''}`}>
        {comparisonOpen && comparisonYear !== undefined && (
          <div className="mobile-comparison-switch" aria-label="Choose comparison map">
            <button type="button" className={activeMapSide === 'primary' ? 'active side-option' : 'side-option'} aria-pressed={activeMapSide === 'primary'} aria-label={`Show primary map, ${selectedYear === undefined ? 'current year' : formatYear(selectedYear)}`} onClick={() => activatePrimaryMap()}>{selectedYear === undefined ? 'Current' : formatYear(selectedYear)}</button>
            <button type="button" className={activeMapSide === 'comparison' ? 'active side-option' : 'side-option'} aria-pressed={activeMapSide === 'comparison'} aria-label={`Show comparison map, ${formatYear(comparisonYear)}`} onClick={() => activateComparisonMap()}>{formatYear(comparisonYear)}</button>
            <button type="button" className={`mobile-compare-action ${mobileCompareEditorOpen ? 'active' : ''}`} aria-expanded={mobileCompareEditorOpen} aria-controls="comparison-year-editor" onClick={() => { if (!mobileCompareEditorOpen) activateComparisonMap(); setMobileCompareEditorOpen((current) => !current) }} aria-label="Edit comparison year" title="Edit comparison year"><CalendarDays size={13} /></button>
            <button type="button" className="mobile-compare-action" onClick={swapComparison} aria-label="Swap comparison years" title="Swap comparison years"><GitCompareArrows size={13} /></button>
            <button type="button" className="mobile-compare-action" onClick={toggleComparison} aria-label="Close comparison" title="Close comparison"><X size={14} /></button>
          </div>
        )}
        <section className="globe-column primary-globe" aria-busy={displayLoading}>
          <div className="time-readout" aria-live="polite">
            <span>{selectedYear !== undefined ? getEraLabel(selectedYear) : 'Opening the globe'}</span>
            <h1>{selectedYear !== undefined ? formatYear(selectedYear) : '—'}</h1>
            {targetSnapshot && <small className={`source-frame-note ${!displayLoading && (primaryCliopatria.ready || committedPrimaryFrame?.year === selectedYear) ? 'exact' : ''}`}>{primarySourceNote}</small>}
          </div>
          {(!mobileLayout || !comparisonOpen || activeMapSide === 'primary') && (
            <GlobeErrorBoundary label="The historical globe"><Suspense fallback={<div className="globe-loading"><LoaderCircle size={18} className="spin" /> Preparing the globe</div>}><GlobeView
              features={displayFeatures}
              active={!mobileLayout || !mobileExplorerOpen}
              focusRequest={focusRequest?.side === 'primary' ? focusRequest : null}
              onFocusRequestHandled={consumeFocusRequest}
              frameId={primaryFrameId}
              onFrameReady={setRenderedFrameId}
              selectedKey={selectedKey}
              events={nearbyEvents}
              points={overlayPoints}
              routes={overlayRoutes}
              selectedEvent={activeMapSide === 'primary' ? selectedEvent : null}
              selectedPoint={activeMapSide === 'primary' ? selectedPoint : null}
              selectedRoute={activeMapSide === 'primary' ? selectedRoute : null}
              mode={globeMode}
              territorySourceMode={territorySourceMode}
              showChanges={changesOpen && !sameSourceFrame}
              changeKinds={changeKinds}
              initialViewRef={primaryViewpointRef}
              onViewChange={activeMapSide === 'primary' ? recordPrimaryViewpoint : undefined}
              onActivate={activatePrimaryMap}
              history={historicalEntities}
              onSelect={selectPrimaryFeature}
              onEventSelect={selectPrimaryEvent}
              onPointSelect={selectPrimaryPoint}
              onRouteSelect={selectPrimaryRoute}
              onClearSelection={clearSelection}
            /></Suspense></GlobeErrorBoundary>
          )}
          <StoryPanel
            libraryOpen={storyLibraryOpen}
            activeStory={activeStory}
            stepIndex={storyStep}
            onLibraryClose={() => setStoryLibraryOpen(false)}
            onStorySelect={(story) => { setStoryLibraryOpen(false); goToStoryStep(0, story.id) }}
            onStepChange={goToStoryStep}
            onExit={() => setActiveStoryId(null)}
            onBrowseStories={() => { setActiveStoryId(null); setStoryLibraryOpen(true) }}
            loading={displayLoading}
            sourceYear={renderFrame?.year}
          />
          {(displayLoading || (!index && !visibleError)) && <div className="loading-pill" role="status"><LoaderCircle size={15} className="spin" /> {!index ? 'Preparing the historical atlas' : primaryLoadingLabel}</div>}
          {visibleError && (
            <div className="error-card" role="alert">
              <strong>The historical map could not be loaded.</strong><span>{visibleError}</span>
              <button type="button" onClick={retryVisibleData}>Try again</button>
            </div>
          )}
        </section>

        {comparisonOpen && comparisonYear !== undefined && (
          <section className="globe-column comparison-globe" aria-label={`Comparison globe for ${formatYear(comparisonYear)}`} aria-busy={comparisonLoading}>
            <div className="time-readout compare-readout">
              <span>Comparison view</span>
              <h1>{formatYear(comparisonYear)}</h1>
              <small className={`source-frame-note ${!comparisonLoading && (comparisonCliopatria.ready || committedComparisonFrame?.year === comparisonYear) ? 'exact' : ''}`}>{comparisonSourceNote}</small>
              <div
                ref={comparisonYearDialogRef}
                id="comparison-year-editor"
                className={`comparison-year-editor ${mobileCompareEditorOpen ? 'mobile-open' : ''}`}
                role={mobileLayout && mobileCompareEditorOpen ? 'dialog' : undefined}
                aria-modal={mobileLayout && mobileCompareEditorOpen ? true : undefined}
                aria-label={mobileLayout && mobileCompareEditorOpen ? 'Choose comparison year' : undefined}
              >
                <CompareYearControl years={timelineYears} year={comparisonYear} onChange={(nextIndex) => { setComparisonIndex(nextIndex); setMobileCompareEditorOpen(false) }} onSwap={swapComparison} />
              </div>
            </div>
            {(!mobileLayout || activeMapSide === 'comparison') && (
              <GlobeErrorBoundary label="The comparison globe"><Suspense fallback={<div className="globe-loading"><LoaderCircle size={18} className="spin" /> Preparing comparison</div>}><GlobeView
                features={comparisonDisplayFeatures}
                active={!mobileLayout || !mobileExplorerOpen}
                frameId={comparisonFrameId}
                focusRequest={focusRequest?.side === 'comparison' ? focusRequest : null}
                onFocusRequestHandled={consumeFocusRequest}
                selectedKey={selectedKey}
                events={comparisonEvents}
                points={comparisonPoints}
                routes={comparisonRoutes}
                selectedEvent={activeMapSide === 'comparison' ? selectedEvent : null}
                selectedPoint={activeMapSide === 'comparison' ? selectedPoint : null}
                selectedRoute={activeMapSide === 'comparison' ? selectedRoute : null}
                mode={globeMode}
                territorySourceMode={territorySourceMode}
                showChanges={changesOpen && !sameSourceFrame}
                changeKinds={changeKinds}
                initialViewRef={comparisonViewpointRef}
                onViewChange={activeMapSide === 'comparison' ? recordComparisonViewpoint : undefined}
                onActivate={activateComparisonMap}
                history={historicalEntities}
                onSelect={selectComparisonFeature}
                onEventSelect={selectComparisonEvent}
                onPointSelect={selectComparisonPoint}
                onRouteSelect={selectComparisonRoute}
                onClearSelection={clearSelection}
              /></Suspense></GlobeErrorBoundary>
            )}
            {comparisonLoading && <div className="loading-pill" role="status"><LoaderCircle size={15} className="spin" /> {comparisonLoadingLabel}</div>}
            {comparisonError && <div className="error-card" role="alert"><strong>The comparison map could not be loaded.</strong><span>{comparisonError}</span><button type="button" onClick={retryComparisonData}>Try again</button></div>}
          </section>
        )}

        {changesOpen && selectedYear !== undefined && (comparisonOpen ? comparisonYear !== undefined : nextSnapshot) && (
          <ChangePanel
            changes={changes}
            fromYear={comparisonOpen ? comparisonYear as number : snapshot?.year || selectedYear}
            toYear={comparisonOpen ? selectedYear : nextSnapshot?.year || selectedYear}
            loading={changesLoading}
            sameSourceFrame={sameSourceFrame}
            onClose={() => setChangesOpen(false)}
            onEntitySelect={selectChangedEntity}
          />
        )}

        {mobileExplorerOpen && <button type="button" className="mobile-explorer-backdrop" aria-label="Close historical explorer" onClick={() => setMobileExplorerOpen(false)} />}
        <TerritoryPanel
          mobileLayout={mobileLayout}
          mobileOpen={mobileExplorerOpen}
          onMobileClose={() => setMobileExplorerOpen(false)}
          entities={explorerEntities}
          loading={explorerLoading}
          history={historicalEntities}
          selectedKey={selectedKey}
          selectedEvent={selectedEvent}
          selectedPoint={selectedPoint}
          selectedRoute={selectedRoute}
          nearbyEvents={explorerEvents}
          year={explorerYear}
          query={query}
          onQueryChange={(nextQuery) => { setQuery(nextQuery); if (nextQuery.trim()) pausePlayback() }}
          onSelect={(entity) => selectEntityKey(entity.key, explorerUsesComparison ? 'comparison' : 'primary')}
          onHistoricalSelect={jumpToEntity}
          onEventSelect={(event) => selectEvent(event, explorerUsesComparison ? 'comparison' : 'primary')}
          onHistoryYearSelect={(target) => selectYearIndex(findNearestYearIndex(timelineYears, target))}
          onWatchEntity={watchEntityHistory}
          onOpenStories={() => { pausePlayback(); setStoryLibraryOpen(true); setMobileExplorerOpen(false) }}
          watchingEntity={watchingEntity}
          entityWatchPlaying={playing && Boolean(watchingEntity)}
          sourceYear={territorySourceMode === 'cliopatria' ? undefined : explorerFrame?.year}
          datasetSource={index?.source}
          sourceCommit={index?.sourceCommit}
          license={index?.license}
          territoryDatasets={territoryDatasets}
          onClear={clearSelection}
        />
      </main>

      <Timeline
        years={timelineYears}
        sourceYears={snapshotYears}
        featuredYears={featuredEventYears}
        selectedIndex={selectedIndex}
        playing={playing}
        playbackRate={playbackRate}
        waiting={playing && !playbackFrameReady}
        watching={watchedEntity ? { name: watchedEntity.name, firstYear: watchedEntity.firstYear, lastYear: watchedEntity.lastYear } : null}
        onSelectedIndexChange={selectYearIndex}
        onPlaybackRateChange={setPlaybackRate}
        onPlayingChange={(nextPlaying) => {
          if (nextPlaying) {
            activatePrimaryMap()
            if (!watchedEntity) {
              setActiveStoryId(null)
              setSelectedEvent(null)
              setSelectedPoint(null)
              setSelectedRoute(null)
            }
          }
          if (nextPlaying && watchedEntity && selectedYear !== undefined && selectedYear >= watchedEntity.lastYear) {
            setSelectedIndex(findNearestYearIndex(timelineYears, watchedEntity.firstYear))
          } else if (nextPlaying && !watchedEntity && selectedIndex >= timelineYears.length - 1) {
            setSelectedIndex(0)
          }
          setPlaying(nextPlaying)
        }}
        onStopWatching={interruptPlayback}
      />

      <LayerPanel
        open={layerPanelOpen}
        layers={layers}
        territorySourceMode={territorySourceMode}
        detailedTerritoriesAvailable={Boolean(cliopatriaManifest)}
        onChange={setLayers}
        onTerritorySourceModeChange={(mode) => {
          pausePlayback()
          setTerritorySourceMode(mode)
          setRenderedFrameId(null)
        }}
        onClose={() => setLayerPanelOpen(false)}
      />

      <IntroductionFlow
        open={introductionOpen}
        startWithInvitation={introductionInvitation}
        mappedMoments={index?.maps.length}
        onClose={closeIntroduction}
        onOpenExplorer={finishIntroductionWithExplorer}
        onOpenStories={finishIntroductionWithStories}
      />

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section ref={aboutDialogRef} className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setAboutOpen(false)} aria-label="Close about dialog">×</button>
            <div className="eyebrow">About Chrono Globe</div>
            <h2 id="about-title" tabIndex={-1} data-dialog-focus>History has fuzzy edges.</h2>
            <p>The timeline combines regular steps, broad world maps, 508 interval-boundary dates from Seshat Cliopatria, and featured moments. The Layers dialog lets you inspect either collection alone or keep the calm combined view.</p>
            <p>Timelapse commits each broad-and-detailed frame as one unit before cross-fading. The transition is for orientation and never invents an in-between border or resolves disagreement between sources.</p>
            <p>Ancient borders often represented influence, settlement, or tribute rather than surveyed lines. Use this as an educational starting point, not a definitive source for legal, academic, or territorial claims.</p>
            <p>City, site, migration, trade, and expedition layers are selective teaching aids. Route lines join representative waypoints and do not claim to show every branch or an exact path.</p>
            <div className="confidence-legend">
              <span><i className="precision precision-1" /> Approximate</span><span><i className="precision precision-2" /> Moderate</span><span><i className="precision precision-3" /> Documented</span>
            </div>
            <div className="about-shortcuts"><span><kbd>Space</kbd> Play or pause</span><span><kbd>←</kbd><kbd>→</kbd> Step through time</span><span><kbd>Esc</kbd> Close open panels</span></div>
            <button type="button" className="about-introduction-button" onClick={replayIntroduction}><Sparkles size={14} /> Replay the introduction</button>
            <a href={index?.source || 'https://github.com/aourednik/historical-basemaps'} target="_blank" rel="noreferrer">Historical Basemaps data &amp; credits</a>
            <a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noreferrer">Seshat Cliopatria data &amp; credits</a>
            <a href="https://commons.wikimedia.org/wiki/File:Old_paper7.jpg" target="_blank" rel="noreferrer">Public-domain old-paper texture · Digital Yard Sale</a>
            <a href="https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/" target="_blank" rel="noreferrer">NASA Blue Marble imagery</a>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
