import { useSettingsStore, notificationDefaults } from '~/state/settingsStore';
import { initService } from '~/services/wallet';

jest.mock('~/services/wallet', () => ({
  initService: { walletExists: jest.fn(), getRepo: jest.fn() },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
const values = new Map<string, string>();
const settingsRepository = {
  getSetting: jest.fn(async (key: string) => values.get(key)),
  setSetting: jest.fn(async (key: string, value: string) => {
    values.set(key, value);
  }),
};
beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState(useSettingsStore.getInitialState());
  values.clear();
  values.set('npub', 'public-test-identity');
  values.set('nsec', 'test-fixture');
  (initService.walletExists as jest.Mock).mockResolvedValue(true);
  (initService.getRepo as jest.Mock).mockReturnValue({ settingsRepository });
});

it('preserves the existing disabled preference while new privacy controls default to private', async () => {
  values.set('notificationsEnabled', 'false');
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState()).toMatchObject({
    notificationsEnabled: false,
    notificationPreferences: notificationDefaults,
  });
});

it('defaults new wallets and malformed old preferences to private details', async () => {
  values.set('notificationPreferences', '{invalid');
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().notificationPreferences.details).toBe(false);
  useSettingsStore.setState(useSettingsStore.getInitialState());
  (initService.walletExists as jest.Mock).mockResolvedValue(false);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().notificationPreferences.details).toBe(false);
});

it('persists opt-in details and keeps the last saved value on a save failure', async () => {
  await useSettingsStore.getState().setNotificationPreference('details', true);
  expect(JSON.parse(values.get('notificationPreferences')!).details).toBe(true);
  settingsRepository.setSetting.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(
    useSettingsStore.getState().setNotificationPreference('details', false),
  ).rejects.toThrow();
  expect(useSettingsStore.getState().notificationPreferences.details).toBe(true);
});
