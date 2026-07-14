import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { findNearestSnapshotIndex, formatYear, parseYear } from '../lib/time'
import type { Snapshot } from '../types'

interface TimelineProps {
  snapshots: Snapshot[]
  selectedIndex: number
  playing: boolean
  onSelectedIndexChange: (index: number) => void
  onPlayingChange: (playing: boolean) => void
}

export function Timeline({
  snapshots,
  selectedIndex,
  playing,
  onSelectedIndexChange,
  onPlayingChange,
}: TimelineProps) {
  const selected = snapshots[selectedIndex]
  const [yearInput, setYearInput] = useState(selected ? formatYear(selected.year) : '')
  const [inputError, setInputError] = useState(false)

  useEffect(() => {
    if (selected) setYearInput(formatYear(selected.year))
  }, [selected])

  const commitYear = () => {
    const parsed = parseYear(yearInput)
    if (parsed === null) {
      setInputError(true)
      return
    }
    setInputError(false)
    onSelectedIndexChange(findNearestSnapshotIndex(snapshots, parsed))
  }

  const submitYear = (event: FormEvent) => {
    event.preventDefault()
    commitYear()
  }

  if (!selected) return null

  return (
    <section className="timeline" aria-label="Historical timeline">
      <div className="timeline-primary">
        <button
          type="button"
          className="icon-button play-button"
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          title={playing ? 'Pause timeline' : 'Play timeline'}
          onClick={() => onPlayingChange(!playing)}
        >
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={selectedIndex === 0}
          aria-label="Previous reconstruction"
          title="Previous reconstruction"
          onClick={() => onSelectedIndexChange(selectedIndex - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="range-wrap">
          <input
            aria-label="Timeline reconstruction"
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={selectedIndex}
            onChange={(event) => onSelectedIndexChange(Number(event.target.value))}
            style={{ '--timeline-progress': `${(selectedIndex / (snapshots.length - 1)) * 100}%` } as React.CSSProperties}
          />
          <div className="range-labels" aria-hidden="true">
            <span>{formatYear(snapshots[0].year)}</span>
            <span>{formatYear(snapshots.at(-1)?.year || 2010)}</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          disabled={selectedIndex === snapshots.length - 1}
          aria-label="Next reconstruction"
          title="Next reconstruction"
          onClick={() => onSelectedIndexChange(selectedIndex + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <form className={`year-entry ${inputError ? 'invalid' : ''}`} onSubmit={submitYear}>
        <label htmlFor="year-input">Jump to year</label>
        <input
          id="year-input"
          value={yearInput}
          aria-invalid={inputError}
          onChange={(event) => setYearInput(event.target.value)}
          onBlur={commitYear}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commitYear()
          }}
          title="Enter a year such as 323 BCE or 1492 CE"
        />
      </form>
    </section>
  )
}
