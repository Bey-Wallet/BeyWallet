import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCurrencyInput } from '~/shared/hooks/useCurrencyInput';
import { getCurrencyDisplayMode } from '~/shared/utils/currencyDisplay';

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
let input: ReturnType<typeof useCurrencyInput>;
let tree: ReactTestRenderer;
function Editor({
  primary,
  currency,
  amount,
  price,
}: {
  primary: 'SATS' | 'FIAT';
  currency: string;
  amount: string;
  price?: number;
}) {
  input = useCurrencyInput(primary, currency, amount, price);
  return null;
}
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each(['SATS', 'FIAT'] as const)(
  'overrides saved %s only while None is selected',
  async (primary) => {
    expect(getCurrencyDisplayMode(primary, 'NONE')).toEqual({
      fiatEnabled: false,
      primaryCurrency: 'SATS',
    });
    await act(async () => {
      tree = create(<Editor primary={primary} currency="NONE" amount="12345" />);
    });
    expect(input.inputMode).toBe('SATS');
    expect(input.localInputValue).toBe('12345');
    await act(async () =>
      tree.update(<Editor primary={primary} currency="USD" amount="12345" price={100000} />),
    );
    expect(input.inputMode).toBe(primary);
    expect(input.localInputValue).toBe(primary === 'FIAT' ? '12.34' : '12345');
    await act(async () =>
      tree.update(<Editor primary={primary} currency="NONE" amount="12345" price={100000} />),
    );
    expect(input.inputMode).toBe('SATS');
    expect(input.localInputValue).toBe('12345');
  },
);

it('ignores stale fiat drafts in None mode and waits for a valid quote before restoring FIAT', async () => {
  await act(async () => {
    tree = create(<Editor primary="FIAT" currency="USD" amount="12345" price={100000} />);
  });
  await act(async () => input.setLocalInputValue('12.34'));
  await act(async () => tree.update(<Editor primary="FIAT" currency="NONE" amount="12345" />));
  expect(input.localInputValue).toBe('12345');
  await act(async () => tree.update(<Editor primary="FIAT" currency="EUR" amount="12345" />));
  expect(input.inputMode).toBe('SATS');
  await act(async () =>
    tree.update(<Editor primary="FIAT" currency="EUR" amount="12345" price={200000} />),
  );
  expect(input.inputMode).toBe('FIAT');
  expect(input.localInputValue).toBe('24.69');
});

it('restores two-decimal fiat drafts for small amounts', async () => {
  await act(async () => {
    tree = create(<Editor primary="FIAT" currency="NONE" amount="1" />);
  });
  await act(async () =>
    tree.update(<Editor primary="FIAT" currency="USD" amount="1" price={100000} />),
  );
  expect(input.inputMode).toBe('FIAT');
  expect(input.localInputValue).toBe('0.00');
});

it.each(['USD', 'EUR', 'JPY', 'INR', 'KWD'])(
  'keeps two-decimal numeric drafts for %s',
  async (currency) => {
    await act(async () => {
      tree = create(<Editor primary="FIAT" currency="NONE" amount="1" />);
    });
    await act(async () =>
      tree.update(<Editor primary="FIAT" currency={currency} amount="1" price={32100} />),
    );
    expect(input.localInputValue).toBe('0.00');
    expect(input.localInputValue).not.toContain('<');
  },
);
