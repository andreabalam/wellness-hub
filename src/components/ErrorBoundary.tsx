import { Component, type ReactNode, type ErrorInfo } from 'react'
import { reportError, GENERIC_ERROR_MESSAGE } from '../lib/errorLog'
import { safeClear } from '../lib/storage'

interface Props {
  children: ReactNode
  /** Tab name shown in the error message, e.g. "Tracker" */
  name?: string
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(`ErrorBoundary:${this.props.name ?? 'unknown'}`, error)
    // componentStack is useful context but not worth a second log row.
    if (import.meta.env.DEV) console.warn(info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  private resetStorage = () => {
    safeClear()
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="error-boundary">
        <div className="error-boundary__icon">⚠️</div>
        <div className="error-boundary__title">
          Something went wrong{this.props.name ? ` in ${this.props.name}` : ''}
        </div>
        <div className="error-boundary__msg">
          {import.meta.env.DEV ? this.state.error.message : GENERIC_ERROR_MESSAGE}
        </div>
        <div className="error-boundary__actions">
          <button onClick={this.reset} className="btn btn--primary btn--md">
            Try again
          </button>
          <button onClick={this.resetStorage} className="btn btn--ghost btn--md">
            Reset all data
          </button>
        </div>
      </div>
    )
  }
}
