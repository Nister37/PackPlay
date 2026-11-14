import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { EventDetailPage } from './EventDetailPage';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

describe('EventDetailPage', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user-coach',
    email: 'coach@example.com',
    name: 'Coach Sarah',
    emailVerified: true,
    createdAt: '',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
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
          <MemoryRouter initialEntries={['/groups/group-1/activities/act-1']}>
            <Routes>
              <Route path="/groups/:groupId/activities/:activityId" element={<EventDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );
  };

  it('renders event details, readiness meter, and accepts weather suggestions', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/activities/act-1/weather')) {
        return Promise.resolve({
          data: {
            activityId: 'act-1',
            forecastAvailable: true,
            weather: {
              temperatureC: 14,
              precipitationProbability: 80,
              windSpeedKmh: 25,
              description: 'Heavy rain shower',
            },
            suggestions: [
              {
                id: 'sug-1',
                activityId: 'act-1',
                equipmentName: 'Rain Jackets',
                quantity: 11,
                reason: 'Heavy rain forecast during match time',
                category: 'APPAREL',
                status: 'PENDING',
              },
            ],
          },
        });
      }
      if (url.includes('/activities/act-1/shared-items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/activities/act-1/readiness')) {
        return Promise.resolve({
          data: {
            groupPercentage: 65,
            coveredSharedItems: 5,
            totalSharedItems: 8,
            memberReadiness: [],
          },
        });
      }
      if (url.includes('/groups/group-1/activities/act-1')) {
        return Promise.resolve({
          data: {
            id: 'act-1',
            groupId: 'group-1',
            name: 'State Cup Quarterfinal',
            scheduledAt: '2026-11-10T15:00:00Z',
          },
        });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-coach', role: 'ADMIN', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({ data: { success: true } });

    renderComponent();

    expect(await screen.findByText('State Cup Quarterfinal')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();

    // Switch to Weather tab
    const weatherTab = screen.getByRole('button', { name: /weather & suggestions/i });
    fireEvent.click(weatherTab);

    expect(await screen.findByText(/Rain Jackets ×11/i)).toBeInTheDocument();
    expect(screen.getByText(/Heavy rain forecast during match time/i)).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /accept to manifest/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/groups/group-1/activities/act-1/weather-suggestions/sug-1/accept',
        { target: 'SHARED' },
      );
    });
  });

  it('opens Smart Add modal, parses natural language text and submits accepted drafts', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/groups/group-1/activities/act-1')) {
        return Promise.resolve({
          data: { id: 'act-1', groupId: 'group-1', name: 'Training Session' },
        });
      }
      if (url.includes('/activities/act-1/shared-items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/activities/act-1/readiness')) {
        return Promise.resolve({
          data: { groupPercentage: 0, coveredSharedItems: 0, totalSharedItems: 0 },
        });
      }
      if (url.includes('/activities/act-1/weather')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-coach', role: 'OWNER', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({ data: { accepted: 2 } });

    renderComponent();

    expect(await screen.findByText('Training Session')).toBeInTheDocument();

    const smartAddBtn = screen.getByRole('button', {
      name: /smart add \(natural language\)/i,
    });
    fireEvent.click(smartAddBtn);

    expect(await screen.findByText(/Smart Add \(Natural Language Parser\)/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/e\.g\. 2 match balls/i);
    fireEvent.change(textarea, {
      target: { value: '3 soccer balls and 12 training bibs' },
    });

    expect(await screen.findByText(/Parsed Draft Items \(2\)/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /accept & add items/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/activities/act-1/smart-drafts/accept',
        expect.objectContaining({
          acceptedItems: expect.arrayContaining([
            expect.objectContaining({ name: 'Soccer balls', quantity: 3 }),
            expect.objectContaining({ name: 'Training bibs', quantity: 12 }),
          ]),
        }),
      );
    });
  });

  it('renders catalogue autocomplete suggestions and adds item to manifest', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/equipment-catalogue/search')) {
        return Promise.resolve({
          data: [
            {
              id: 'cat-1',
              canonicalName: 'Pro Shin Guards',
              category: 'PROTECTIVE',
            },
          ],
        });
      }
      if (url.includes('/groups/group-1/activities/act-1')) {
        return Promise.resolve({
          data: { id: 'act-1', groupId: 'group-1', name: 'Cup Match' },
        });
      }
      if (url.includes('/activities/act-1/shared-items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/activities/act-1/readiness')) {
        return Promise.resolve({
          data: { groupPercentage: 0, coveredSharedItems: 0, totalSharedItems: 0 },
        });
      }
      if (url.includes('/activities/act-1/weather')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-coach', role: 'ADMIN', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({ data: { id: 'item-1', name: 'Pro Shin Guards' } });

    renderComponent();

    expect(await screen.findByText('Cup Match')).toBeInTheDocument();

    const addItemBtn = screen.getByRole('button', { name: /\+ Add Item Manually/i });
    fireEvent.click(addItemBtn);

    expect(await screen.findByText(/Add Manifest Item/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Shin guards/i);
    fireEvent.change(nameInput, { target: { value: 'Shin' } });

    // Wait for debounced search and suggestion to render
    expect(await screen.findByText(/PRO SHIN GUARDS/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/PRO SHIN GUARDS/i));

    const submitBtn = screen.getByRole('button', { name: /^Add Item$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/activities/act-1/shared-items',
        expect.objectContaining({
          name: 'Pro Shin Guards',
          requiredQuantity: 1,
          category: 'PROTECTIVE',
        }),
      );
    });
  });

  it('switches to Roles tab, lists event roles, and creates a new role', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/roles')) {
        return Promise.resolve({
          data: [
            {
              id: 'role-1',
              activityId: 'act-1',
              name: 'First Aid Medic',
              requiredCount: 1,
              assignments: [],
            },
          ],
        });
      }
      if (url.includes('/groups/group-1/activities/act-1')) {
        return Promise.resolve({
          data: { id: 'act-1', groupId: 'group-1', name: 'Cup Match' },
        });
      }
      if (url.includes('/activities/act-1/shared-items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/activities/act-1/readiness')) {
        return Promise.resolve({
          data: { groupPercentage: 0, coveredSharedItems: 0, totalSharedItems: 0 },
        });
      }
      if (url.includes('/activities/act-1/weather')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-coach', role: 'ADMIN', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({ data: { id: 'role-2', name: 'Kit Officer' } });

    renderComponent();

    expect(await screen.findByText('Cup Match')).toBeInTheDocument();

    const rolesTab = screen.getByRole('button', { name: /Roles & RSVP/i });
    fireEvent.click(rolesTab);

    expect(await screen.findByText('First Aid Medic')).toBeInTheDocument();

    const createRoleBtn = screen.getByRole('button', { name: /\+ Create Role/i });
    fireEvent.click(createRoleBtn);

    expect(await screen.findByText('Create Event Role')).toBeInTheDocument();

    const roleNameInput = screen.getByPlaceholderText(/e\.g\. Field Medic/i);
    fireEvent.change(roleNameInput, { target: { value: 'Kit Officer' } });

    const submitRoleBtn = screen.getByRole('button', { name: /^Create Role$/i });
    fireEvent.click(submitRoleBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/groups/group-1/activities/act-1/roles',
        { name: 'Kit Officer' },
      );
    });
  });

  it('opens Make Recurring modal and creates recurrence series with timezone', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/groups/group-1/activities/act-1')) {
        return Promise.resolve({
          data: { id: 'act-1', groupId: 'group-1', name: 'Cup Match' },
        });
      }
      if (url.includes('/activities/act-1/shared-items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/activities/act-1/readiness')) {
        return Promise.resolve({
          data: { groupPercentage: 0, coveredSharedItems: 0, totalSharedItems: 0 },
        });
      }
      if (url.includes('/activities/act-1/weather')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-coach', role: 'ADMIN', user: mockUser }],
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({ data: { seriesId: 'ser-1', created: 4 } });

    renderComponent();

    expect(await screen.findByText('Cup Match')).toBeInTheDocument();

    const recurringBtn = screen.getByRole('button', { name: /Make Recurring/i });
    fireEvent.click(recurringBtn);

    expect(await screen.findByText('Set Recurrence Schedule')).toBeInTheDocument();

    const createSeriesBtn = screen.getByRole('button', { name: /Create Series/i });
    fireEvent.click(createSeriesBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/groups/group-1/activities/act-1/recurrence',
        expect.objectContaining({
          frequency: 'WEEKLY',
          interval: 1,
          count: 6,
          timezone: expect.any(String),
        }),
      );
    });
  });
});
