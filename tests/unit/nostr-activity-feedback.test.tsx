import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '~/features/nostr/NostrActivityScreen';

let mockHistory: any;
const mockRefetch = jest.fn();
const mockRefreshPending = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['Text', 'YStack', 'XStack', 'View', 'Separator', 'H6', 'Theme'].map((name) => [name, name]),
  ),
);
jest.mock('~/shared/icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/Blockies', () => ({ __esModule: true, default: 'Avatar' }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({ __esModule: true, default: 'Sheet' }));
jest.mock('~/shared/hooks/useAppToast', () => ({ useAppToast: () => ({}) }));
jest.mock('~/services/platform/hapticService', () => ({ hapticService: {} }));
jest.mock('~/state/peopleStore', () => ({
  usePeopleStore: (select: any) => select({ people: {} }),
}));
jest.mock('~/state/nostrInboxStore', () => ({
  useNostrInboxStore: (select: any) =>
    select({ items: [], refreshPendingStates: mockRefreshPending }),
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: (select: any) => select({ payments: [] }),
  findRequestPayment: jest.fn(),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({ primaryCurrency: 'SATS', secondaryCurrency: 'NONE' }),
}));
jest.mock('~/services/wallet', () => ({ historyService: {} }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({ currencyService: {} }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
  useQuery: ({ queryKey }: any) => (queryKey[0] === 'history' ? mockHistory : {}),
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  mockRefetch.mockReset().mockResolvedValue({});
  mockRefreshPending.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each(['loading', 'failed', 'empty'] as const)(
  'distinguishes %s sent activity and keeps failed checks retryable',
  async (state) => {
    mockHistory = {
      data: [],
      isPending: state === 'loading',
      isError: state === 'failed',
      isFetching: state === 'loading',
      refetch: mockRefetch,
    };
    await act(async () => {
      tree = create(<Screen />);
    });
    await act(async () => {
      tree.root
        .findAllByType('Text' as any)
        .find((node) => node.props.children === 'Sent')!
        .parent!.props.onPress();
    });
    const text = tree.root
      .findAllByType('Text' as any)
      .map((node) => node.props.children)
      .join(' ');
    if (state === 'loading') {
      expect(text).toContain('Loading sent payments');
      expect(text).not.toContain('No sent payments');
    } else if (state === 'failed') {
      expect(text).toContain('Could not load sent payments');
      expect(text).not.toContain('No sent payments');
      await act(async () => tree.root.findByType('Button' as any).props.onPress());
      expect(mockRefetch).toHaveBeenCalledWith({ throwOnError: true });
      expect(mockRefreshPending).toHaveBeenCalledTimes(1);
    } else {
      expect(text).toContain('No sent payments');
      expect(text).not.toContain('Could not load');
    }
  },
);
