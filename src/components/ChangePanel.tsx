import { ArrowRight, X } from 'lucide-react'
import { getCivilizationProfile } from '../data/civilizations'
import { changeColors, changeLabels } from '../lib/changes'
import { formatYear } from '../lib/time'
import type { ChangeSet, EntityChange } from '../types'

interface ChangePanelProps {
  changes: ChangeSet
  fromYear: number
  toYear: number
  loading?: boolean
  sameSourceFrame?: boolean
  onClose: () => void
  onEntitySelect: (item: EntityChange) => void
}

const contextualLabel = (item: EntityChange, fromYear: number, toYear: number) => {
  if (item.kind === 'appeared') return `Only on ${formatYear(toYear)} map`
  if (item.kind === 'disappeared') return `Only on ${formatYear(fromYear)} map`
  if (item.kind === 'expanded') return `Larger mapped extent in ${formatYear(toYear)}`
  if (item.kind === 'contracted') return `Smaller mapped extent in ${formatYear(toYear)}`
  if (item.kind === 'control') return 'Recorded control differs'
  return changeLabels[item.kind]
}

const countLabel = (kind: EntityChange['kind'], fromYear: number, toYear: number) => {
  if (kind === 'appeared') return `only on ${formatYear(toYear)} map`
  if (kind === 'disappeared') return `only on ${formatYear(fromYear)} map`
  if (kind === 'expanded') return `larger in ${formatYear(toYear)}`
  if (kind === 'contracted') return `smaller in ${formatYear(toYear)}`
  return 'different recorded control'
}

export function ChangePanel({ changes, fromYear, toYear, loading = false, sameSourceFrame = false, onClose, onEntitySelect }: ChangePanelProps) {
  const differences = changes.items.filter((item) => item.kind !== 'stable')
  const visible = differences.slice(0, 8)
  return (
    <section className="change-panel" aria-label="Differences between mapped reconstructions" aria-live="polite">
      <button type="button" className="story-exit" onClick={onClose} aria-label="Close change summary"><X size={15} /></button>
      <div className="eyebrow">Compare source maps</div>
      <h3>{formatYear(fromYear)} <ArrowRight size={14} /> {formatYear(toYear)}</h3>
      {loading ? (
        <p className="change-empty">Preparing both source reconstructions…</p>
      ) : sameSourceFrame ? (
        <p className="change-empty">Both selected years use the same source reconstruction. Choose a farther comparison year to inspect a mapped difference.</p>
      ) : (
        <>
          <div className="change-counts">
            {(['appeared', 'disappeared', 'expanded', 'contracted', 'control'] as const).map((kind) => (
              <span key={kind}><i style={{ background: changeColors[kind] }} />{changes.counts[kind]} {countLabel(kind, fromYear, toYear)}</span>
            ))}
          </div>
          <div className="change-list">
            {visible.map((item) => <button type="button" key={item.key} onClick={() => onEntitySelect(item)}><i style={{ background: changeColors[item.kind] }} /><strong>{getCivilizationProfile(item.key)?.displayName || item.key}</strong><span>{contextualLabel(item, fromYear, toYear)}</span></button>)}
            {visible.length === 0 && <p>No material mapped differences were detected.</p>}
          </div>
          {differences.length > visible.length && <small className="change-overflow">Showing the 8 largest of {differences.length} mapped differences.</small>}
          <p className="change-method-note">These are differences between reconstructions, not inferred causes or exact annual borders.</p>
        </>
      )}
    </section>
  )
}
