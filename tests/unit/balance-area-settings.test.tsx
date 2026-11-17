import { useSettingsStore } from '~/state/settingsStore';

const mockSaved = new Map<string, string>();
jest.mock('~/services/wallet', () => ({
  initService: {
    walletExists: async () => true,
    getRepo: () => ({
      settingsRepository: {
        getSetting: async (key: string) => mockSaved.get(key) ?? null,
        setSetting: async (key: string, value: string) => {
          mockSaved.set(key, value);
        },
      },
    }),
  },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));

it('persists the expanded and collapsed Home states across settings initialization', async () => {
  mockSaved.clear();
  mockSaved.set('npub', 'synthetic-public-key');
  mockSaved.set('nsec', 'synthetic-private-key');
  await useSettingsStore.getState().initialize(true);
  expect(useSettingsStore.getState().homeExpanded).toBe(false);
  for (const expanded of [true, false]) {
    await useSettingsStore.getState().setHomeExpanded(expanded);
    expect(mockSaved.get('homeExpanded')).toBe(String(expanded));
    useSettingsStore.setState({ homeExpanded: !expanded });
    await useSettingsStore.getState().initialize(true);
    expect(useSettingsStore.getState().homeExpanded).toBe(expanded);
  }
});
