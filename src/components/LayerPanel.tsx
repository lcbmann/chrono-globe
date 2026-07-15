import { Layers3, X } from 'lucide-react'
import type { LayerVisibility } from '../types'

interface LayerPanelProps {
  open: boolean
  layers: LayerVisibility
  onChange: (layers: LayerVisibility) => void
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

export function LayerPanel({ open, layers, onChange, onClose }: LayerPanelProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="tool-modal layer-modal" role="dialog" aria-modal="true" aria-labelledby="layers-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close layers"><X size={19} /></button>
        <div className="eyebrow"><Layers3 size={12} /> Map layers</div>
        <h2 id="layers-title">Choose what the globe reveals</h2>
        <p>Routes are schematic teaching aids. They show connections, not a precise surveyed path or a complete network.</p>
        <div className="layer-options">
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
