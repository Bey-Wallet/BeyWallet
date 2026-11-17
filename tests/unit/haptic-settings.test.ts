import { useSettingsStore } from '~/state/settingsStore';
const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('~/services/wallet', () => ({
  initService: {
    walletExists: async () => true,
    getRepo: () => ({ settingsRepository: { getSetting: mockGet, setSetting: mockSet } }),
  },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockGet.mockImplementation(async (key) =>
    key === 'npub' || key === 'nsec' ? 'test-only-identity' : null,
  );
  mockSet.mockResolvedValue(undefined);
  useSettingsStore.setState({ initialized: false, hapticsEnabled: true });
});
it.each([
  [null, true],
  ['true', true],
  ['false', false],
  ['invalid', false],
])('hydrates %s as %s', async (stored, expected) => {
  mockGet.mockImplementation(async (key) =>
    key === 'hapticsEnabled'
      ? stored
      : key === 'npub' || key === 'nsec'
        ? 'test-only-identity'
        : null,
  );
  await useSettingsStore.getState().initialize();
  expect(useSettingsStore.getState().initialized).toBe(true);
  expect(useSettingsStore.getState().hapticsEnabled).toBe(expected);
});
it('persists explicit off and reloads it', async () => {
  await useSettingsStore.getState().setHapticsEnabled(false);
  expect(mockSet).toHaveBeenCalledWith('hapticsEnabled', 'false');
  expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
});
it('switches off immediately and remains off if storage rejects the write', async () => {
  mockSet.mockRejectedValue(new Error('Unavailable'));
  const pending = useSettingsStore.getState().setHapticsEnabled(false);
  expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
  await expect(pending).rejects.toThrow('Could not save haptic feedback preference');
  expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
});
it('does not enable feedback until the preference is saved', async () => {
  useSettingsStore.setState({ hapticsEnabled: false });
  mockSet.mockRejectedValue(new Error('Unavailable'));
  await expect(useSettingsStore.getState().setHapticsEnabled(true)).rejects.toThrow();
  expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
});
