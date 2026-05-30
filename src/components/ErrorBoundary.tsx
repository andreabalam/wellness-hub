import { Component, type ReactNode, type ErrorInfo } from 'react'

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
    console.warn(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  private resetStorage = () => {
    localStorage.clear()
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--muted2)',
        maxWidth: 400,
        margin: '0 auto',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Something went wrong{this.props.name ? ` in ${this.props.name}` : ''}
        </div>
        <div style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: 'var(--muted2)', marginBottom: 20, wordBreak: 'break-word' }}>
          {this.state.error.message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={this.reset}
            style={{ background: 'var(--green)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            Try again
          </button>
          <button
            onClick={this.resetStorage}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            Reset all data
          </button>
        </div>
      </div>
    )
  }
}
