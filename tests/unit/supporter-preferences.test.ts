const mockStorage = new Map<string, string>();

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
  },
}));

const loadStore = () =>
  require('~/state/supporterStore')
    .useSupporterStore as typeof import('~/state/supporterStore').useSupporterStore;

beforeEach(() => {
  jest.resetModules();
  mockStorage.clear();
});

it('shows the Home card by default without storing a membership entitlement', () => {
  expect(loadStore().getState().homeCardDismissed).toBe(false);
});

it('keeps Do not show again after the store is recreated', () => {
  loadStore().getState().dismissHomeCard();
  expect(JSON.parse(mockStorage.get('bey-supporter-ui-preferences')!).state).toEqual({
    homeCardDismissed: true,
  });

  jest.resetModules();
  expect(loadStore().getState().homeCardDismissed).toBe(true);
});
