import { ChevronLeft, ChevronRight, Compass, Play, X } from 'lucide-react'
import { historicalStories } from '../data/stories'
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
}

export function StoryPanel({ libraryOpen, activeStory, stepIndex, onLibraryClose, onStorySelect, onStepChange, onExit }: StoryPanelProps) {
  const step = activeStory?.steps[stepIndex]

  return (
    <>
      {libraryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={onLibraryClose}>
          <section className="tool-modal story-library" role="dialog" aria-modal="true" aria-labelledby="stories-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={onLibraryClose} aria-label="Close stories"><X size={19} /></button>
            <div className="eyebrow"><Compass size={12} /> Guided stories</div>
            <h2 id="stories-title">Follow history across the globe</h2>
            <p>Each story moves the timeline and camera through a short, sourced sequence. Map boundaries remain approximate.</p>
            <div className="story-grid">
              {historicalStories.map((story) => (
                <button type="button" key={story.id} onClick={() => onStorySelect(story)} style={{ '--story-color': story.color } as React.CSSProperties}>
                  <span>{story.steps.length} stops</span>
                  <strong>{story.title}</strong>
                  <small>{story.subtitle}</small>
                  <i><Play size={12} fill="currentColor" /> Begin</i>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeStory && step && (
        <section className="story-player" aria-live="polite" style={{ '--story-color': activeStory.color } as React.CSSProperties}>
          <button type="button" className="story-exit" onClick={onExit} aria-label="Exit guided story"><X size={15} /></button>
          <div className="eyebrow">Guided story · {stepIndex + 1} of {activeStory.steps.length}</div>
          <strong className="story-title">{activeStory.title}</strong>
          <div className="story-progress" aria-hidden="true"><i style={{ width: `${((stepIndex + 1) / activeStory.steps.length) * 100}%` }} /></div>
          <span className="story-year">{formatYear(step.year)}</span>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          <div className="story-controls">
            <button type="button" disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}><ChevronLeft size={16} /> Previous</button>
            <button type="button" disabled={stepIndex === activeStory.steps.length - 1} onClick={() => onStepChange(stepIndex + 1)}>Next <ChevronRight size={16} /></button>
          </div>
        </section>
      )}
    </>
  )
}
