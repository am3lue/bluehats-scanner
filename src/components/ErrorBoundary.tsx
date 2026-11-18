import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('BlueHats UI crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <div className="crash__card">
          <span className="crash__code">500</span>
          <h1>The workbench hit a snag.</h1>
          <p>The interface crashed while rendering. A reload usually clears it; your local history is untouched.</p>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn btn--ghost" href="/">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
