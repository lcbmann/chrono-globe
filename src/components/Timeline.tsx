import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { findNearestYearIndex, formatYear, parseYear } from '../lib/time'

interface TimelineProps {
  years: number[]
  selectedIndex: number
  playing: boolean
  onSelectedIndexChange: (index: number) => void
  onPlayingChange: (playing: boolean) => void
}

export function Timeline({
  years,
  selectedIndex,
  playing,
  onSelectedIndexChange,
  onPlayingChange,
}: TimelineProps) {
  const selected = years[selectedIndex]
  const [yearInput, setYearInput] = useState(selected !== undefined ? formatYear(selected) : '')
  const [inputError, setInputError] = useState(false)

  useEffect(() => {
    if (selected !== undefined) setYearInput(formatYear(selected))
  }, [selected])

  const commitYear = () => {
    const parsed = parseYear(yearInput)
    if (parsed === null) {
      setInputError(true)
      return
    }
    setInputError(false)
    onSelectedIndexChange(findNearestYearIndex(years, parsed))
  }

  const submitYear = (event: FormEvent) => {
    event.preventDefault()
    commitYear()
  }

  if (selected === undefined) return null

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
          aria-label="Previous timeline step"
          title="Previous timeline step"
          onClick={() => onSelectedIndexChange(selectedIndex - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="range-wrap">
          <input
            aria-label="Historical year"
            type="range"
            min={0}
            max={years.length - 1}
            value={selectedIndex}
            onChange={(event) => onSelectedIndexChange(Number(event.target.value))}
            style={{ '--timeline-progress': `${(selectedIndex / Math.max(1, years.length - 1)) * 100}%` } as React.CSSProperties}
          />
          <div className="range-labels" aria-hidden="true">
            <span>{formatYear(years[0])}</span>
            <span>Travel through history</span>
            <span>{formatYear(years.at(-1) || 2010)}</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          disabled={selectedIndex === years.length - 1}
          aria-label="Next timeline step"
          title="Next timeline step"
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
