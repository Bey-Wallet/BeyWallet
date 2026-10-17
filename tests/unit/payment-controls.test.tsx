import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { PaymentNote } from '~/shared/ui/PaymentNote';

const mockStore = {
  activeMintUrl: 'mint-a',
  balances: { 'mint-a': 50, 'mint-b': 20 },
  mints: [
    { mintUrl: 'mint-a', name: 'A' },
    { mintUrl: 'mint-b', name: 'B' },
  ],
};
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: (s: typeof mockStore) => unknown) => select(mockStore),
}));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ MintSelectorSheet: 'MintSelectorSheet' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'ListTableRow' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('@tamagui/lucide-icons', () => ({ ChevronDown: 'ChevronDown' }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', Input: 'Input' }));

it('changes the confirmation mint and available balance without altering the home mint', async () => {
  let balance = 0;
  function Review() {
    const flow = useFlowMint();
    balance = flow.balance;
    return <PaymentMintRow mintUrl={flow.mintUrl!} onSelect={flow.setMintUrl} />;
  }
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Review />);
  });
  expect(balance).toBe(50);
  const sheet = () => tree.root.findByType('MintSelectorSheet' as any);
  expect(sheet().props.changeGlobalActiveMint).toBe(false);
  expect(sheet().props.showAllOption).toBe(false);
  await act(async () => sheet().props.onSelect('mint-b'));
  expect(balance).toBe(20);
  expect(mockStore.activeMintUrl).toBe('mint-a');
  expect(tree.root.findByType('ListTableRow' as any).props.value).toBe('B');
  await act(async () => tree.unmount());
});

it('keeps the note collapsed until requested and supports editing and clearing', async () => {
  function Note() {
    const [note, setNote] = React.useState('');
    return <PaymentNote value={note} onChange={setNote} />;
  }
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Note />);
  });
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  await act(async () => tree.root.findByType('ListTableRow' as any).props.onPress());
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Coffee'));
  expect(tree.root.findByType('ListTableRow' as any).props.value).toBe('Coffee');
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(tree.root.findByType('Input' as any).props.value).toBe('');
  await act(async () => tree.unmount());
});
