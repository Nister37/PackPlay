import { Component, type ErrorInfo, type ReactNode } from 'react';
import axios from 'axios';
import { AlertTriangle, RefreshCw, LogIn, LayoutDashboard, AlertCircle, RotateCcw } from 'lucide-react';
import { AppErrorCode } from '@packplay/common';
import { packingService } from '@/services/packing.service';
import { resetLiveTakeoverSession } from '@/lib/liveTakeoverSession';

export type ErrorCategory = 'AUTH' | 'SYNC' | 'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK' | 'GENERAL';

export interface ParsedErrorDetails {
  category: ErrorCategory;
  code?: AppErrorCode | string;
  statusCode?: number;
  message: string;
  details?: Record<string, unknown>;
}

export function parseErrorDetails(error: unknown): ParsedErrorDetails {
  let category: ErrorCategory = 'GENERAL';
  let code: AppErrorCode | string | undefined;
  let statusCode: number | undefined;
  let message = 'An unexpected error occurred.';
  let details: Record<string, unknown> | undefined;
  let isNetwork = false;

  if (axios.isAxiosError(error)) {
    statusCode = error.response?.status;
    const data = error.response?.data as any;
    code = data?.code;
    message = (typeof data === 'string' ? data : data?.message) || error.message || 'API request failed';
    details = data?.details;

    if (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || /network error/i.test(error.message)) {
      isNetwork = true;
      message = 'Network error: could not connect to server.';
    }
  } else if (error instanceof Error) {
    message = error.message;
    code = (error as any).code;
    statusCode = (error as any).statusCode ?? (error as any).status;
    details = (error as any).details;
    if (/network error|failed to fetch/i.test(error.message)) {
      isNetwork = true;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    code = errObj.code;
    statusCode = errObj.statusCode ?? errObj.status;
    message = errObj.message || 'An unexpected error occurred.';
    details = errObj.details;
  }

  // Determine error category based on unified code and status analysis
  const codeStr = String(code || '');
  const messageStr = String(message || '');

  if (
    isNetwork ||
    /network|offline|failed to fetch/i.test(messageStr)
  ) {
    category = 'NETWORK';
  } else if (
    statusCode === 401 ||
    code === AppErrorCode.UNAUTHORIZED ||
    code === AppErrorCode.SESSION_REVOKED ||
    code === AppErrorCode.TOKEN_EXPIRED ||
    code === AppErrorCode.INVALID_TOKEN ||
    code === AppErrorCode.INVALID_CREDENTIALS ||
    code === AppErrorCode.SSO_LINK_REQUIRED ||
    /unauthorized|token expired|session revoked/i.test(messageStr)
  ) {
    category = 'AUTH';
  } else if (
    statusCode === 409 ||
    code === AppErrorCode.CONCURRENT_MODIFICATION ||
    code === AppErrorCode.SHARED_ITEM_ALREADY_COVERED ||
    code === AppErrorCode.ALREADY_CLAIMED ||
    code === AppErrorCode.DECISION_ALREADY_MADE ||
    code === AppErrorCode.CANNOT_TAKE_OVER_COVERED ||
    /concurrent|conflict|sync error|out of sync/i.test(messageStr)
  ) {
    category = 'SYNC';
  } else if (
    statusCode === 404 ||
    code === AppErrorCode.NOT_FOUND ||
    codeStr.endsWith('_NOT_FOUND') ||
    /not found/i.test(messageStr)
  ) {
    category = 'NOT_FOUND';
  } else if (
    statusCode === 403 ||
    code === AppErrorCode.FORBIDDEN ||
    code === AppErrorCode.NOT_A_MEMBER ||
    code === AppErrorCode.INSUFFICIENT_ROLE ||
    code === AppErrorCode.NOT_PROFILE_OWNER ||
    code === AppErrorCode.NOT_CHECKLIST_OWNER ||
    code === AppErrorCode.CANNOT_REMOVE_OWNER ||
    code === AppErrorCode.CANNOT_LEAVE_AS_SOLE_OWNER ||
    /forbidden|access denied|permission/i.test(messageStr)
  ) {
    category = 'FORBIDDEN';
  }

  return { category, code, statusCode, message, details };
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Enhanced Error Boundary with deep Axios & AppErrorCode awareness.
 * Provides user-friendly recovery messaging and contextual action buttons:
 * - "Re-authenticate" on auth failure
 * - "Refresh Deck" on sync/concurrency errors
 * - "Back to Dashboard"
 * - "Retry"
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReauthenticate = () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      resetLiveTakeoverSession();
    } catch {}
    window.location.href = '/login';
  };

  handleRefreshDeck = () => {
    try {
      packingService.resetDeck();
    } catch {}

    this.handleReset();
    if (window.location.pathname.includes('/packing')) {
      window.location.reload();
    } else {
      window.location.href = '/packing';
    }
  };

  handleBackToDashboard = () => {
    this.handleReset();
    window.location.href = '/dashboard';
  };

  override render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const { fallback } = this.props;
    if (typeof fallback === 'function') {
      return fallback(this.state.error, this.handleReset);
    }
    if (fallback) {
      return fallback;
    }

    const parsed = parseErrorDetails(this.state.error);

    let title = this.props.fallbackTitle ?? 'Something Went Wrong';
    let description = parsed.message;
    let badgeLabel = 'APPLICATION ERROR';
    let badgeColor = 'bg-red-500/10 text-red-500 border-red-500/30';

    switch (parsed.category) {
      case 'AUTH':
        title = 'Authentication Required';
        description = 'Your session has expired or credentials are required to continue.';
        badgeLabel = 'AUTH ERROR';
        badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
        break;
      case 'SYNC':
        title = 'Deck Sync Conflict';
        description =
          'A data synchronization conflict occurred while updating items. Refresh your packing deck to sync the latest changes.';
        badgeLabel = 'SYNC CONFLICT';
        badgeColor = 'bg-primary/10 text-primary border-primary/30';
        break;
      case 'NOT_FOUND':
        title = 'Item or Resource Not Found';
        description = 'The requested squad resource, event, or item could not be located.';
        badgeLabel = 'NOT FOUND (404)';
        badgeColor = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
        break;
      case 'FORBIDDEN':
        title = 'Access Restricted';
        description = 'You do not have the required permissions to perform this action.';
        badgeLabel = 'FORBIDDEN (403)';
        badgeColor = 'bg-red-500/10 text-red-500 border-red-500/30';
        break;
      case 'NETWORK':
        title = 'Connection Lost';
        description = 'Unable to communicate with the server. Please check your internet connection.';
        badgeLabel = 'NETWORK OFFLINE';
        badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
        break;
    }

    return (
      <div className="min-h-[340px] flex items-center justify-center p-6 bg-brand-bg text-brand-text">
        <div className="max-w-lg w-full bg-white border border-brand-border shadow-md p-6 space-y-5">
          {/* Header & Status Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
                {parsed.category === 'SYNC' ? (
                  <RotateCcw className="w-5 h-5 text-primary" />
                ) : parsed.category === 'AUTH' ? (
                  <LogIn className="w-5 h-5 text-amber-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span
                  className={`inline-block font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border mb-1.5 ${badgeColor}`}
                >
                  {badgeLabel}
                </span>
                <h2 className="font-headline font-bold text-lg uppercase tracking-wider text-brand-text">
                  {title}
                </h2>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="font-body text-sm text-brand-muted leading-relaxed">
            {description}
          </p>

          {parsed.code && (
            <div className="bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-600 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Code: {parsed.code}</span>
            </div>
          )}

          {/* Contextual Action Buttons */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            {/* Retry Button - always available */}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-surface border border-brand-border text-brand-text font-headline font-bold text-xs uppercase tracking-wider hover:bg-zinc-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>

            {/* Re-authenticate Button - displayed on AUTH errors */}
            {parsed.category === 'AUTH' && (
              <button
                type="button"
                onClick={this.handleReauthenticate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-headline font-bold text-xs uppercase tracking-wider hover:bg-primary-hover shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Re-authenticate
              </button>
            )}

            {/* Refresh Deck Button - displayed on SYNC errors */}
            {parsed.category === 'SYNC' && (
              <button
                type="button"
                onClick={this.handleRefreshDeck}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-headline font-bold text-xs uppercase tracking-wider hover:bg-primary-hover shadow-sm transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refresh Deck
              </button>
            )}

            {/* Back to Dashboard Button - always available */}
            <button
              type="button"
              onClick={this.handleBackToDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white font-headline font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-colors ml-auto"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
