import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PublicKeySettingsScreen } from '~/features/settings/IdentityScreens';

const mockInitialize = jest.fn();
const mockState = { npub: null as string | null, initialize: mockInitialize };
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign((select: any) => select(mockState), {
    getState: () => mockState,
  }),
}));
jest.mock('~/state/nostrReceiveSettingsStore', () => ({ useNostrReceiveSettingsStore: jest.fn() }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({ Copy: 'Copy', EyeOff: 'EyeOff' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
}));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/features/settings/hooks/useProtectedValue', () => ({ useProtectedValue: jest.fn() }));
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockState.npub = null;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('lets the user retry a missing identity and then copy the restored public key', async () => {
  mockInitialize.mockImplementation(async () => {
    mockState.npub = 'public-fixture';
  });
  await act(async () => {
    tree = create(<PublicKeySettingsScreen />);
  });
  const retry = tree.root
    .findAllByType('AppButton' as any)
    .find((button) => button.props.children === 'Retry loading public key')!;
  await act(async () => retry.props.onPress());
  expect(mockInitialize).toHaveBeenCalledWith(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Public key restored.');
  const copy = tree.root.findByType('AppButton' as any);
  expect(copy.props.disabled).toBe(false);
});

it('shows a safe retryable error when the identity remains unavailable', async () => {
  mockInitialize.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<PublicKeySettingsScreen />);
  });
  await act(async () => tree.root.findAllByType('AppButton' as any)[0].props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain(
    'The operation could not be completed. Please try again.',
  );
  expect(tree.root.findAllByType('AppButton' as any)[1].props.disabled).toBe(true);
});
