import type { AtlasUrlState } from './urlState'

export const introductionVersion = 'chrono-globe:introduction:v1'

export const hasExplorationDeepLink = (state: AtlasUrlState) => Boolean(
  state.year !== undefined
  || state.entity
  || state.event
  || state.point
  || state.route
  || state.story
  || state.compareYear !== undefined
  || state.side
  || state.view
  || state.mode
  || state.layers,
)

export const shouldOfferIntroduction = (savedValue: string | null, state: AtlasUrlState) =>
  savedValue !== introductionVersion && !hasExplorationDeepLink(state)
