import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Optional fallback UI to show on error (default: renders nothing). */
  fallback?: ReactNode
  /** Optional error handler for logging. */
  onError?: (error: Error, info: ErrorInfo) => void
}

type State = {
  hasError: boolean
}

/**
 * Inline Error Boundary for decorative / auxiliary UI components.
 *
 * Unlike AppErrorBoundary (which shows a full-page reload prompt), this
 * boundary silently hides the failing component — the main message flow
 * and user input area are unaffected. This is the right behavior for
 * AgentRoleBadge, AgentRoleSelector, AgentStatusPanel, and RoutingBanner.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <AgentRoleBadge roleId="coder" />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[ErrorBoundary] caught render error:', error.message, info.componentStack)
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}
