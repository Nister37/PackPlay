import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { CalendarFeedsPage } from './CalendarFeedsPage';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

describe('CalendarFeedsPage', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user-admin',
    email: 'admin@example.com',
    name: 'Admin Member',
    emailVerified: true,
    createdAt: '',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('previews calendar feed URL and displays detected events', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-admin', role: 'ADMIN', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      if (url.includes('/calendar-feeds')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    post.mockResolvedValueOnce({
      data: {
        events: [
          {
            title: 'Friendly Match vs Tigers',
            startDate: '2026-11-05T14:00:00Z',
            location: 'Pitch 3',
          },
        ],
      },
    });

    render(
      <AuthContext.Provider
        value={{
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
          login: async () => {},
          logout: async () => {},
          register: async () => {},
          setSession: () => {},
        }}
      >
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/groups/group-1/calendar']}>
            <Routes>
              <Route path="/groups/:groupId/calendar" element={<CalendarFeedsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('Calendar & Schedule Feeds')).toBeInTheDocument();

    const input = await screen.findByLabelText(/https icalendar \/ webcal url/i);
    fireEvent.change(input, { target: { value: 'https://example.com/calendar.ics' } });

    const previewBtn = screen.getByRole('button', { name: /preview feed/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/groups/group-1/calendar-feeds/preview-url', {
        url: 'https://example.com/calendar.ics',
      });
    });

    expect(await screen.findByText('Friendly Match vs Tigers')).toBeInTheDocument();
    expect(screen.getByText('Pitch 3')).toBeInTheDocument();
  });
});
