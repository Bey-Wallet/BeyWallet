import { useSettingsStore, notificationDefaults } from '~/state/settingsStore';
import { initService } from '~/services/wallet';
import { seedService } from '~/services/platform/seedService';

jest.mock('~/services/wallet', () => ({
  initService: { walletExists: jest.fn(), getRepo: jest.fn() },
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: { getMnemonic: jest.fn(), getNostrKeys: jest.fn() },
}));
const values = new Map<string, string>();
const settingsRepository = {
  getSetting: jest.fn(async (key: string) => values.get(key)),
  setSetting: jest.fn(async (key: string, value: string) => {
    values.set(key, value);
  }),
};
beforeEach(() => {
  jest.clearAllMocks();
  settingsRepository.setSetting.mockImplementation(async (key, value) => {
    values.set(key, value);
  });
  useSettingsStore.setState(useSettingsStore.getInitialState());
  values.clear();
  values.set('npub', 'public-test-identity');
  values.set('nsec', 'test-fixture');
  (seedService.getMnemonic as jest.Mock).mockResolvedValue('fixture-not-a-real-seed');
  (seedService.getNostrKeys as jest.Mock).mockResolvedValue({
    npub: 'restored-public-fixture',
    nsec: 'restored-secret-fixture',
  });
  (initService.walletExists as jest.Mock).mockResolvedValue(true);
  (initService.getRepo as jest.Mock).mockReturnValue({ settingsRepository });
});

it('uses the Bitcoin symbol when no display preference has been saved', async () => {
  expect(useSettingsStore.getState().showBitcoinSymbol).toBe(true);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().showBitcoinSymbol).toBe(true);
});

it.each(['true', 'false'])('respects a saved Bitcoin symbol preference of %s', async (saved) => {
  values.set('showBitcoinSymbol', saved);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().showBitcoinSymbol).toBe(saved === 'true');
});

it('retries settings after a slow repository instead of marking defaults initialized', async () => {
  (initService.getRepo as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Not ready');
  });
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().initialized).toBe(false);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState()).toMatchObject({
    initialized: true,
    npub: 'public-test-identity',
  });
});

it('loads identity when onboarding creates a wallet after the first settings check', async () => {
  (initService.walletExists as jest.Mock).mockResolvedValueOnce(false);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().initialized).toBe(false);
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().npub).toBe('public-test-identity');
});

it('restores a missing key cache with existing seed derivation and retains the username', async () => {
  values.delete('npub');
  values.delete('nsec');
  values.set('nip05', 'fixture@bey.cash');
  (seedService.getMnemonic as jest.Mock).mockResolvedValue('fixture-not-a-real-seed');
  (seedService.getNostrKeys as jest.Mock).mockResolvedValue({
    npub: 'restored-public-fixture',
    nsec: 'restored-secret-fixture',
  });
  await useSettingsStore.getState().initialize();
  expect(seedService.getNostrKeys).toHaveBeenCalledWith('fixture-not-a-real-seed');
  expect(useSettingsStore.getState()).toMatchObject({
    npub: 'restored-public-fixture',
    nsec: 'restored-secret-fixture',
    nip05: 'fixture@bey.cash',
  });
  expect(values.get('npub')).toBe('restored-public-fixture');
});

it('keeps privacy settings and existing identity when caching fails, then allows explicit retry', async () => {
  values.delete('nsec');
  values.set('hideBalance', 'true');
  settingsRepository.setSetting.mockRejectedValueOnce(new Error('disk unavailable'));
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState()).toMatchObject({
    initialized: true,
    biometricEnabled: true,
    hideBalance: true,
    npub: 'public-test-identity',
    nsec: null,
  });
  await useSettingsStore.getState().initialize(true);
  expect(useSettingsStore.getState().nsec).toBe('restored-secret-fixture');
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
