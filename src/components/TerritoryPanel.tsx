import { useEffect, useMemo, useState } from 'react'
import { geoCentroid, geoDistance } from 'd3-geo'
import { ArrowLeft, BookOpen, CalendarSearch, Compass, LoaderCircle, LocateFixed, MapPin, Pause, Play, Route, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { getCivilizationProfile } from '../data/civilizations'
import { commonsImageUrl, getCivilizationMedia } from '../data/civilizationMedia'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { entityColor } from '../lib/entities'
import { formatYear } from '../lib/time'
import type { EntitySummary, HistoricalEntityIndex, HistoricalEvent, HistoricalPoint, HistoricalRoute, TerritoryDataset } from '../types'
import { CivilizationMedia } from './CivilizationMedia'

interface TerritoryPanelProps {
  mobileLayout?: boolean
  mobileOpen?: boolean
  onMobileClose?: () => void
  loading?: boolean
  entities: EntitySummary[]
  history: HistoricalEntityIndex[]
  selectedKey: string | null
  selectedEvent: HistoricalEvent | null
  selectedPoint: HistoricalPoint | null
  selectedRoute: HistoricalRoute | null
  nearbyEvents: HistoricalEvent[]
  year: number | undefined
  query: string
  onQueryChange: (query: string) => void
  onSelect: (entity: EntitySummary) => void
  onHistoricalSelect: (entity: HistoricalEntityIndex) => void
  onEventSelect: (event: HistoricalEvent) => void
  onHistoryYearSelect: (year: number) => void
  onWatchEntity: (entity: HistoricalEntityIndex) => void
  onOpenStories: () => void
  watchingEntity: string | null
  entityWatchPlaying: boolean
  sourceYear?: number
  datasetSource?: string
  sourceCommit?: string | null
  license?: string
  territoryDatasets?: TerritoryDataset[]
  onClear: () => void
}

const confidence = ['Unknown', 'Approximate extent', 'Moderate confidence', 'Documented boundary']
const culturalPattern = /culture|peoples?|tribes?|hunter|gatherer|pastoral|farmer|pottery|burial|tradition|speakers?|nomads?/i
const eras = {
  all: [-123000, 2024], ancient: [-123000, 500], medieval: [500, 1500], early: [1500, 1800], modern: [1800, 2024],
} as const
const resultPageSize = 120
const discoveryIdentity = (entity: EntitySummary) => getCivilizationProfile(entity.key)?.displayName.trim().toLocaleLowerCase() || null
const discoveryPriority = (entity: EntitySummary) => {
  const displayName = getCivilizationProfile(entity.key)?.displayName.trim().toLocaleLowerCase()
  const key = entity.key.trim().toLocaleLowerCase()
  return (displayName === key ? 10_000 : 0) + (!/^\(.+\)$/.test(entity.key.trim()) ? 1_000 : 0)
    + entity.datasetIds.length * 10 + entity.features.length
}

const regionForEntity = (entity: EntitySummary) => {
  const [lng, lat] = geoCentroid({ type: 'FeatureCollection', features: entity.features })
  if (lat < -8 && lng > 105) return 'oceania'
  if (lng < -30) return 'americas'
  if (lat < 37 && lng > -20 && lng < 55) return 'africa'
  if (lat >= 35 && lng >= -25 && lng < 60) return 'europe'
  if (lng >= 25) return 'asia'
  return 'other'
}

export function TerritoryPanel({
  mobileLayout = false, mobileOpen = false, onMobileClose, loading = false,
  entities, history, selectedKey, selectedEvent, selectedPoint, selectedRoute, nearbyEvents, year, query,
  onQueryChange, onSelect, onHistoricalSelect, onEventSelect, onHistoryYearSelect, onWatchEntity, watchingEntity, entityWatchPlaying,
  onOpenStories, sourceYear, datasetSource, sourceCommit, license, territoryDatasets = [], onClear,
}: TerritoryPanelProps) {
  const [entityFilter, setEntityFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [eraFilter, setEraFilter] = useState<keyof typeof eras>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [resultLimit, setResultLimit] = useState(resultPageSize)
  const closeMobileDialog = () => { onMobileClose?.() }
  const mobileDialogRef = useDialogFocus<HTMLElement>(mobileLayout && mobileOpen, closeMobileDialog)
  const selected = entities.find((entity) => entity.key === selectedKey)
  const historical = history.find((entity) => entity.key === selectedKey)
  const profile = selectedKey ? getCivilizationProfile(selectedKey) : undefined
  const media = selectedKey ? getCivilizationMedia(selectedKey) : undefined
  const evidenceDatasetIds = [...new Set([
    ...(selected?.datasetIds || []),
    ...(historical?.datasetIds || []),
    ...(!selected?.datasetIds?.length && !historical?.datasetIds?.length ? ['historical-basemaps'] : []),
  ])]
  const evidenceDatasets = evidenceDatasetIds
    .map((datasetId) => territoryDatasets.find((dataset) => dataset.id === datasetId))
    .filter((dataset): dataset is TerritoryDataset => Boolean(dataset))
  const normalizedQuery = query.trim().toLowerCase()
  const historyByKey = useMemo(() => new Map(history.map((entity) => [entity.key, entity])), [history])
  const searchableEntities = useMemo(() => entities.map((entity) => {
    const matchedProfile = getCivilizationProfile(entity.key)
    return {
      entity,
      matchedProfile,
      searchText: `${entity.name} ${entity.subject} ${entity.partOf || ''} ${entity.control || ''} ${matchedProfile?.displayName || ''} ${matchedProfile?.names.join(' ') || ''} ${entity.features.map((feature) => feature.properties.NAME).join(' ')}`.toLowerCase(),
    }
  }), [entities])
  const searchableHistory = useMemo(() => history.map((entity) => {
    const matchedProfile = getCivilizationProfile(entity.key)
    return {
      entity,
      matchedProfile,
      searchText: `${entity.name} ${entity.aliases.join(' ')} ${matchedProfile?.displayName || ''} ${matchedProfile?.names.join(' ') || ''}`.toLowerCase(),
    }
  }), [history])
  const regionByKey = useMemo(() => regionFilter === 'all'
    ? null
    : new Map(entities.map((entity) => [entity.key, regionForEntity(entity)])), [entities, regionFilter])
  const [eraStart, eraEnd] = eras[eraFilter]
  const rankedVisibleMatches = searchableEntities.filter(({ entity, matchedProfile, searchText }) => {
    const matchesType = entityFilter === 'all' || (entityFilter === 'profiled' ? Boolean(matchedProfile) : entityFilter === 'cultural' ? culturalPattern.test(entity.key) : !culturalPattern.test(entity.key))
    const matchesRegion = regionFilter === 'all' || regionByKey?.get(entity.key) === regionFilter
    const chronology = historyByKey.get(entity.key)
    const matchesEra = eraFilter === 'all' || Boolean(chronology && chronology.lastYear >= eraStart && chronology.firstYear <= eraEnd)
    return matchesType && matchesRegion && matchesEra && searchText.includes(normalizedQuery)
  }).map(({ entity }) => entity).sort((left, right) => normalizedQuery ? left.name.localeCompare(right.name) : (getCivilizationProfile(right.key)?.importance || 0) - (getCivilizationProfile(left.key)?.importance || 0) || left.name.localeCompare(right.name))
  const visibleMatches = (() => {
    const results: EntitySummary[] = []
    const profilePositions = new Map<string, number>()
    for (const entity of rankedVisibleMatches) {
      const identity = discoveryIdentity(entity)
      if (!identity) {
        results.push(entity)
        continue
      }
      const existingPosition = profilePositions.get(identity)
      if (existingPosition === undefined) {
        profilePositions.set(identity, results.length)
        results.push(entity)
      } else if (discoveryPriority(entity) > discoveryPriority(results[existingPosition])) {
        results[existingPosition] = entity
      }
    }
    return results
  })()
  const visibleKeys = new Set(visibleMatches.map((entity) => entity.key))
  const visibleProfileNames = new Set(visibleMatches.flatMap((entity) => {
    const displayName = getCivilizationProfile(entity.key)?.displayName.trim().toLowerCase()
    return displayName ? [displayName] : []
  }))
  const historicalMatches = normalizedQuery || eraFilter !== 'all'
    ? searchableHistory.filter(({ entity, matchedProfile, searchText }) => {
      const matchesEra = entity.lastYear >= eraStart && entity.firstYear <= eraEnd
      const matchesType = entityFilter === 'all' || (entityFilter === 'profiled' ? Boolean(matchedProfile) : entityFilter === 'cultural' ? culturalPattern.test(entity.key) : !culturalPattern.test(entity.key))
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery)
      const representedByVisibleProfile = matchedProfile && visibleProfileNames.has(matchedProfile.displayName.trim().toLowerCase())
      return !visibleKeys.has(entity.key) && !representedByVisibleProfile && matchesEra && matchesType && matchesQuery
    }).map(({ entity }) => entity).sort((left, right) => (getCivilizationProfile(right.key)?.importance || 0) - (getCivilizationProfile(left.key)?.importance || 0) || left.name.localeCompare(right.name))
    : []
  const hasDetail = Boolean(selected || historical || selectedEvent || selectedPoint || selectedRoute)
  const detailFocusKey = selectedEvent?.id || selectedPoint?.id || selectedRoute?.id || selected?.key || historical?.key || null
  const nearbyMoments = selectedEvent ? nearbyEvents.filter((event) => event.id !== selectedEvent.id).slice(0, 2) : []
  const relatedEntities = selected ? (() => {
    const center = geoCentroid({ type: 'FeatureCollection', features: selected.features })
    if (!center.every(Number.isFinite)) return []
    return entities
      .filter((entity) => entity.key !== selected.key && Boolean(getCivilizationProfile(entity.key)))
      .map((entity) => ({ entity, distance: geoDistance(center, geoCentroid({ type: 'FeatureCollection', features: entity.features })) }))
      .filter((item) => Number.isFinite(item.distance))
      .sort((left, right) => left.distance - right.distance || (getCivilizationProfile(right.entity.key)?.importance || 0) - (getCivilizationProfile(left.entity.key)?.importance || 0))
      .slice(0, 3)
      .map((item) => item.entity)
  })() : []
  const activeFilterCount = [entityFilter, regionFilter, eraFilter].filter((filter) => filter !== 'all').length
  const renderedVisibleMatches = visibleMatches.slice(0, resultLimit)
  const remainingResultSlots = Math.max(0, resultLimit - renderedVisibleMatches.length)
  const renderedHistoricalMatches = historicalMatches.slice(0, remainingResultSlots)
  const totalResultCount = visibleMatches.length + historicalMatches.length
  const renderedResultCount = renderedVisibleMatches.length + renderedHistoricalMatches.length
  const remainingResultCount = Math.max(0, totalResultCount - renderedResultCount)
  const nextResultCount = Math.min(resultPageSize, remainingResultCount)
  const shouldRenderResultRows = !mobileLayout || (mobileOpen && !hasDetail)

  useEffect(() => {
    if (!mobileLayout || !mobileOpen || !detailFocusKey) return
    const focusFrame = window.requestAnimationFrame(() => {
      mobileDialogRef.current?.querySelector<HTMLElement>('#historical-explorer-title')?.focus()
    })
    return () => window.cancelAnimationFrame(focusFrame)
  }, [detailFocusKey, mobileDialogRef, mobileLayout, mobileOpen])

  useEffect(() => {
    setResultLimit(resultPageSize)
  }, [entities, entityFilter, eraFilter, query, regionFilter])

  const resetDiscovery = () => {
    onQueryChange('')
    setEntityFilter('all')
    setRegionFilter('all')
    setEraFilter('all')
    setFiltersOpen(false)
  }
  const surpriseMe = () => {
    const candidates = visibleMatches.filter((entity) => getCivilizationProfile(entity.key))
    const pool = candidates.length > 0 ? candidates : visibleMatches
    const candidate = pool[Math.floor(Math.random() * pool.length)]
    if (candidate) onSelect(candidate)
  }

  return (
    <aside
      ref={mobileDialogRef}
      id="historical-explorer"
      className={`territory-panel ${mobileOpen ? 'mobile-open' : ''} ${hasDetail ? 'has-detail' : ''}`}
      role={mobileLayout && mobileOpen ? 'dialog' : undefined}
      aria-modal={mobileLayout && mobileOpen ? true : undefined}
      aria-labelledby={mobileLayout && mobileOpen ? 'historical-explorer-title' : undefined}
      aria-label={mobileLayout ? undefined : 'Historical explorer'}
      aria-hidden={mobileLayout && !mobileOpen}
      inert={mobileLayout && !mobileOpen}
    >
      <div className="mobile-panel-heading">
        <i aria-hidden="true" />
        <strong id="historical-explorer-title" tabIndex={mobileLayout ? -1 : undefined} data-dialog-focus={mobileLayout ? true : undefined}>{hasDetail ? 'Civilization details' : 'Explore history'}</strong>
        <button type="button" onClick={hasDetail ? onClear : onMobileClose} aria-label={hasDetail ? 'Back to explorer results' : 'Close historical explorer'}>
          {hasDetail ? <ArrowLeft size={17} /> : <X size={17} />}
        </button>
      </div>
      {hasDetail ? (
        <article className="entity-detail">
          <button type="button" className="close-detail" onClick={onClear} aria-label="Close details" title="Close details"><X size={18} /></button>
          {selectedEvent ? (
            <>
              <div className="eyebrow"><MapPin size={11} /> Historical moment · {formatYear(selectedEvent.year)}</div>
              <h2>{selectedEvent.title}</h2>
              <p className="profile-overview">{selectedEvent.description}</p>
              <a className="source-link" href={selectedEvent.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Read at {selectedEvent.source.title}</a>
              {nearbyMoments.length > 0 && (
                <section className="related-exploration" aria-label="More moments around this date">
                  <h3><CalendarSearch size={13} /> More around this date</h3>
                  <div className="related-links">{nearbyMoments.map((event) => <button type="button" key={event.id} onClick={() => onEventSelect(event)}><span>{formatYear(event.year)}</span><strong>{event.title}</strong></button>)}</div>
                </section>
              )}
            </>
          ) : selectedPoint ? (
            <>
              <div className="eyebrow"><MapPin size={11} /> Historical {selectedPoint.kind}</div>
              <h2>{selectedPoint.name}</h2>
              <div className="profile-meta standalone"><span>{formatYear(selectedPoint.startYear)}–{formatYear(selectedPoint.endYear)}</span></div>
              <p className="profile-overview">{selectedPoint.description}</p>
              <a className="source-link" href={selectedPoint.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Read at {selectedPoint.source.title}</a>
            </>
          ) : selectedRoute ? (
            <>
              <div className="eyebrow"><Route size={11} /> {selectedRoute.kind} layer · schematic</div>
              <h2>{selectedRoute.name}</h2>
              <div className="profile-meta standalone"><span>{formatYear(selectedRoute.startYear)}–{formatYear(selectedRoute.endYear)}</span></div>
              <p className="profile-overview">{selectedRoute.description}</p>
              <p className="detail-note">This line connects representative waypoints. It is not a complete network or a precisely surveyed historical path.</p>
              <a className="source-link" href={selectedRoute.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Read at {selectedRoute.source.title}</a>
            </>
          ) : (
            <>
              <div className="eyebrow">Civilization profile</div>
              <div className="detail-heading">
                <span className="color-swatch large" style={{ background: entityColor(selectedKey || '') }} />
                <h2>{profile?.displayName || selectedKey}</h2>
              </div>
              {profile ? (
                <>
                  <div className="profile-meta"><span>{profile.period}</span>{profile.capital && <span>Capital: {profile.capital}</span>}</div>
                  <CivilizationMedia name={profile.displayName} media={media} />
                  <p className="profile-overview">{profile.overview}</p>
                  <h3><Sparkles size={13} /> Why it matters</h3>
                  <p className="profile-legacy">{profile.legacy}</p>
                  <ul className="fact-list">{profile.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                  <a className="source-link" href={profile.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Learn more at {profile.source.title}</a>
                </>
              ) : (
                <>
                  <p className="profile-overview">The source atlas identifies {selectedKey} in {historical ? `reconstructions from ${formatYear(historical.firstYear)} to ${formatYear(historical.lastYear)}` : 'this reconstruction'}. The highlighted area represents the source’s best broad estimate of its historical reach, not a modern surveyed border.</p>
                  {selected && selected.features.length > 1 && <p className="detail-note">On the globe, this realm includes {selected.features.length} named regions, among them {selected.features.slice(0, 4).map((feature) => feature.properties.NAME).join(', ')}.</p>}
                  {selected?.partOf && <p className="detail-note">The dataset places it within {selected.partOf}{selected.control ? ` and records ${selected.control} as the controlling power` : ''}.</p>}
                  <p className="profile-legacy">This entry does not yet have a curated profile. Its map record is still useful for comparison, but names and political relationships can change between reconstructions.</p>
                </>
              )}
              {selected && <div className="detail-row"><span>Boundary</span><strong>{confidence[selected.precision]}</strong></div>}
              {historical && <div className="detail-row"><span>On the globe</span><strong>{formatYear(historical.firstYear)}–{formatYear(historical.lastYear)}</strong></div>}
              {historical && (
                <section className="entity-chronology" aria-label={`${profile?.displayName || historical.name} mapped chronology`}>
                  <h3><CalendarSearch size={13} /> Mapped chronology</h3>
                  <div className="chronology-track"><i /><b style={{ left: `${((historical.peakYear - historical.firstYear) / Math.max(1, historical.lastYear - historical.firstYear)) * 100}%` }} /></div>
                  <div className="chronology-actions">
                    <button type="button" onClick={() => onHistoryYearSelect(historical.firstYear)}><span>First</span>{formatYear(historical.firstYear)}</button>
                    <button type="button" onClick={() => onHistoryYearSelect(historical.peakYear)}><span>Largest</span>{formatYear(historical.peakYear)}</button>
                    <button type="button" onClick={() => onHistoryYearSelect(historical.lastYear)}><span>Last</span>{formatYear(historical.lastYear)}</button>
                  </div>
                  <button type="button" className={`watch-history ${watchingEntity === historical.key ? 'active' : ''}`} aria-pressed={watchingEntity === historical.key && entityWatchPlaying} onClick={() => onWatchEntity(historical)}>
                    {watchingEntity === historical.key && entityWatchPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                    {watchingEntity === historical.key ? entityWatchPlaying ? 'Pause mapped history' : year !== undefined && year >= historical.lastYear ? 'Replay mapped history' : 'Resume mapped history' : 'Watch its mapped history'}
                  </button>
                  <p>Chrono Globe does not infer predecessor or successor states where the source data does not explicitly establish that relationship.</p>
                </section>
              )}
              {relatedEntities.length > 0 && (
                <section className="related-exploration" aria-label="Nearby curated civilizations">
                  <h3><Compass size={13} /> Nearby in this map</h3>
                  <div className="related-links">{relatedEntities.map((entity) => <button type="button" key={entity.key} onClick={() => onSelect(entity)}><span className="color-swatch" style={{ background: entityColor(entity.key) }} /><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong></button>)}</div>
                  <p>Suggested by mapped proximity at this date, not a claim of direct contact.</p>
                </section>
              )}
              {(evidenceDatasets.length > 0 || datasetSource) && (
                <div className="map-source source-stack">
                  <span>Territory evidence</span>
                  <strong>{evidenceDatasets.length > 1 ? `${evidenceDatasets.length} source collections` : evidenceDatasets[0]?.title || 'Historical Basemaps'}</strong>
                  {sourceYear !== undefined && <small>Broad reconstruction frame: {formatYear(sourceYear)}</small>}
                  {evidenceDatasets.length > 0 ? evidenceDatasets.map((dataset) => (
                    <div className="map-source-entry" key={dataset.id}>
                      <a href={dataset.source} target="_blank" rel="noreferrer">{dataset.title}</a>
                      <small>{formatYear(dataset.coverage.startYear)}–{formatYear(dataset.coverage.endYear)} · {dataset.license} · {dataset.revision.value.slice(0, 8)}</small>
                    </div>
                  )) : (
                    <>
                      <a href={datasetSource} target="_blank" rel="noreferrer">Source dataset</a>
                      {sourceCommit && <small>Revision {sourceCommit.slice(0, 8)}</small>}
                      {license && <small>{license}</small>}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </article>
      ) : (
        <div className="panel-intro">
          <div className="eyebrow">In {year === undefined ? 'this moment in history' : formatYear(year)}</div>
          <h2>{loading && entities.length === 0 ? 'Loading this historical map…' : `${entities.length.toLocaleString()} political and cultural entities`}</h2>
          <p>{loading && entities.length === 0 ? 'Search across all of history while the source reconstruction is prepared.' : 'Select a region, search across all of history, or open a nearby event.'}</p>
          <div className="panel-quick-start" aria-label="Ways to begin exploring">
            <button type="button" onClick={onOpenStories}><Sparkles size={13} /><span><strong>Follow a story</strong><small>Read a guided historical narrative</small></span></button>
            <button type="button" onClick={surpriseMe} disabled={visibleMatches.length === 0}><Compass size={13} /><span><strong>Surprise me</strong><small>Open a notable civilization</small></span></button>
          </div>
        </div>
      )}

      {nearbyEvents.length > 0 && !selectedEvent && (
        <section className="event-strip" aria-label="Moments near this year">
          <div><MapPin size={13} /><strong>Moments near this year</strong></div>
          {nearbyEvents.map((event) => <button type="button" key={event.id} onClick={() => onEventSelect(event)}><span>{formatYear(event.year)}</span>{event.title}</button>)}
        </section>
      )}

      <div className="search-field">
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search all civilizations" aria-label="Search civilization names and aliases" />
        {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search" title="Clear search"><X size={15} /></button>}
      </div>

      <div className="mobile-filter-row">
        <button type="button" aria-expanded={filtersOpen} aria-controls="civilization-filters" onClick={() => setFiltersOpen((current) => !current)}>
          <SlidersHorizontal size={13} /> Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
        {(activeFilterCount > 0 || normalizedQuery) && <button type="button" onClick={resetDiscovery}>Reset</button>}
      </div>

      <div id="civilization-filters" className={`discovery-filters ${filtersOpen ? 'mobile-open' : ''}`} aria-label="Civilization filters">
        <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} aria-label="Entity type"><option value="all">All types</option><option value="profiled">Curated profiles</option><option value="political">Political states</option><option value="cultural">Cultures and peoples</option></select>
        <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} aria-label="Current map region"><option value="all">All regions</option><option value="africa">Africa</option><option value="americas">Americas</option><option value="asia">Asia</option><option value="europe">Europe</option><option value="oceania">Oceania</option></select>
        <select value={eraFilter} onChange={(event) => setEraFilter(event.target.value as keyof typeof eras)} aria-label="All-history search era"><option value="all">All eras</option><option value="ancient">Through 500 CE</option><option value="medieval">500–1500</option><option value="early">1500–1800</option><option value="modern">After 1800</option></select>
      </div>

      <div className="entity-list" role="list" aria-busy={loading}>
        {shouldRenderResultRows && <>
          {!normalizedQuery && renderedVisibleMatches.some((entity) => getCivilizationProfile(entity.key)) && <div className="list-divider featured-divider"><Sparkles size={12} /> Major profiles in this view</div>}
          {renderedVisibleMatches.map((entity) => (
            <button type="button" className={entity.key === selectedKey ? 'active' : ''} key={entity.key} onClick={() => onSelect(entity)}>
              <span className="entity-marker" style={{ '--entity-color': entityColor(entity.key) } as React.CSSProperties}>
                <span className="color-swatch" />
                {getCivilizationMedia(entity.key)?.symbol && <img src={commonsImageUrl(getCivilizationMedia(entity.key)!.symbol!, 96)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}
              </span>
              <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small><LocateFixed size={9} /> Visible now</small></span>
              <span className={`precision precision-${entity.precision}`} title={confidence[entity.precision]} aria-label={confidence[entity.precision]} />
            </button>
          ))}
          {renderedHistoricalMatches.length > 0 && <div className="list-divider"><CalendarSearch size={12} /> {normalizedQuery ? 'Elsewhere in the timeline' : 'Elsewhere in the selected era'}</div>}
          {renderedHistoricalMatches.map((entity) => (
            <button type="button" key={entity.key} onClick={() => onHistoricalSelect(entity)}>
              <span className="entity-marker" style={{ '--entity-color': entityColor(entity.key) } as React.CSSProperties}>
                <span className="color-swatch" />
                {getCivilizationMedia(entity.key)?.symbol && <img src={commonsImageUrl(getCivilizationMedia(entity.key)!.symbol!, 96)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}
              </span>
              <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small>{formatYear(entity.firstYear)}–{formatYear(entity.lastYear)} · jump to map</small></span>
              <CalendarSearch size={12} className="timeline-result-icon" />
            </button>
          ))}
          {remainingResultCount > 0 && (
            <button
              type="button"
              className="show-more-results"
              onClick={() => setResultLimit((current) => current + resultPageSize)}
              aria-label={`Show ${nextResultCount.toLocaleString()} more civilization results`}
            >
              <span>Show more</span><small>{remainingResultCount.toLocaleString()} remaining</small>
            </button>
          )}
          {loading && totalResultCount === 0 && !normalizedQuery && activeFilterCount === 0
            ? <div className="empty-state loading-state" role="status"><LoaderCircle size={16} className="spin" /><p>Preparing entities for this map…</p></div>
            : totalResultCount === 0 && <div className="empty-state"><p>{normalizedQuery ? `No civilization matches “${query}”.` : 'No civilizations match these filters.'}</p><button type="button" onClick={resetDiscovery}>Reset search and filters</button></div>}
        </>}
      </div>
    </aside>
  )
}
