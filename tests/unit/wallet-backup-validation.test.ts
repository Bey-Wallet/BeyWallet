import { parseWalletBackup, sameBackupIdentity } from '~/services/wallet/walletBackup';

// Public BIP39 test vectors only.
const phrase = `${'abandon '.repeat(11)}about`;
const other = `${'legal winner thank year wave sausage worth useful legal winner thank '}yellow`;

it('compares normalized BIP39 identities', () => {
  expect(sameBackupIdentity(phrase, `  ${phrase.toUpperCase().replace(/ /g, '  ')}  `)).toBe(true);
  expect(sameBackupIdentity(phrase, other)).toBe(false);
});

it('accepts older files with safe defaults for missing operation records', () => {
  expect(parseWalletBackup({ mnemonic: phrase })).toMatchObject({
    sendOperations: [],
    meltOperations: [],
    keypairs: [],
    meltQuotes: [],
  });
});

it.each([
  null,
  [],
  { mnemonic: phrase, proofs: {} },
  { mnemonic: phrase, counters: [{ mintUrl: 'https://mint.test', keysetId: 'id', counter: -1 }] },
  { mnemonic: phrase, version: 99 },
  { mnemonic: phrase, version: 4 },
])('rejects malformed/unsupported backup structures', (value) => {
  expect(() => parseWalletBackup(value)).toThrow();
});

it('does not accept an invalid maintenance operation just because the phrase is valid', () => {
  expect(() =>
    parseWalletBackup({ mnemonic: phrase, changeOperations: [{ id: 'bad', data: '{}' }] }),
  ).toThrow();
});

it('rejects unfinished payments without the input reservation data needed to resume them', () => {
  expect(() =>
    parseWalletBackup({
      mnemonic: phrase,
      sendOperations: [
        {
          id: 'send',
          mintUrl: 'https://mint.test',
          state: 'pending',
          createdAt: 1,
          updatedAt: 2,
          amount: 4,
        },
      ],
    }),
  ).toThrow('recovery information is incomplete');
});
