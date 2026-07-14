import { Search, X } from 'lucide-react'
import { entityColor } from '../lib/entities'
import type { EntitySummary } from '../types'

interface TerritoryPanelProps {
  entities: EntitySummary[]
  selectedKey: string | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (entity: EntitySummary) => void
  onClear: () => void
}

const confidence = ['Unknown', 'Approximate extent', 'Moderate confidence', 'Documented boundary']

export function TerritoryPanel({
  entities,
  selectedKey,
  query,
  onQueryChange,
  onSelect,
  onClear,
}: TerritoryPanelProps) {
  const selected = entities.find((entity) => entity.key === selectedKey)
  const filtered = entities.filter((entity) =>
    `${entity.name} ${entity.subject} ${entity.partOf || ''} ${entity.control || ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <aside className="territory-panel" aria-label="Visible territories">
      {selected ? (
        <article className="entity-detail">
          <button type="button" className="close-detail" onClick={onClear} aria-label="Close territory details" title="Close details">
            <X size={18} />
          </button>
          <div className="eyebrow">Selected territory</div>
          <div className="detail-heading">
            <span className="color-swatch large" style={{ background: entityColor(selected.key) }} />
            <h2>{selected.name}</h2>
          </div>
          {selected.subject !== selected.name && (
            <div className="detail-row"><span>Political entity</span><strong>{selected.subject}</strong></div>
          )}
          {selected.partOf && selected.partOf !== selected.subject && (
            <div className="detail-row"><span>Part of</span><strong>{selected.partOf}</strong></div>
          )}
          {selected.control && (
            <div className="detail-row"><span>Controlled by</span><strong>{selected.control}</strong></div>
          )}
          <div className="detail-row"><span>Boundary</span><strong>{confidence[selected.precision]}</strong></div>
          {selected.features.length > 1 && (
            <p className="detail-note">Shown as {selected.features.length} geographic regions in this reconstruction.</p>
          )}
        </article>
      ) : (
        <div className="panel-intro">
          <div className="eyebrow">In this reconstruction</div>
          <h2>{entities.length.toLocaleString()} named territories</h2>
          <p>Select a region on the globe or browse the index.</p>
        </div>
      )}

      <div className="search-field">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Find a territory"
          aria-label="Find a visible territory"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search" title="Clear search">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="entity-list" role="list">
        {filtered.map((entity) => (
          <button
            type="button"
            className={entity.key === selectedKey ? 'active' : ''}
            key={entity.key}
            onClick={() => onSelect(entity)}
          >
            <span className="color-swatch" style={{ background: entityColor(entity.key) }} />
            <span className="entity-copy">
              <strong>{entity.name}</strong>
              {entity.subject !== entity.name && <small>{entity.subject}</small>}
            </span>
            <span className={`precision precision-${entity.precision}`} title={confidence[entity.precision]} aria-label={confidence[entity.precision]} />
          </button>
        ))}
        {filtered.length === 0 && <p className="empty-state">No territory matches “{query}”.</p>}
      </div>
    </aside>
  )
}
