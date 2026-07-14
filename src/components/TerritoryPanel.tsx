import { BookOpen, CalendarSearch, LocateFixed, MapPin, Search, Sparkles, X } from 'lucide-react'
import { getCivilizationProfile } from '../data/civilizations'
import { entityColor } from '../lib/entities'
import { formatYear } from '../lib/time'
import type { EntitySummary, HistoricalEntityIndex, HistoricalEvent } from '../types'

interface TerritoryPanelProps {
  entities: EntitySummary[]
  history: HistoricalEntityIndex[]
  selectedKey: string | null
  selectedEvent: HistoricalEvent | null
  nearbyEvents: HistoricalEvent[]
  year: number | undefined
  query: string
  onQueryChange: (query: string) => void
  onSelect: (entity: EntitySummary) => void
  onHistoricalSelect: (entity: HistoricalEntityIndex) => void
  onEventSelect: (event: HistoricalEvent) => void
  onClear: () => void
}

const confidence = ['Unknown', 'Approximate extent', 'Moderate confidence', 'Documented boundary']

export function TerritoryPanel({
  entities, history, selectedKey, selectedEvent, nearbyEvents, year, query,
  onQueryChange, onSelect, onHistoricalSelect, onEventSelect, onClear,
}: TerritoryPanelProps) {
  const selected = entities.find((entity) => entity.key === selectedKey)
  const historical = history.find((entity) => entity.key === selectedKey)
  const profile = selectedKey ? getCivilizationProfile(selectedKey) : undefined
  const normalizedQuery = query.trim().toLowerCase()
  const visibleMatches = entities.filter((entity) =>
    `${entity.name} ${entity.subject} ${entity.partOf || ''} ${entity.control || ''} ${entity.features.map((feature) => feature.properties.NAME).join(' ')}`
      .toLowerCase().includes(normalizedQuery),
  )
  const visibleKeys = new Set(visibleMatches.map((entity) => entity.key))
  const historicalMatches = normalizedQuery
    ? history.filter((entity) => !visibleKeys.has(entity.key) && `${entity.name} ${entity.aliases.join(' ')}`.toLowerCase().includes(normalizedQuery)).slice(0, 80)
    : []
  const hasDetail = Boolean(selected || historical || selectedEvent)

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
                  <p className="profile-overview">{profile.overview}</p>
                  <h3><Sparkles size={13} /> Why it matters</h3>
                  <p className="profile-legacy">{profile.legacy}</p>
                  <ul className="fact-list">{profile.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                  <a className="source-link" href={profile.source.url} target="_blank" rel="noreferrer"><BookOpen size={13} /> Learn more at {profile.source.title}</a>
                </>
              ) : (
                <>
                  <p className="profile-overview">{selectedKey} appears in the source atlas from {historical ? `${formatYear(historical.firstYear)} to ${formatYear(historical.lastYear)}` : 'this reconstruction'}. This mapped shape is an approximate historical extent, not a modern surveyed border.</p>
                  {selected && selected.features.length > 1 && <p className="detail-note">The source represents this polity through {selected.features.length} named regions, including {selected.features.slice(0, 4).map((feature) => feature.properties.NAME).join(', ')}.</p>}
                  <p className="profile-legacy">A dedicated editorial profile has not yet been added. Use the source metadata below as a starting point and verify it with a specialist reference.</p>
                </>
              )}
              {selected && <div className="detail-row"><span>Boundary</span><strong>{confidence[selected.precision]}</strong></div>}
              {historical && <div className="detail-row"><span>Atlas span</span><strong>{formatYear(historical.firstYear)}–{formatYear(historical.lastYear)}</strong></div>}
            </>
          )}
        </article>
      ) : (
        <div className="panel-intro">
          <div className="eyebrow">In {year === undefined ? 'this reconstruction' : formatYear(year)}</div>
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

      <div className="entity-list" role="list">
        {visibleMatches.map((entity) => (
          <button type="button" className={entity.key === selectedKey ? 'active' : ''} key={entity.key} onClick={() => onSelect(entity)}>
            <span className="color-swatch" style={{ background: entityColor(entity.key) }} />
            <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small><LocateFixed size={9} /> Visible now</small></span>
            <span className={`precision precision-${entity.precision}`} title={confidence[entity.precision]} aria-label={confidence[entity.precision]} />
          </button>
        ))}
        {historicalMatches.length > 0 && <div className="list-divider"><CalendarSearch size={12} /> Elsewhere in the timeline</div>}
        {historicalMatches.map((entity) => (
          <button type="button" key={entity.key} onClick={() => onHistoricalSelect(entity)}>
            <span className="color-swatch" style={{ background: entityColor(entity.key) }} />
            <span className="entity-copy"><strong>{getCivilizationProfile(entity.key)?.displayName || entity.name}</strong><small>{formatYear(entity.firstYear)}–{formatYear(entity.lastYear)} · jump to map</small></span>
            <CalendarSearch size={12} className="timeline-result-icon" />
          </button>
        ))}
        {visibleMatches.length === 0 && historicalMatches.length === 0 && <p className="empty-state">No civilization matches “{query}”.</p>}
      </div>
    </aside>
  )
}
