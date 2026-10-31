import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NavigationContext } from '@react-navigation/native';
import { usePendingPaymentPolling } from '~/shared/hooks/usePendingPaymentPolling';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';

let mockOffline = false;
const mockAppListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (state: string) => void) => {
      mockAppListeners.add(callback);
      return { remove: () => mockAppListeners.delete(callback) };
    },
  },
}));
jest.mock('@react-navigation/native', () => ({
  NavigationContext: require('react').createContext(undefined),
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTableRow: (props: any) => require('react').createElement('Row', props, props.rightContent),
}));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'Refresh' }));
jest.mock('@tamagui/lucide-icons', () => ({ RefreshCw: 'RefreshIcon' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({
  paymentStatusColors: { pending: '$orange10' },
}));

let tree: ReactTestRenderer;
function Probe({
  check,
  enabled = true,
}: {
  check: () => Promise<void> | void;
  enabled?: boolean;
}) {
  usePendingPaymentPolling(check, enabled);
  return null;
}
beforeEach(() => {
  jest.useFakeTimers();
  mockOffline = false;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
  mockAppListeners.clear();
});
async function render(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

it('checks immediately, waits for slow requests, and uses the latest callback without restarting', async () => {
  let finish!: () => void;
  const slow = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const next = jest.fn();
  await render(<Probe check={slow} />);
  expect(slow).toHaveBeenCalledTimes(1);
  await advance(10_000);
  expect(slow).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Probe check={next} />));
  await act(async () => finish());
  await advance(1_999);
  expect(next).not.toHaveBeenCalled();
  await advance(1);
  expect(next).toHaveBeenCalledTimes(1);
});

it('pauses offline, backgrounded and unfocused, and stops after completion', async () => {
  const events: Record<string, () => void> = {};
  const navigation = {
    isFocused: () => true,
    addListener: (name: string, callback: () => void) => {
      events[name] = callback;
      return jest.fn();
    },
  };
  const check = jest.fn();
  const view = (enabled = true) => (
    <NavigationContext.Provider value={navigation as any}>
      <Probe check={check} enabled={enabled} />
    </NavigationContext.Provider>
  );
  await render(view());
  expect(check).toHaveBeenCalledTimes(1);
  mockOffline = true;
  await act(async () => tree.update(view()));
  await advance(10_000);
  expect(check).toHaveBeenCalledTimes(1);
  mockOffline = false;
  await act(async () => tree.update(view()));
  expect(check).toHaveBeenCalledTimes(2);
  await act(async () => events.blur());
  await advance(10_000);
  expect(check).toHaveBeenCalledTimes(2);
  await act(async () => events.focus());
  expect(check).toHaveBeenCalledTimes(3);
  await act(async () => mockAppListeners.forEach((callback) => callback('background')));
  await advance(10_000);
  expect(check).toHaveBeenCalledTimes(3);
  await act(async () => mockAppListeners.forEach((callback) => callback('active')));
  expect(check).toHaveBeenCalledTimes(4);
  await act(async () => tree.update(view(false)));
  await advance(10_000);
  expect(check).toHaveBeenCalledTimes(4);
});

it('retries a failed observation without treating it as a failed payment', async () => {
  const check = jest.fn().mockRejectedValue(new Error('Unavailable'));
  await render(<Probe check={check} />);
  await advance(2_000);
  expect(check).toHaveBeenCalledTimes(2);
});

it('shows one listening spinner during and between checks, then removes it on settlement', async () => {
  await render(
    <PaymentStatusRow status="pending" value="Awaiting payment" onRefresh={jest.fn()} />,
  );
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('Refresh' as any)).toHaveLength(0);
  await act(async () =>
    tree.update(
      <PaymentStatusRow status="pending" value="Awaiting payment" checking onRefresh={jest.fn()} />,
    ),
  );
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('Refresh' as any)).toHaveLength(0);
  expect(tree.root.findByType('Row' as any).props.value).toBe('Awaiting payment');
  await act(async () => tree.update(<PaymentStatusRow status="success" value="Received" />));
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
});
