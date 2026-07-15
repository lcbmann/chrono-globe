import { ArrowRight, X } from 'lucide-react'
import { changeColors, changeLabels } from '../lib/changes'
import { formatYear } from '../lib/time'
import type { ChangeSet } from '../types'

interface ChangePanelProps {
  changes: ChangeSet
  fromYear: number
  toYear: number
  onClose: () => void
  onEntitySelect: (key: string) => void
}

export function ChangePanel({ changes, fromYear, toYear, onClose, onEntitySelect }: ChangePanelProps) {
  const visible = changes.items.filter((item) => item.kind !== 'stable').slice(0, 8)
  return (
    <section className="change-panel" aria-label="Mapped changes">
      <button type="button" className="story-exit" onClick={onClose} aria-label="Close change summary"><X size={15} /></button>
      <div className="eyebrow">What changed?</div>
      <h3>{formatYear(fromYear)} <ArrowRight size={14} /> {formatYear(toYear)}</h3>
      <div className="change-counts">
        {(['appeared', 'disappeared', 'expanded', 'contracted', 'control'] as const).map((kind) => (
          <span key={kind}><i style={{ background: changeColors[kind] }} />{changes.counts[kind]} {changeLabels[kind].toLowerCase()}</span>
        ))}
      </div>
      <div className="change-list">
        {visible.map((item) => <button type="button" key={item.key} onClick={() => onEntitySelect(item.key)}><i style={{ background: changeColors[item.kind] }} /><strong>{item.key}</strong><span>{changeLabels[item.kind]}</span></button>)}
        {visible.length === 0 && <p>No material mapped changes were detected.</p>}
      </div>
    </section>
  )
}
