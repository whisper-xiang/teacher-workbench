import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="page route-error" aria-label="页面加载失败">
        <h1>这一页没打开</h1>
        <p>开发服务可能刚重启。刷新后再试。</p>
        <button type="button" className="primary-action" onClick={() => window.location.reload()}>
          刷新
        </button>
      </section>
    )
  }
}
