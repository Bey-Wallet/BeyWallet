import { selectTransferSource } from '~/features/payments/swap/mintSelection';

const mints = [
  { mintUrl: 'https://one.test/Bitcoin', trusted: true },
  { mintUrl: 'https://two.test', trusted: true },
  { mintUrl: 'https://untrusted.test', trusted: false },
];
const balances = {
  'https://one.test/Bitcoin': 42,
  'https://two.test': 100,
  'https://untrusted.test': 500,
};

it('honors a requested trusted source over the global selection and canonicalizes its URL', () => {
  expect(
    selectTransferSource(mints, balances, 'https://two.test', 'https://ONE.test/Bitcoin/'),
  ).toBe('https://one.test/Bitcoin');
});

it.each(['https://untrusted.test', 'https://missing.test', 'https://one.test/bitcoin'])(
  'ignores an unavailable or untrusted requested source (%j)',
  (requested) => {
    expect(selectTransferSource(mints, balances, 'https://one.test/Bitcoin', requested)).toBe(
      'https://one.test/Bitcoin',
    );
  },
);

it('ignores repeated source query parameters instead of treating them as a mint URL', () => {
  expect(
    selectTransferSource(mints, balances, 'https://one.test/Bitcoin', ['https://two.test'] as any),
  ).toBe('https://one.test/Bitcoin');
});

it('selects only trusted mints when the global selection is stale or untrusted', () => {
  expect(selectTransferSource(mints, balances, 'https://untrusted.test')).toBe(
    'https://one.test/Bitcoin',
  );
  expect(selectTransferSource([mints[2]], balances, 'https://untrusted.test')).toBe('');
  expect(selectTransferSource([], {}, null)).toBe('');
});
