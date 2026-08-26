import { Database, Layers3, X } from 'lucide-react'
import { useDialogFocus } from '../hooks/useDialogFocus'
import type { TerritorySourceMode } from '../lib/territoryData'
import type { LayerVisibility } from '../types'

interface LayerPanelProps {
  open: boolean
  layers: LayerVisibility
  territorySourceMode: TerritorySourceMode
  detailedTerritoriesAvailable: boolean
  onChange: (layers: LayerVisibility) => void
  onTerritorySourceModeChange: (mode: TerritorySourceMode) => void
  onClose: () => void
}

const options: Array<{ key: keyof LayerVisibility; title: string; description: string }> = [
  { key: 'events', title: 'Historical moments', description: 'Dated political, cultural, scientific, and environmental events' },
  { key: 'capitals', title: 'Capitals', description: 'Time-aware centers of government and royal courts' },
  { key: 'cities', title: 'Major cities', description: 'Commercial, religious, and intellectual centers' },
  { key: 'sites', title: 'Archaeological sites', description: 'Monuments and landscapes visible during their active period' },
  { key: 'trade', title: 'Trade networks', description: 'Schematic Silk Road, maritime, and trans-Saharan connections' },
  { key: 'migrations', title: 'Migrations and dispersals', description: 'Broad multi-generational movements, not single journeys' },
  { key: 'expeditions', title: 'Recorded expeditions', description: 'Selected long-distance voyages with known routes' },
]

const territorySources: Array<{ value: TerritorySourceMode; title: string; description: string }> = [
  { value: 'composite', title: 'Combined atlas', description: 'Broad global coverage with independently sourced detailed polity outlines' },
  { value: 'cliopatria', title: 'Detailed polities', description: 'Only the higher-frequency Seshat Cliopatria reconstruction' },
  { value: 'historical-basemaps', title: 'Broad reconstruction', description: 'Only the original political and cultural world maps' },
]

export function LayerPanel({
  open, layers, territorySourceMode, detailedTerritoriesAvailable, onChange, onTerritorySourceModeChange, onClose,
}: LayerPanelProps) {
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose)
  const activeLayerCount = options.filter((option) => layers[option.key]).length
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="tool-modal layer-modal" role="dialog" aria-modal="true" aria-labelledby="layers-title" aria-describedby="layers-description layers-status" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close layers"><X size={19} /></button>
        <div className="eyebrow"><Layers3 size={12} /> Map layers</div>
        <h2 id="layers-title" tabIndex={-1} data-dialog-focus>Choose what the globe reveals</h2>
        <p id="layers-description">Choose a territorial reconstruction, then add contextual places and routes without crowding the main atlas.</p>
        <div id="layers-status" className="layer-status" role="status" aria-live="polite">{activeLayerCount} of {options.length} optional layers visible</div>
        <fieldset className="territory-source-options">
          <legend><Database size={12} /> Territory reconstruction</legend>
          {territorySources.map((source) => {
            const needsDetail = source.value !== 'historical-basemaps'
            return (
              <label key={source.value} className={territorySourceMode === source.value ? 'active' : ''}>
                <input
                  type="radio"
                  name="territory-source"
                  value={source.value}
                  checked={territorySourceMode === source.value}
                  disabled={needsDetail && !detailedTerritoriesAvailable}
                  onChange={() => onTerritorySourceModeChange(source.value)}
                />
                <span><strong>{source.title}</strong><small>{source.description}{needsDetail && !detailedTerritoriesAvailable ? ' · loading catalog' : ''}</small></span>
              </label>
            )
          })}
        </fieldset>
        <div className="layer-options" role="group" aria-label="Map layer visibility">
          {options.map((option) => (
            <label key={option.key}>
              <input type="checkbox" checked={layers[option.key]} onChange={() => onChange({ ...layers, [option.key]: !layers[option.key] })} />
              <span><strong>{option.title}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
