import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { TeamInventoryPage } from './TeamInventoryPage';
import { InventoryQrResolutionPage } from './InventoryQrResolutionPage';
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

describe('Team Inventory & QR Resolution', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user-owner',
    email: 'owner@example.com',
    name: 'Team Owner',
    emailVerified: true,
    createdAt: '',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactNode, initialRoute = '/groups/group-1/inventory') => {
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
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/groups/:groupId/inventory" element={ui} />
              <Route path="/inventory-qr/:token" element={ui} />
              <Route path="/inventory/scan/:token" element={ui} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );
  };

  it('renders team inventory catalogue with items and stock counts', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-owner', role: 'OWNER', user: mockUser }],
        });
      }
      if (url.includes('/inventory/locations/all')) {
        return Promise.resolve({ data: [{ id: 'loc-1', name: 'Locker 1' }] });
      }
      if (url.includes('/inventory-overdue')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      if (url.includes('/inventory')) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'inv-1',
                groupId: 'group-1',
                name: 'Training Cones',
                category: 'TRAINING',
                trackingType: 'BATCH',
                totalQuantity: 50,
                availableQuantity: 40,
                checkedOutQuantity: 10,
                reservedQuantity: 0,
                unit: 'pcs',
                isArchived: false,
                batches: [],
              },
            ],
            meta: { total: 1 },
          },
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    renderWithProviders(<TeamInventoryPage />);

    expect(await screen.findByText('Team Inventory')).toBeInTheDocument();
    expect(await screen.findByText('Training Cones')).toBeInTheDocument();
    expect(screen.getByText('40 / 50')).toBeInTheDocument();
  });

  it('resolves inventory QR token and allows returning checked out custody', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/inventory-qr/')) {
        return Promise.resolve({
          data: {
            token: 'qr-token-abc',
            targetType: 'ITEM',
            item: {
              id: 'inv-1',
              groupId: 'group-1',
              name: 'Official Match Ball',
              category: 'BALLS',
              availableQuantity: 0,
              totalQuantity: 1,
            },
            activeCustody: {
              id: 'custody-1',
              userId: 'borrower-1',
              quantity: 1,
              checkedOutAt: '2026-10-20T10:00:00Z',
              user: { name: 'Player John', email: 'john@example.com' },
            },
          },
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    post.mockResolvedValueOnce({ data: { returned: true } });

    renderWithProviders(<InventoryQrResolutionPage />, '/inventory-qr/qr-token-abc');

    expect(await screen.findByText('Official Match Ball')).toBeInTheDocument();
    expect(screen.getByText(/Player John/i)).toBeInTheDocument();
    expect(screen.getByText(/Currently Checked Out/i)).toBeInTheDocument();

    const returnBtn = screen.getByRole('button', { name: /return to inventory now/i });
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/groups/group-1/inventory-operations/custodies/custody-1/return',
        expect.objectContaining({ condition: 'GOOD' }),
      );
    });
  });

  it('generates printable QR code when requested from item batch', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ id: 'm-1', userId: 'user-owner', role: 'OWNER', user: mockUser }],
        });
      }
      if (url.includes('/inventory/locations/all')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/inventory-overdue')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      if (url.includes('/inventory')) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'inv-1',
                groupId: 'group-1',
                name: 'Training Cones',
                category: 'TRAINING',
                trackingType: 'BATCH',
                totalQuantity: 50,
                availableQuantity: 40,
                checkedOutQuantity: 10,
                reservedQuantity: 0,
                unit: 'pcs',
                isArchived: false,
                batches: [{ id: 'b-1', quantity: 50, availableQuantity: 40 }],
              },
            ],
            meta: { total: 1 },
          },
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    post.mockResolvedValueOnce({
      data: {
        token: 'qr-gen-123',
        url: 'http://localhost:3000/inventory/scan/qr-gen-123',
        qrDataUrl: 'data:image/png;base64,mockqrdata',
      },
    });

    renderWithProviders(<TeamInventoryPage />);

    expect(await screen.findByText('Training Cones')).toBeInTheDocument();

    // Expand item to reveal details
    fireEvent.click(screen.getByText('Training Cones'));

    expect(await screen.findByText('Item Details & Stock Breakout')).toBeInTheDocument();

    const printQrBtn = screen.getByRole('button', { name: /^Print QR$/i });
    fireEvent.click(printQrBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/groups/group-1/inventory-qr',
        { batchId: 'b-1' },
      );
    });

    expect(await screen.findByText('Printable QR Code')).toBeInTheDocument();
    expect(screen.getByAltText('Inventory QR Code')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Lookup/i })).toHaveAttribute(
      'href',
      '/inventory/scan/qr-gen-123',
    );
  });

  it('resolves inventory QR via /inventory/scan/:token route', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/inventory-qr/')) {
        return Promise.resolve({
          data: {
            token: 'scan-token-xyz',
            targetType: 'ITEM',
            item: {
              id: 'inv-2',
              groupId: 'group-1',
              name: 'Speed Agility Ladders',
              category: 'TRAINING',
              availableQuantity: 5,
              totalQuantity: 5,
            },
          },
        });
      }
      if (url.includes('/notifications')) {
        return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    renderWithProviders(<InventoryQrResolutionPage />, '/inventory/scan/scan-token-xyz');

    expect(await screen.findByText('Speed Agility Ladders')).toBeInTheDocument();
    expect(screen.getByText(/In Storage \/ Available/i)).toBeInTheDocument();
  });
});
