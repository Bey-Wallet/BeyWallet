import {
  readLightningRecipient,
  saveLightningRecipient,
  readLightningReceiptSnapshot,
  removeLightningRecipient,
} from '~/services/wallet/lightningReceiptContext';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
const mockValues = new Map<string, string>();
const mockQuote = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      meltQuoteRepository: { getMeltQuote: mockQuote },
      mintQuoteRepository: { getMintQuote: mockQuote },
    }),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: {
    getItem: (key: string) => mockValues.get(key) ?? null,
    setItem: (key: string, value: string) => mockValues.set(key, value),
    removeItem: (key: string) => mockValues.delete(key),
  },
}));
beforeEach(() => mockValues.clear());
it('retains recipients across receipt reads while isolating wallets and mints', () => {
  saveLightningRecipient('wallet-a', 'https://mint', 'quote', 'alice@example.com');
  expect(readLightningRecipient('wallet-a', 'https://mint/', 'quote')).toBe('alice@example.com');
  expect(readLightningRecipient('wallet-b', 'https://mint', 'quote')).toBeUndefined();
  expect(readLightningRecipient('wallet-a', 'https://other', 'quote')).toBeUndefined();
});
it('tolerates unavailable or malformed receipt annotations without interrupting payment', () => {
  jest.spyOn(sqliteStorage, 'setItem').mockImplementationOnce(() => {
    throw new Error('Unavailable');
  });
  expect(() => saveLightningRecipient('wallet', 'mint', 'quote', 'a@example.com')).not.toThrow();
  expect(readLightningRecipient(undefined, 'mint', 'quote')).toBeUndefined();
});

it('reads allowlisted local quote fields without exposing signing material', async () => {
  mockQuote.mockResolvedValue({
    request: 'invoice',
    state: 'PAID',
    amount: 21,
    privkey: 'PRIVATE',
    privateKey: 'PRIVATE',
    outputs: [{ secret: 'PROOF' }],
  });
  const snapshot = await readLightningReceiptSnapshot('wallet', 'mint', 'quote', false);
  expect(snapshot).toMatchObject({ request: 'invoice', state: 'PAID', amount: 21 });
  expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|PROOF/);
});

it('removes recipient annotations with their receipt', () => {
  saveLightningRecipient('wallet', 'mint', 'quote', 'a@example.com');
  removeLightningRecipient('wallet', 'mint', 'quote');
  expect(readLightningRecipient('wallet', 'mint', 'quote')).toBeUndefined();
});
