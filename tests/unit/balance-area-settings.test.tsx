import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useSettingsStore } from '~/state/settingsStore';
import { BalanceAreaSettingsScreen } from '~/features/settings/BalanceAreaSettingsScreen';

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
jest.mock('@tamagui/lucide-icons', () => ({ Expand: 'Expand' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsDescription: 'Description',
}));
jest.mock('~/features/settings/components/SettingsToggleRow', () => ({
  SettingsToggleRow: 'Toggle',
}));

it('directly controls the saved expanded Home layout from Settings', async () => {
  mockSaved.clear();
  mockSaved.set('npub', 'synthetic-public-key');
  mockSaved.set('nsec', 'synthetic-private-key');
  await useSettingsStore.getState().initialize(true);
  expect(useSettingsStore.getState().homeExpanded).toBe(false);
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(<BalanceAreaSettingsScreen />);
    });
    const toggle = () => tree.root.findByType('Toggle' as any);
    expect(toggle().props.checked).toBe(false);
    expect(toggle().props.title).toBe('Expanded Home');
    await act(async () => toggle().props.save(true));
    expect(toggle().props.checked).toBe(true);
    expect(mockSaved.get('homeExpanded')).toBe('true');
    await act(async () => {
      useSettingsStore.setState({ homeExpanded: false });
      await useSettingsStore.getState().initialize(true);
    });
    expect(toggle().props.checked).toBe(true);
    await act(async () => toggle().props.save(false));
    expect(toggle().props.checked).toBe(false);
    expect(mockSaved.get('homeExpanded')).toBe('false');
  } finally {
    await act(async () => tree?.unmount());
  }
});

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
