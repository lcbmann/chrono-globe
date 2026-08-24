import { ChevronLeft, ChevronRight, Compass, Play, X } from 'lucide-react'
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
}

export function StoryPanel({ libraryOpen, activeStory, stepIndex, onLibraryClose, onStorySelect, onStepChange, onExit }: StoryPanelProps) {
  const step = activeStory?.steps[stepIndex]
  const libraryDialogRef = useDialogFocus<HTMLElement>(libraryOpen, onLibraryClose)

  return (
    <>
      {libraryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={onLibraryClose}>
          <section ref={libraryDialogRef} className="tool-modal story-library" role="dialog" aria-modal="true" aria-labelledby="stories-title" aria-describedby="stories-description" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={onLibraryClose} aria-label="Close stories"><X size={19} /></button>
            <div className="eyebrow"><Compass size={12} /> Guided stories</div>
            <h2 id="stories-title" tabIndex={-1} data-dialog-focus>Follow history across the globe</h2>
            <p id="stories-description">Each story moves the timeline and camera through a short, sourced sequence. Map boundaries remain approximate.</p>
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
        <section className="story-player" role="region" aria-labelledby="story-player-title" style={{ '--story-color': activeStory.color } as React.CSSProperties}>
          <button type="button" className="story-exit" onClick={onExit} aria-label="Exit guided story"><X size={15} /></button>
          <div className="eyebrow">Guided story · {stepIndex + 1} of {activeStory.steps.length}</div>
          <strong id="story-player-title" className="story-title">{activeStory.title}</strong>
          <div className="story-progress" role="progressbar" aria-label={`${activeStory.title} story progress`} aria-valuemin={1} aria-valuemax={activeStory.steps.length} aria-valuenow={stepIndex + 1} aria-valuetext={`Step ${stepIndex + 1} of ${activeStory.steps.length}: ${step.title}`}><i style={{ width: `${((stepIndex + 1) / activeStory.steps.length) * 100}%` }} /></div>
          <div className="story-step-status" role="status" aria-live="polite" aria-atomic="true">
            <span className="story-year">{formatYear(step.year)}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
          <div className="story-controls">
            <button type="button" disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}><ChevronLeft size={16} /> Previous</button>
            {stepIndex === activeStory.steps.length - 1
              ? <button type="button" onClick={onExit}>Finish</button>
              : <button type="button" onClick={() => onStepChange(stepIndex + 1)}>Next <ChevronRight size={16} /></button>}
          </div>
        </section>
      )}
    </>
  )
}
