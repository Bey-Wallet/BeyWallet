import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { GetChangeSheet } from '~/features/settings/components/GetChangeSheet';
import {
  ChangePreparationError,
  type ChangeReview,
} from '~/services/wallet/changePreparationService';

const mockWallet = {
  activeMintUrl: 'mint-a',
  mints: [
    { mintUrl: 'mint-a', trusted: true },
    { mintUrl: 'mint-b', trusted: true },
  ],
  refreshBalance: jest.fn(async () => {}),
};
const mockPrepare = jest.fn();
let mockOffline = false;
jest.mock('~/state/walletStore', () => ({ useWalletStore: () => mockWallet }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('~/services/wallet/changePreparationService', () => ({
  getChangePreparation: () => ({ prepare: mockPrepare }),
  ChangePreparationError: class extends Error {
    constructor(
      message: string,
      public needsReview = false,
    ) {
      super(message);
    }
  },
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, _ref: any) => React.createElement('Sheet', props)),
  };
});
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

function review(mintUrl = 'mint-a'): ChangeReview {
  return {
    id: 'change-' + mintUrl,
    mintUrl,
    inputAmount: 32,
    fee: 1,
    outputAmount: 31,
    submitted: false,
    execute: jest.fn(async () => ({ amount: 31, coinCount: 15 })),
    dispose: jest.fn(async () => {}),
  };
}
async function open() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<GetChangeSheet ref={React.createRef()} />);
  });
  await act(async () => tree.root.findByType('Sheet' as any).props.onOpenChange(true));
  return tree;
}
const primary = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType('AppButton' as any)
    .find((button) => button.props.emphasis !== 'secondary')!;
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
});

it('reviews the whole balance, changes mints locally, and releases canceled reviews', async () => {
  const first = review(),
    second = review('mint-b');
  mockPrepare.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const tree = await open();
  expect(mockPrepare).toHaveBeenLastCalledWith('mint-a');
  expect(tree.root.findAllByType('ListTableRow' as any).map((row) => row.props.value)).toEqual([
    '32 sats',
    '1 sats',
    '31 sats',
  ]);
  expect(first.execute).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('PaymentMintRow' as any).props.onSelect('mint-b'));
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(mockPrepare).toHaveBeenLastCalledWith('mint-b');
  expect(mockWallet.activeMintUrl).toBe('mint-a');
  await act(async () => tree.root.findByType('Sheet' as any).props.onOpenChange(false));
  expect(second.dispose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('blocks offline preparation and reports an empty mint without enabling a swap', async () => {
  mockOffline = true;
  const tree = await open();
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(primary(tree).props.disabled).toBe(true);
  mockOffline = false;
  mockPrepare.mockRejectedValueOnce(
    new ChangePreparationError('No available balance at this mint.'),
  );
  await act(async () => tree.update(<GetChangeSheet ref={React.createRef()} />));
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'No available balance at this mint.'),
  ).toBe(true);
  expect(primary(tree).props.children).toBe('Retry');
  await act(async () => tree.unmount());
});

it('executes duplicate taps once, locks dismissal during submission, and uses a secondary Done action', async () => {
  const prepared = review();
  let complete!: (result: any) => void;
  jest.mocked(prepared.execute).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  mockPrepare.mockResolvedValue(prepared);
  const tree = await open();
  await act(async () => {
    primary(tree).props.onPress();
    primary(tree).props.onPress();
  });
  expect(prepared.execute).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
  await act(async () => complete({ amount: 31, coinCount: 15 }));
  const buttons = tree.root.findAllByType('AppButton' as any);
  expect(buttons).toHaveLength(1);
  expect(buttons[0].props).toMatchObject({ children: 'Done', emphasis: 'secondary' });
  expect(mockWallet.refreshBalance).toHaveBeenCalledTimes(1);
  mockOffline = true;
  await act(async () => tree.update(<GetChangeSheet ref={React.createRef()} />));
  expect(tree.root.findAllByType('AppButton' as any)).toHaveLength(1);
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('requires a fresh fee review after a changed quote and retains submitted errors for retry', async () => {
  const first = review(),
    second = review();
  jest
    .mocked(first.execute)
    .mockRejectedValueOnce(new ChangePreparationError('Fee changed. Review again.', true));
  mockPrepare.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const tree = await open();
  await act(async () => primary(tree).props.onPress());
  await act(async () => primary(tree).props.onPress());
  expect(mockPrepare).toHaveBeenCalledTimes(2);
  expect(second.execute).not.toHaveBeenCalled();
  jest
    .mocked(second.execute)
    .mockRejectedValueOnce(
      new ChangePreparationError(
        'Change preparation is unfinished. Reconnect and retry this operation.',
      ),
    );
  await act(async () => primary(tree).props.onPress());
  expect(primary(tree).props.children).toBe('Retry');
  expect(mockPrepare).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
