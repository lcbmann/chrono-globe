import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, Pause, Play, Square } from 'lucide-react'
import { findNearestYearIndex, formatYear, parseYear, type PlaybackRate } from '../lib/time'

interface WatchedRange {
  name: string
  firstYear: number
  lastYear: number
}

const playbackRates: PlaybackRate[] = [.5, 1, 2]

interface TimelineProps {
  years: number[]
  sourceYears?: number[]
  featuredYears?: number[]
  selectedIndex: number
  playing: boolean
  playbackRate?: PlaybackRate
  waiting?: boolean
  watching?: WatchedRange | null
  onSelectedIndexChange: (index: number) => void
  onPlaybackRateChange?: (rate: PlaybackRate) => void
  onPlayingChange: (playing: boolean) => void
  onStopWatching?: () => void
}

export function Timeline({
  years,
  sourceYears = [],
  featuredYears = [],
  selectedIndex,
  playing,
  playbackRate = 1,
  waiting = false,
  watching = null,
  onSelectedIndexChange,
  onPlaybackRateChange,
  onPlayingChange,
  onStopWatching,
}: TimelineProps) {
  const selected = years[selectedIndex]
  const [yearInput, setYearInput] = useState(selected !== undefined ? formatYear(selected) : '')
  const [inputError, setInputError] = useState(false)
  const markerPosition = (year: number) => `${(findNearestYearIndex(years, year) / Math.max(1, years.length - 1)) * 100}%`
  const sourceMarkers = useMemo(() => [...new Set(sourceYears)], [sourceYears])
  const featuredMarkers = useMemo(() => [...new Set(featuredYears)], [featuredYears])

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

  const watchedProgress = watching
    ? Math.max(0, Math.min(1, (selected - watching.firstYear) / Math.max(1, watching.lastYear - watching.firstYear)))
    : 0
  const watchingComplete = Boolean(watching && selected >= watching.lastYear)
  const playLabel = watching
    ? `${playing ? 'Pause' : watchingComplete ? 'Replay' : 'Resume'} ${watching.name} mapped history`
    : `${playing ? 'Pause' : 'Start'} fixed-view timelapse`
  const nextPlaybackRate = playbackRates[(playbackRates.indexOf(playbackRate) + 1) % playbackRates.length]
  const speedLabel = `Timelapse speed ${playbackRate}×. Change to ${nextPlaybackRate}×`

  return (
    <section className={`timeline ${watching ? 'watching-entity' : ''}`} aria-label="Historical timeline">
      {watching && (
        <div className="entity-playback-strip" aria-label={`${watching.name} mapped history progress`}>
          <div className="entity-playback-copy">
            <span>Mapped history</span>
            <strong>{watching.name}</strong>
            <small role="status" aria-live="polite">{waiting ? <><LoaderCircle size={11} className="spin" /> Loading the next complete frame</> : playing ? `Playing sourced territory dates · ${playbackRate}×` : selected >= watching.lastYear ? 'History complete' : 'Paused'}</small>
          </div>
          <div className="entity-playback-progress">
            <div
              className="entity-playback-track"
              role="progressbar"
              aria-label={`${watching.name} history progress`}
              aria-valuemin={watching.firstYear}
              aria-valuemax={watching.lastYear}
              aria-valuenow={Math.max(watching.firstYear, Math.min(watching.lastYear, selected))}
              aria-valuetext={formatYear(selected)}
            ><i style={{ width: `${watchedProgress * 100}%` }} /><b style={{ left: `${watchedProgress * 100}%` }} /></div>
            <div><span>{formatYear(watching.firstYear)}</span><em>{formatYear(selected)}</em><span>{formatYear(watching.lastYear)}</span></div>
          </div>
          <div className="entity-playback-actions">
            <button type="button" onClick={() => onPlayingChange(!playing)} aria-label={playLabel} aria-pressed={playing} title={playLabel}>
              {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />} {playing ? 'Pause' : watchingComplete ? 'Replay' : 'Resume'}
            </button>
            <button type="button" onClick={onStopWatching} aria-label={`Stop watching ${watching.name}`}><Square size={12} fill="currentColor" /> Stop</button>
          </div>
        </div>
      )}
      <div className="timeline-primary">
        {!watching && (
          <button
            type="button"
            className="icon-button play-button"
            aria-label={playLabel}
            aria-pressed={playing}
            title={playLabel}
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
        )}
        <button
          type="button"
          className="playback-speed"
          aria-label={speedLabel}
          title={`${speedLabel}. The camera stays where you leave it.`}
          onClick={() => onPlaybackRateChange?.(nextPlaybackRate)}
        >{playbackRate}×</button>
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
          <div className="timeline-markers" aria-hidden="true">
            {sourceMarkers.map((year) => <i className="source-marker" key={year} style={{ left: markerPosition(year) }} />)}
            {featuredMarkers.map((year) => <i className="featured-marker" key={year} style={{ left: markerPosition(year) }} />)}
          </div>
          <span id="timeline-evidence-key" className="sr-only">Gold ticks show {sourceMarkers.length} sourced territory dates. Blue dots show {featuredMarkers.length} event dates for {featuredYears.length} featured historical moments.</span>
          <input
            aria-label="Historical year"
            aria-describedby="timeline-evidence-key"
            type="range"
            min={0}
            max={years.length - 1}
            value={selectedIndex}
            aria-valuetext={formatYear(selected)}
            onChange={(event) => onSelectedIndexChange(Number(event.target.value))}
            style={{ '--timeline-progress': `${(selectedIndex / Math.max(1, years.length - 1)) * 100}%` } as React.CSSProperties}
          />
          <div className="range-labels" aria-hidden="true">
            <span>{formatYear(years[0])}</span>
            <span>{playing && !watching ? `Timelapse · view held · ${playbackRate}×` : `${sourceYears.length} source dates · ${featuredYears.length} moments`}</span>
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
          aria-describedby={inputError ? 'year-input-error' : undefined}
          onChange={(event) => { setYearInput(event.target.value); setInputError(false) }}
          onBlur={commitYear}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commitYear()
          }}
          title="Enter a year such as 323 BCE or 1492 CE"
        />
        {inputError && <small id="year-input-error" className="field-error" role="alert">Try a year such as 323 BCE or 1492 CE.</small>}
      </form>
    </section>
  )
}
