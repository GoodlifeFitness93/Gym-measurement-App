import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  /** Shown to the trainer when the wrapped area fails to render. */
  title?: string;
  onRetry?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a render crash to one area of the screen.
 *
 * React unmounts the entire tree when a render throws, which is why a single
 * bad field in the AI report turned the whole app black. Wrapping the report
 * means the Client Profile behind it stays usable.
 *
 * This is a safety net, not a fix — the underlying error is still logged.
 */
export class ErrorBoundary extends Component<Props, State> {
  // This project has no `@types/react` installed, so the Component base type
  // resolves to `any` and TS cannot see `props` / `setState`. Declaring just
  // the two members used here keeps the file type-checked without adding the
  // types package, which would surface unrelated errors across the app.
  declare readonly props: Props;
  declare setState: (state: State) => void;

  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error contained by ErrorBoundary:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-2.5 text-danger">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{this.props.title ?? 'Unable to display this section.'}</p>
            <p className="text-xs text-text-muted mt-1">
              Your measurements are safe and saved. Nothing has been lost.
            </p>
          </div>
        </div>

        {import.meta.env.DEV && (
          <pre className="text-[11px] text-text-muted bg-surface-alt rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {error.message}
          </pre>
        )}

        <button
          onClick={this.handleRetry}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }
}
