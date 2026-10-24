import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { OnchainTransactionRows } from '~/features/history/components/OnchainTransactionRows';
import { fetchDepositTransactionIds } from '~/services/api/onchainTransactionService';
import { blockchainTransactionUrl, transactionIdFromOutpoint } from '~/shared/utils/onchain';
import { quotesService } from '~/services/wallet';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('tamagui', () => ({ YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({ ExternalLink: 'ExternalLink' }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'Row' }));
jest.mock('~/services/wallet', () => ({
  quotesService: { checkOnchainMeltQuote: jest.fn() },
}));

const txid = 'a'.repeat(64);
const otherTxid = 'b'.repeat(64);
const address = 'bc1qexample';
let tree: ReactTestRenderer;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  (useQuery as jest.Mock).mockReturnValue({ data: [txid] });
});

afterEach(async () => {
  await act(async () => tree?.unmount());
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it('extracts a transaction ID from a mint outpoint and rejects malformed values', () => {
  expect(transactionIdFromOutpoint(`${txid}:2`)).toBe(txid);
  for (const value of [null, 'quote-id', `${txid}:invalid`, `${txid}/other`]) {
    expect(transactionIdFromOutpoint(value)).toBeUndefined();
  }
  expect(blockchainTransactionUrl(txid, `bitcoin:${address}?amount=1`)).toBe(
    `https://www.blockchain.com/explorer/transactions/btc/${txid}`,
  );
  expect(blockchainTransactionUrl(txid, 'tb1qexample')).toBeUndefined();
  expect(blockchainTransactionUrl('invalid', address)).toBeUndefined();
});

it('includes distinct incoming deposits and excludes unrelated transactions', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { txid, vout: [{ scriptpubkey_address: address }] },
      { txid: otherTxid, vout: [{ scriptpubkey_address: address }] },
      { txid, vout: [{ scriptpubkey_address: address }] },
      { txid: 'c'.repeat(64), vout: [{ scriptpubkey_address: 'another-address' }] },
    ],
  });
  await expect(fetchDepositTransactionIds(`bitcoin:${address}?amount=1`)).resolves.toEqual([
    txid,
    otherTxid,
  ]);
});

it('opens the displayed hash in Blockchain.com when the row is tapped', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<OnchainTransactionRows direction="deposit" address={address} />);
  });
  const row = tree.root.findByType('Row' as any);
  expect(row.props.label).toBe('Transaction hash');
  expect(row.props.rightContent.type).toBe('ExternalLink');
  await act(async () => row.props.onPress());
  expect(open).toHaveBeenCalledWith(`https://www.blockchain.com/explorer/transactions/btc/${txid}`);
});

it('uses the outgoing quote outpoint instead of guessing from destination activity', async () => {
  (quotesService.checkOnchainMeltQuote as jest.Mock).mockResolvedValue({
    outpoint: `${txid}:0`,
  });
  await act(async () => {
    tree = create(
      <OnchainTransactionRows
        direction="withdrawal"
        address={address}
        mintUrl="https://mint.example"
        quoteId="quote-123"
      />,
    );
  });
  const query = (useQuery as jest.Mock).mock.calls[0][0];
  await expect(query.queryFn()).resolves.toEqual([txid]);
  expect(quotesService.checkOnchainMeltQuote).toHaveBeenCalledWith(
    'https://mint.example',
    'quote-123',
  );
});

it('does not provide a link before a transaction hash is available', async () => {
  (useQuery as jest.Mock).mockReturnValue({ data: [] });
  await act(async () => {
    tree = create(<OnchainTransactionRows direction="deposit" address={address} pending />);
  });
  const row = tree.root.findByType('Row' as any);
  expect(row.props.value).toBe('Unavailable');
  expect(row.props.onPress).toBeUndefined();
});
