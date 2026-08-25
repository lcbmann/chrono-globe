import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Compass, LoaderCircle, Play, X } from 'lucide-react'
import { getCivilizationProfile } from '../data/civilizations'
import { historicalEvents } from '../data/events'
import { historicalPoints, historicalRoutes } from '../data/layers'
import { historicalStories } from '../data/stories'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { formatYear } from '../lib/time'
import type { HistoricalStory } from '../types'

interface StoryPanelProps {
  libraryOpen: boolean
  activeStory: HistoricalStory | undefined
  stepIndex: number
  onLibraryClose: () => void
  onStorySelect: (story: HistoricalStory) => void
  onStepChange: (index: number) => void
  onExit: () => void
  onBrowseStories: () => void
  loading?: boolean
  sourceYear?: number
}

const featuredStories = historicalStories.filter((story) => story.featured)
const moreStories = historicalStories.filter((story) => !story.featured)

function StoryCard({ story, onSelect }: { story: HistoricalStory; onSelect: (story: HistoricalStory) => void }) {
  return (
    <button type="button" onClick={() => onSelect(story)} style={{ '--story-color': story.color } as React.CSSProperties}>
      <span>{story.category}</span>
      <strong>{story.title}</strong>
      <small>{story.subtitle}</small>
      <div className="story-card-meta"><b>{story.period}</b><b>{story.steps.length} chapters</b><b><Clock3 size={10} /> {story.estimatedMinutes} min</b></div>
      <i><Play size={12} fill="currentColor" /> Start story</i>
    </button>
  )
}

export function StoryPanel({ libraryOpen, activeStory, stepIndex, onLibraryClose, onStorySelect, onStepChange, onExit, onBrowseStories, loading = false, sourceYear }: StoryPanelProps) {
  const step = activeStory?.steps[stepIndex]
  const libraryDialogRef = useDialogFocus<HTMLElement>(libraryOpen, onLibraryClose)
  const [collapsed, setCollapsed] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const event = step?.eventId ? historicalEvents.find((item) => item.id === step.eventId) : undefined
  const point = step?.pointId ? historicalPoints.find((item) => item.id === step.pointId) : undefined
  const route = step?.routeId ? historicalRoutes.find((item) => item.id === step.routeId) : undefined
  const profile = step?.entity ? getCivilizationProfile(step.entity) : undefined
  const source = event?.source || point?.source || route?.source || step?.source || profile?.source

  useEffect(() => {
    setCollapsed(false)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activeStory?.id, stepIndex])

  return (
    <>
      {libraryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={onLibraryClose}>
          <section ref={libraryDialogRef} className="tool-modal story-library" role="dialog" aria-modal="true" aria-labelledby="stories-title" aria-describedby="stories-description" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={onLibraryClose} aria-label="Close stories"><X size={19} /></button>
            <div className="eyebrow"><Compass size={12} /> Guided stories</div>
            <h2 id="stories-title" tabIndex={-1} data-dialog-focus>History with a beginning, turning points, and an aftermath</h2>
            <p id="stories-description">Choose from {historicalStories.length} sourced narratives and move through the map one chapter at a time. Each story explains what changed, why it mattered, and what the reconstruction can—or cannot—show.</p>
            {featuredStories.length > 0 && <><div className="story-library-heading"><strong>Featured stories</strong><span>Good places to begin</span></div><div className="story-grid featured">{featuredStories.map((story) => <StoryCard key={story.id} story={story} onSelect={onStorySelect} />)}</div></>}
            {moreStories.length > 0 && <><div className="story-library-heading"><strong>More stories</strong><span>{moreStories.reduce((total, story) => total + story.steps.length, 0)} chapters across the world</span></div><div className="story-grid">{moreStories.map((story) => <StoryCard key={story.id} story={story} onSelect={onStorySelect} />)}</div></>}
          </section>
        </div>
      )}

      {activeStory && step && (
        <section className={`story-player${collapsed ? ' is-collapsed' : ''}`} role="region" aria-labelledby="story-player-title" style={{ '--story-color': activeStory.color } as React.CSSProperties}>
          <button type="button" className="story-collapse" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Expand story' : 'Minimize story'} aria-expanded={!collapsed}>{collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
          <button type="button" className="story-exit" onClick={onExit} aria-label="Exit guided story"><X size={15} /></button>
          <div className="eyebrow">{step.section} · {stepIndex + 1} of {activeStory.steps.length}</div>
          <strong id="story-player-title" className="story-title">{activeStory.title}</strong>
          <div className="story-collapsed-summary"><span>{step.dateLabel || formatYear(step.year)}</span><strong>{step.title}</strong></div>
          <div className="story-progress" role="group" aria-label={`${activeStory.title} chapters`}>
            {activeStory.steps.map((item, index) => <button type="button" key={`${item.year}-${item.title}`} className={index === stepIndex ? 'current' : index < stepIndex ? 'complete' : ''} onClick={() => onStepChange(index)} aria-label={`Chapter ${index + 1}: ${item.title}`} aria-current={index === stepIndex ? 'step' : undefined}><i /></button>)}
          </div>
          <div ref={contentRef} className="story-content">
            {stepIndex === 0 && <p className="story-introduction">{activeStory.introduction}</p>}
            <div className="story-step-status" role="status" aria-live="polite" aria-atomic="true">
              <span className="story-year">{step.dateLabel || formatYear(step.year)}{loading && <em><LoaderCircle size={10} className="spin" /> Updating map</em>}</span>
              <h3>{step.title}</h3>
              <p className="story-description">{step.description}</p>
            </div>
            <div className="story-significance"><strong>Why it matters</strong><p>{step.significance}</p></div>
            {(step.mapNote || sourceYear !== undefined) && <p className="story-map-note">{step.mapNote || `The globe uses the ${formatYear(sourceYear as number)} source reconstruction for this chapter.`}</p>}
            {source && <a className="story-source" href={source.url} target="_blank" rel="noreferrer"><BookOpen size={12} /> Read the chapter source at {source.title}</a>}
            {stepIndex === activeStory.steps.length - 1 && <div className="story-conclusion"><strong>What changed</strong><p>{activeStory.conclusion}</p></div>}
          </div>
          <div className="story-controls">
            <button type="button" disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}><ChevronLeft size={16} /> Previous</button>
            {stepIndex === activeStory.steps.length - 1
              ? <button type="button" onClick={onBrowseStories}>Choose another <Compass size={14} /></button>
              : <button type="button" onClick={() => onStepChange(stepIndex + 1)}>Next <ChevronRight size={16} /></button>}
          </div>
        </section>
      )}
    </>
  )
}
