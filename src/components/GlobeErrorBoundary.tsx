import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

interface GlobeErrorBoundaryProps {
  children: ReactNode
  label?: string
}

interface GlobeErrorBoundaryState {
  failed: boolean
}

export class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, GlobeErrorBoundaryState> {
  state: GlobeErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): GlobeErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Chrono Globe 3D view failed', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="globe-error-fallback" role="alert">
        <TriangleAlert size={24} />
        <strong>{this.props.label || 'The 3D map'} is unavailable</strong>
        <span>The timeline and historical Explorer remain usable. Try the view again, or check that browser graphics acceleration is enabled.</span>
        <button type="button" onClick={() => this.setState({ failed: false })}><RotateCcw size={14} /> Try 3D view again</button>
      </div>
    )
  }
}
