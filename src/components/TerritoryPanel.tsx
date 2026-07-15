import { useState } from 'react'
import { geoCentroid } from 'd3-geo'
import { BookOpen, CalendarSearch, LocateFixed, MapPin, Play, Route, Search, Sparkles, X } from 'lucide-react'
import { getCivilizationProfile } from '../data/civilizations'
import { commonsImageUrl, getCivilizationMedia } from '../data/civilizationMedia'
import { entityColor } from '../lib/entities'
import { formatYear } from '../lib/time'
import type { EntitySummary, HistoricalEntityIndex, HistoricalEvent, HistoricalPoint, HistoricalRoute } from '../types'
import { CivilizationMedia } from './CivilizationMedia'

interface TerritoryPanelProps {
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
  watchingEntity: string | null
  sourceYear?: number
  datasetSource?: string
  sourceCommit?: string | null
  license?: string
  onClear: () => void
}

const confidence = ['Unknown', 'Approximate extent', 'Moderate confidence', 'Documented boundary']
const culturalPattern = /culture|peoples?|tribes?|hunter|gatherer|pastoral|farmer|pottery|burial|tradition|speakers?|nomads?/i
const eras = {
  all: [-123000, 2010], ancient: [-123000, 500], medieval: [500, 1500], early: [1500, 1800], modern: [1800, 2010],
} as const

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
  entities, history, selectedKey, selectedEvent, selectedPoint, selectedRoute, nearbyEvents, year, query,
  onQueryChange, onSelect, onHistoricalSelect, onEventSelect, onHistoryYearSelect, onWatchEntity, watchingEntity,
  sourceYear, datasetSource, sourceCommit, license, onClear,
}: TerritoryPanelProps) {
  const [entityFilter, setEntityFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [eraFilter, setEraFilter] = useState<keyof typeof eras>('all')
  const selected = entities.find((entity) => entity.key === selectedKey)
  const historical = history.find((entity) => entity.key === selectedKey)
  const profile = selectedKey ? getCivilizationProfile(selectedKey) : undefined
  const media = selectedKey ? getCivilizationMedia(selectedKey) : undefined
  const normalizedQuery = query.trim().toLowerCase()
  const visibleMatches = entities.filter((entity) => {
    const matchedProfile = getCivilizationProfile(entity.key)
    const matchesType = entityFilter === 'all' || (entityFilter === 'profiled' ? Boolean(matchedProfile) : entityFilter === 'cultural' ? culturalPattern.test(entity.key) : !culturalPattern.test(entity.key))
    const matchesRegion = regionFilter === 'all' || regionForEntity(entity) === regionFilter
    return matchesType && matchesRegion && `${entity.name} ${entity.subject} ${entity.partOf || ''} ${entity.control || ''} ${matchedProfile?.displayName || ''} ${matchedProfile?.names.join(' ') || ''} ${entity.features.map((feature) => feature.properties.NAME).join(' ')}`
      .toLowerCase().includes(normalizedQuery)
  }).sort((left, right) => normalizedQuery ? left.name.localeCompare(right.name) : (getCivilizationProfile(right.key)?.importance || 0) - (getCivilizationProfile(left.key)?.importance || 0) || left.name.localeCompare(right.name))
  const visibleKeys = new Set(visibleMatches.map((entity) => entity.key))
  const historicalMatches = normalizedQuery
    ? history.filter((entity) => {
      const matchedProfile = getCivilizationProfile(entity.key)
      const [eraStart, eraEnd] = eras[eraFilter]
      const matchesEra = entity.lastYear >= eraStart && entity.firstYear <= eraEnd
      const matchesType = entityFilter === 'all' || (entityFilter === 'profiled' ? Boolean(matchedProfile) : entityFilter === 'cultural' ? culturalPattern.test(entity.key) : !culturalPattern.test(entity.key))
      return !visibleKeys.has(entity.key) && matchesEra && matchesType && `${entity.name} ${entity.aliases.join(' ')} ${matchedProfile?.displayName || ''} ${matchedProfile?.names.join(' ') || ''}`.toLowerCase().includes(normalizedQuery)
    }).slice(0, 80)
    : []
  const hasDetail = Boolean(selected || historical || selectedEvent || selectedPoint || selectedRoute)

  return (
    <aside className="territory-panel" aria-label="Historical explorer">
      {hasDetail ? (
        <article className="entity-detail">
          <button type="button" className="close-detail" onClick={onClear} aria-label="Close details" title="Close details"><X size={18} /></button>
          {selectedEvent ? (
            <>
              <div className="eyebrow"><MapPin size={11} /> Historical moment · {formatYear(selectedEvent.year)}</div>
              <h2>{selectedEvent.title}</h2>
              <p className="profile-overview">{selectedEvent.description}</p>
              <a className="source-link" href={selectedEvent.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Read at {selectedEvent.source.title}</a>
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
                  <button type="button" className="watch-history" onClick={() => onWatchEntity(historical)}><Play size={13} fill="currentColor" /> {watchingEntity === historical.key ? 'Watching history' : 'Watch its mapped history'}</button>
                  <p>Chrono Globe does not infer predecessor or successor states where the source data does not explicitly establish that relationship.</p>
                </section>
              )}
              {datasetSource && <div className="map-source"><span>Map reconstruction</span><strong>{sourceYear === undefined ? 'Historical Basemaps' : formatYear(sourceYear)}</strong><a href={datasetSource} target="_blank" rel="noreferrer">Source dataset</a>{sourceCommit && <small>Revision {sourceCommit.slice(0, 8)}</small>}{license && <small>{license}</small>}</div>}
            </>
          )}
        </article>
      ) : (
        <div className="panel-intro">
          <div className="eyebrow">In {year === undefined ? 'this moment in history' : formatYear(year)}</div>
          <h2>{entities.length.toLocaleString()} political and cultural entities</h2>
          <p>Select a region, search across all of history, or open a nearby event.</p>
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
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search all civilizations" aria-label="Search all civilizations and years" />
        {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search" title="Clear search"><X size={15} /></button>}
      </div>

      <div className="discovery-filters" aria-label="Civilization filters">
        <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} aria-label="Entity type"><option value="all">All types</option><option value="profiled">Curated profiles</option><option value="political">Political states</option><option value="cultural">Cultures and peoples</option></select>
        <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} aria-label="World region"><option value="all">All regions</option><option value="africa">Africa</option><option value="americas">Americas</option><option value="asia">Asia</option><option value="europe">Europe</option><option value="oceania">Oceania</option></select>
        <select value={eraFilter} onChange={(event) => setEraFilter(event.target.value as keyof typeof eras)} aria-label="Historical era"><option value="all">All eras</option><option value="ancient">Through 500 CE</option><option value="medieval">500–1500</option><option value="early">1500–1800</option><option value="modern">After 1800</option></select>
      </div>

      <div className="entity-list" role="list">
        {!normalizedQuery && visibleMatches.some((entity) => getCivilizationProfile(entity.key)) && <div className="list-divider featured-divider"><Sparkles size={12} /> Major profiles in this view</div>}
        {visibleMatches.map((entity) => (
          <button type="button" className={entity.key === selectedKey ? 'active' : ''} key={entity.key} onClick={() => onSelect(entity)}>
            <span className="entity-marker" style={{ '--entity-color': entityColor(entity.key) } as React.CSSProperties}>
              <span className="color-swatch" />
              {getCivilizationMedia(entity.key)?.symbol && <img src={commonsImageUrl(getCivilizationMedia(entity.key)!.symbol!, 96)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}
            </span>
            <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small><LocateFixed size={9} /> Visible now</small></span>
            <span className={`precision precision-${entity.precision}`} title={confidence[entity.precision]} aria-label={confidence[entity.precision]} />
          </button>
        ))}
        {historicalMatches.length > 0 && <div className="list-divider"><CalendarSearch size={12} /> Elsewhere in the timeline</div>}
        {historicalMatches.map((entity) => (
          <button type="button" key={entity.key} onClick={() => onHistoricalSelect(entity)}>
            <span className="entity-marker" style={{ '--entity-color': entityColor(entity.key) } as React.CSSProperties}>
              <span className="color-swatch" />
              {getCivilizationMedia(entity.key)?.symbol && <img src={commonsImageUrl(getCivilizationMedia(entity.key)!.symbol!, 96)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}
            </span>
            <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small>{formatYear(entity.firstYear)}–{formatYear(entity.lastYear)} · jump to map</small></span>
            <CalendarSearch size={12} className="timeline-result-icon" />
          </button>
        ))}
        {visibleMatches.length === 0 && historicalMatches.length === 0 && <p className="empty-state">No civilization matches “{query}”.</p>}
      </div>
    </aside>
  )
}
