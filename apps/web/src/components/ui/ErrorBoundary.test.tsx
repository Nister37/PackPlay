import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ErrorBoundary } from './ErrorBoundary';
import { AppErrorCode } from '@packplay/common';

function ProblemChild({ shouldThrow, error }: { shouldThrow: boolean; error?: Error }) {
  if (shouldThrow) {
    throw error ?? new Error('Simulated component failure');
  }
  return <div>Safe child content</div>;
}

describe('ErrorBoundary', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, href: '', pathname: '/dashboard', reload: vi.fn() } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (window as any).location = originalLocation;
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Safe child content')).toBeInTheDocument();
  });

  it('catches generic errors and renders recovery UI with Retry and Back to Dashboard buttons', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText('Simulated component failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-authenticate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh deck/i })).not.toBeInTheDocument();
  });

  it('recognizes Axios 401 and AppErrorCode.UNAUTHORIZED, showing Re-authenticate button', () => {
    const axiosError = new axios.AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        status: 401,
        statusText: 'Unauthorized',
        data: { code: AppErrorCode.UNAUTHORIZED, message: 'Invalid session token' },
        headers: {},
        config: {} as any,
      },
    );

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} error={axiosError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('AUTH ERROR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-authenticate/i })).toBeInTheDocument();

    // Clicking Re-authenticate clears tokens and redirects to /login
    localStorage.setItem('accessToken', 'mock-token');
    fireEvent.click(screen.getByRole('button', { name: /re-authenticate/i }));
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('recognizes Axios 409 and AppErrorCode.CONCURRENT_MODIFICATION, showing Refresh Deck button', () => {
    const syncError = new axios.AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        status: 409,
        statusText: 'Conflict',
        data: { code: AppErrorCode.CONCURRENT_MODIFICATION, message: 'Deck out of sync' },
        headers: {},
        config: {} as any,
      },
    );

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} error={syncError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Deck Sync Conflict')).toBeInTheDocument();
    expect(screen.getByText('SYNC CONFLICT')).toBeInTheDocument();
    const refreshBtn = screen.getByRole('button', { name: /refresh deck/i });
    expect(refreshBtn).toBeInTheDocument();

    // Clicking Refresh Deck clears persistent swiped state and navigates to /packing
    localStorage.setItem('pack:swiped:user1:act1', '["item-1"]');
    fireEvent.click(refreshBtn);
    expect(localStorage.getItem('pack:swiped:user1:act1')).toBeNull();
    expect(window.location.href).toBe('/packing');
  });

  it('resets error state when clicking Retry', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

    // Change shouldThrow to false before retrying
    rerender(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Safe child content')).toBeInTheDocument();
  });

  it('navigates to /dashboard when clicking Back to Dashboard button', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(window.location.href).toBe('/dashboard');
  });

  it('recognizes AppError with domain not found codes', () => {
    const error = new Error('Squad not found');
    (error as any).code = AppErrorCode.GROUP_NOT_FOUND;
    (error as any).statusCode = 404;

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} error={error} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Item or Resource Not Found')).toBeInTheDocument();
    expect(screen.getByText('NOT FOUND (404)')).toBeInTheDocument();
    expect(screen.getByText(/GROUP_NOT_FOUND/)).toBeInTheDocument();
  });

  it('recognizes AppError with membership/forbidden codes', () => {
    const error = new Error('Not a squad member');
    (error as any).code = AppErrorCode.NOT_A_MEMBER;
    (error as any).statusCode = 403;

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} error={error} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText('FORBIDDEN (403)')).toBeInTheDocument();
  });

  it('recognizes network errors and displays offline recovery badge', () => {
    const networkError = new axios.AxiosError(
      'Network Error',
      'ERR_NETWORK',
      undefined,
      {},
      undefined,
    );

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} error={networkError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    expect(screen.getByText('NETWORK OFFLINE')).toBeInTheDocument();
  });
});
