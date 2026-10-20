import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HistoryItem } from '~/features/history/components/HistoryItem';
import type { HistoryListEntry } from '~/features/history/historyListModel';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/theme/ThemeContext', () => ({
  useAppTheme: () => ({ resolvedTheme: 'dark' }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  ArrowUp: 'Sent',
  ArrowDown: 'Received',
  ArrowRightLeft: 'Transfer',
  HandCoins: 'Request',
  CircleHelp: 'Help',
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(() => ({ primaryCurrency: 'SATS', secondaryCurrency: 'NONE' }), {
    getState: () => ({ showBitcoinSymbol: false }),
  }),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: { fetchPrice: jest.fn() } }));

const now = new Date(2026, 9, 20, 12);
const entry: HistoryListEntry = {
  id: '1',
  type: 'send',
  amount: 100,
  unit: 'sat',
  mintUrl: 'https://mint.example',
  state: 'pending',
  createdAt: now.getTime(),
};

describe('History card detail navigation', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
  });

  it.each([
    ['send', 'pending'],
    ['mint', 'unpaid'],
    ['melt', 'pending'],
    ['receive-request', 'pending'],
    ['send', 'claimed'],
    ['melt', 'failed'],
  ])('opens %s details in state %s through a single card action', async (type, state) => {
    const press = jest.fn();
    await act(async () => {
      tree = create(<HistoryItem entry={{ ...entry, type, state }} now={now} onPress={press} />);
    });
    const actions = tree.root.findAllByType('AppPressable' as any);
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityLabel).toContain(
      state === 'unpaid'
        ? 'Pending'
        : state === 'pending'
          ? 'Pending'
          : state === 'failed'
            ? 'Failed'
            : 'Sent',
    );
    await act(async () => actions[0].props.onPress());
    expect(press).toHaveBeenCalledWith('1', type);
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('removes the inline pending label when wallet events update the entry', async () => {
    await act(async () => {
      tree = create(<HistoryItem entry={entry} now={now} onPress={() => {}} />);
    });
    expect(tree.root.findByType('AppPressable' as any).props.accessibilityLabel).toContain(
      'Pending',
    );
    await act(async () =>
      tree.update(
        <HistoryItem entry={{ ...entry, state: 'claimed' }} now={now} onPress={() => {}} />,
      ),
    );
    expect(tree.root.findByType('AppPressable' as any).props.accessibilityLabel).not.toContain(
      'Pending',
    );
  });
});
