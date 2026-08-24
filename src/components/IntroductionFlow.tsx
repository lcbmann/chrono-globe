import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Globe2, Layers3, MapPin, Search, Sparkles, X } from 'lucide-react'
import { useDialogFocus } from '../hooks/useDialogFocus'

interface IntroductionFlowProps {
  open: boolean
  startWithInvitation?: boolean
  mappedMoments?: number
  onClose: () => void
  onOpenExplorer: () => void
  onOpenStories: () => void
}

const steps = [
  {
    eyebrow: 'Welcome to Chrono Globe',
    title: 'History, mapped—not guessed.',
    copy: 'Explore changing political and cultural landscapes using sourced historical reconstructions. Borders are broad teaching aids, not modern legal boundaries.',
    icon: Globe2,
    visual: 'globe',
  },
  {
    eyebrow: 'Move through time',
    title: 'Set the pace yourself.',
    copy: 'Drag the timeline for close control, use the arrows for a single step, or press play for a slower tour that waits for each complete map.',
    icon: Clock3,
    visual: 'timeline',
  },
  {
    eyebrow: 'Explore a place',
    title: 'Select first, then go deeper.',
    copy: 'Tap a territory or open Explore to search across history. Civilization profiles combine mapped chronology, context, free media, and sources where available.',
    icon: Search,
    visual: 'profile',
  },
  {
    eyebrow: 'Optional depth',
    title: 'Extra tools stay out of your way.',
    copy: 'Guided stories, teaching layers, comparisons, and mapped changes are there when you want them. On a phone, they live together under More.',
    icon: Layers3,
    visual: 'tools',
  },
] as const

export function IntroductionFlow({ open, startWithInvitation = false, mappedMoments, onClose, onOpenExplorer, onOpenStories }: IntroductionFlowProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [tourStarted, setTourStarted] = useState(!startWithInvitation)
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const step = steps[stepIndex]
  const StepIcon = step.icon

  useEffect(() => {
    if (!open) return
    setStepIndex(0)
    setTourStarted(!startWithInvitation)
  }, [open, startWithInvitation])

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, stepIndex, tourStarted])

  if (!open) return null

  return (
    <div className="intro-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className={`intro-modal ${!tourStarted ? 'intro-invitation' : ''}`} role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-description" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="intro-close" onClick={onClose} aria-label="Close introduction"><X size={18} /></button>
        <div className={`intro-visual intro-visual-${tourStarted ? step.visual : 'globe'}`} aria-hidden="true">
          {!tourStarted && <><div className="intro-orbit"><Globe2 size={76} /><i /><b /></div><span>A quick way into the atlas</span></>}
          {tourStarted && <>
          {step.visual === 'globe' && <><div className="intro-orbit"><Globe2 size={76} /><i /><b /></div><span>{mappedMoments || 'Many'} sourced map moments</span></>}
          {step.visual === 'timeline' && <><div className="intro-mini-year">323 BCE</div><div className="intro-mini-timeline"><i /><b /></div><div className="intro-mini-labels"><span>Past</span><span>Move at your pace</span><span>Present</span></div></>}
          {step.visual === 'profile' && <div className="intro-profile-card"><div><MapPin size={14} /><span>Selected territory</span></div><strong>Open its history</strong><p>Context · chronology · sources</p><i /></div>}
          {step.visual === 'tools' && <div className="intro-tool-grid"><span><Sparkles size={16} /> Stories</span><span><Layers3 size={16} /> Layers</span><span><BookOpen size={16} /> Sources</span><span><Check size={16} /> Compare</span></div>}
          </>}
        </div>
        <div className="intro-content">
          {tourStarted ? <>
          <div className="intro-step-count">{stepIndex + 1} of {steps.length}</div>
          <div className="intro-eyebrow"><StepIcon size={13} /> {step.eyebrow}</div>
          <h2 ref={headingRef} id="intro-title" tabIndex={-1} data-dialog-focus>{step.title}</h2>
          <p id="intro-description">{step.copy}</p>
          <div className="intro-dots" aria-hidden="true">
            {steps.map((item, index) => <span key={item.title} className={index === stepIndex ? 'active' : ''} />)}
          </div>
          {stepIndex === steps.length - 1 ? (
            <div className="intro-finish-actions">
              <button type="button" className="intro-secondary" onClick={onOpenStories}><Sparkles size={14} /> Choose a guided story</button>
              <button type="button" className="intro-primary" onClick={onOpenExplorer}>Start exploring <ArrowRight size={15} /></button>
            </div>
          ) : (
            <div className="intro-nav">
              <button type="button" className="intro-secondary" onClick={stepIndex === 0 ? onClose : () => setStepIndex((current) => current - 1)}>{stepIndex === 0 ? 'Skip' : <><ArrowLeft size={14} /> Back</>}</button>
              <button type="button" className="intro-primary" onClick={() => setStepIndex((current) => current + 1)}>Next <ArrowRight size={15} /></button>
            </div>
          )}
          </> : <>
            <div className="intro-eyebrow"><Sparkles size={13} /> Optional introduction</div>
            <h2 ref={headingRef} id="intro-title" tabIndex={-1} data-dialog-focus>New to Chrono Globe?</h2>
            <p id="intro-description">Take a short, four-step introduction to the timeline, globe, civilization profiles, and optional tools. Nothing will move until you choose to begin.</p>
            <div className="intro-invitation-note"><Clock3 size={14} /><span><strong>About 45 seconds</strong>No setup and you can skip at any time.</span></div>
            <div className="intro-nav">
              <button type="button" className="intro-secondary" onClick={onClose}>Not now</button>
              <button type="button" className="intro-primary" onClick={() => setTourStarted(true)}>Take the quick tour <ArrowRight size={15} /></button>
            </div>
          </>}
        </div>
      </section>
    </div>
  )
}
