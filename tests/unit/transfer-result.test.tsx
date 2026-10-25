import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ResultStage } from '~/features/payments/swap/ResultStage';

jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('~/shared/ui/PaymentReceipt', () => ({ PaymentReceipt: 'Receipt' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (n: number) => String(n) },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) =>
    selector({
      mints: [
        { mintUrl: 'https://source.example', name: 'Source' },
        { mintUrl: 'https://target.example', nickname: 'Destination' },
      ],
    }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const props = {
  amount: '100',
  sourceMintUrl: 'https://source.example',
  targetMintUrl: 'https://target.example',
  error: null,
  onClose: jest.fn(),
};

it.each([
  ['pending', 'Transfer pending', false],
  ['success', 'Transfer completed', true],
  ['error', 'Transfer not completed', false],
] as const)('shows the correct receipt for %s', async (status, title, completed) => {
  await act(async () => {
    tree = create(<ResultStage {...props} status={status} />);
  });
  const receipt = tree.root.findByType('Receipt' as any);
  expect(receipt.props.title).toBe(title);
  expect(receipt.props.completed).toBe(completed);
  expect(tree.root.findByProps({ label: 'From mint' }).props.value).toBe('Source');
  expect(tree.root.findByProps({ label: 'To mint' }).props.value).toBe('Destination');
});

it('distinguishes delayed issuance from a failed transfer and retains its timestamp', async () => {
  const record = { stage: 'issuance', createdAt: 123, feePaid: null, feeReserve: 3 } as any;
  await act(async () => {
    tree = create(<ResultStage {...props} status="pending" record={record} />);
  });
  const receipt = tree.root.findByType('Receipt' as any);
  expect(receipt.props.statusLabel).toBe('Waiting for destination ecash');
  expect(receipt.props.time).toBe(123);
  expect(tree.root.findByProps({ label: 'Maximum fee' }).props.value).toBe('3');
});
