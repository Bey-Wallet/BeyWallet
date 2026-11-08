import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { nip19 } from 'nostr-tools';
import MintScreen from '~/features/payments/mint';
import {
  NavigationContext,
  NavigationRouteContext,
  NavigationHelpersContext,
  PreventRemoveProvider,
  usePreventRemoveContext,
} from '@react-navigation/native';

const mockNpub = nip19.npubEncode('02'.repeat(32));
let mockRouteParams: Record<string, string> = {};
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockQuote = jest.fn();
const mockSend = jest.fn();
const mockRefresh = jest.fn();
const mockBusy = jest.fn();
let mockRealGuard = false;
let mockPrevented = false;
const mockNavigation = {
  getState: () => ({ routes: [{ key: 'mint' }] }),
  addListener: () => () => {},
};
const mockRoute = { key: 'mint', name: 'mint' };
function GuardState() {
  mockPrevented = !!usePreventRemoveContext().preventedRoutes.mint?.preventRemove;
  return null;
}
function Screen() {
  return (
    <NavigationHelpersContext.Provider value={mockNavigation as any}>
      <NavigationContext.Provider value={mockNavigation as any}>
        <NavigationRouteContext.Provider value={mockRoute}>
          <PreventRemoveProvider>
            <GuardState />
            <MintScreen />
          </PreventRemoveProvider>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </NavigationHelpersContext.Provider>
  );
}
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockRouteParams,
  Stack: { Screen: 'Screen' },
}));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('~/shared/hooks/useFlowMint', () => ({
  useFlowMint: () => ({ mintUrl: 'https://mint.example', setMintUrl: jest.fn() }),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ refreshBalance: mockRefresh }),
}));
jest.mock('~/shared/hooks/useFeedbackOwner', () => ({ useFeedbackOwner: jest.fn() }));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({
  useSettingsBusy: (busy: boolean) => {
    mockBusy(busy);
    if (mockRealGuard)
      jest.requireActual('~/features/settings/hooks/useSettingsBusy').useSettingsBusy(busy);
  },
  useSettingsCanLeave: (busy: boolean) => {
    if (mockRealGuard)
      return jest
        .requireActual('~/features/settings/hooks/useSettingsBusy')
        .useSettingsCanLeave(busy);
    return !busy;
  },
}));
jest.mock('~/services/wallet', () => ({
  quotesService: { createMintQuote: (...args: unknown[]) => mockQuote(...args) },
  eventService: { on: () => jest.fn() },
  initService: { getRepo: jest.fn() },
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { sendChat: (...args: unknown[]) => mockSend(...args) },
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: async () => false },
}));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/features/payments/mint/AmountStage', () => ({ AmountStage: 'Amount' }));
jest.mock('~/features/payments/mint/ConfirmStage', () => ({ ConfirmStage: 'Confirm' }));
jest.mock('~/features/payments/mint/PaymentStage', () => ({ PaymentStage: 'Payment' }));
jest.mock('~/features/payments/mint/ResultStage', () => ({ ResultStage: 'Result' }));
jest.mock('~/features/payments/mint/OnchainMintFlow', () => ({ OnchainMintFlow: 'Onchain' }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockDismissTo.mockReset();
  mockRealGuard = false;
  mockRouteParams = { requestTo: mockNpub, requestName: 'Bob' };
  mockQuote.mockResolvedValue({
    quote: 'quote-1',
    request: 'lnbc-invoice',
    expiry: Date.now() / 1000 + 3600,
  });
  mockSend.mockImplementation(async (_npub, invoice, onQueued) =>
    onQueued({ id: 'message-1', text: invoice }),
  );
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function createInvoice() {
  await act(async () => {
    tree = create(<Screen />);
  });
  expect(mockQuote).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Amount' as any).props.setAmount('100'));
  await act(async () => tree.root.findByType('Amount' as any).props.onContinue());
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Confirm' as any).props.onConfirm());
}
const delivery = () => tree.root.findByType('Payment' as any).props.requestDelivery;

it('creates and sends the invoice on confirmation, then returns to its saved conversation card', async () => {
  await createInvoice();
  expect(mockQuote).toHaveBeenCalledWith('https://mint.example', 100);
  expect(mockSend).toHaveBeenCalledWith(mockNpub, 'lnbc-invoice', expect.any(Function));
  expect(tree.root.findAllByType('Payment' as any)).toHaveLength(0);
  expect(tree.root.findByType('Confirm' as any).props.isLoading).toBe(true);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockDismissTo).toHaveBeenCalledWith({
    pathname: '/(modals)/conversation',
    params: { npub: mockNpub },
  });
  expect(mockDismissTo).toHaveBeenCalledTimes(1);
});

it('releases the real navigation guard before returning to chat', async () => {
  mockRealGuard = true;
  let queue!: () => void;
  mockSend.mockImplementation((_npub, invoice, onQueued) => {
    queue = () => onQueued({ id: 'saved', text: invoice });
    return new Promise(() => {});
  });
  await createInvoice();
  expect(mockPrevented).toBe(true);
  const preventedAtReturn: boolean[] = [];
  mockDismissTo.mockImplementation(() => preventedAtReturn.push(mockPrevented));
  await act(async () => queue());
  expect(preventedAtReturn).toEqual([false]);
  mockDismissTo.mockReset();
});

it('retains one persisted request after publication failure and directs retry to its conversation card', async () => {
  mockSend.mockImplementation(async (_npub, invoice, onQueued) => {
    onQueued({ id: 'saved', text: invoice });
    throw new Error('Relay unavailable');
  });
  await createInvoice();
  expect(tree.root.findAllByType('Payment' as any)).toHaveLength(0);
  expect(mockDismissTo).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledTimes(1);
});

it('permits retry after failure before persistence, without creating another quote', async () => {
  mockSend.mockRejectedValueOnce(new Error('Storage unavailable'));
  await createInvoice();
  expect(delivery().queued).toBe(false);
  expect(mockDismissTo).not.toHaveBeenCalled();
  await act(async () => delivery().onSend());
  expect(delivery().queued).toBe(true);
  expect(mockQuote).toHaveBeenCalledTimes(1);
  expect(mockDismissTo).toHaveBeenCalledTimes(1);
});

it('returns as soon as the message is persisted without waiting for relay publication', async () => {
  let queued!: () => void;
  let finish!: () => void;
  mockSend.mockImplementation((_npub, invoice, onQueued) => {
    queued = () => onQueued({ id: 'saved', text: invoice });
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  await createInvoice();
  expect(mockDismissTo).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Payment' as any)).toHaveLength(0);
  expect(tree.root.findByType('Confirm' as any).props.isLoading).toBe(true);
  await act(async () => queued());
  expect(mockDismissTo).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Payment' as any)).toHaveLength(0);
  expect(tree.root.findByType('Confirm' as any).props.isLoading).toBe(true);
  await act(async () => tree.unmount());
  await act(async () => finish());
});

it('does not send or redirect for a normal wallet top-up', async () => {
  mockRouteParams = {};
  await createInvoice();
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockDismissTo).not.toHaveBeenCalled();
  expect(delivery()).toBeUndefined();
});

it('refuses an expired invoice and an invalid addressed recipient', async () => {
  mockQuote.mockResolvedValue({ quote: 'expired', request: 'lnbc-old', expiry: 1 });
  await createInvoice();
  await act(async () => delivery().onSend());
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  mockQuote.mockClear();
  mockRouteParams = { requestTo: 'invalid' };
  await act(async () => {
    tree = create(<MintScreen />);
  });
  await act(async () => tree.root.findByType('Amount' as any).props.setAmount('100'));
  await act(async () => tree.root.findByType('Amount' as any).props.onContinue());
  await act(async () => tree.root.findByType('Confirm' as any).props.onConfirm());
  expect(mockQuote).not.toHaveBeenCalled();
  expect(tree.root.findByType('Result' as any).props.error).toBe('Invalid request recipient.');
});
