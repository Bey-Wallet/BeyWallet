import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PermissionsStep } from '~/features/onboarding/PermissionsStep';
import { biometricService } from '~/services/platform/biometricService';

const mockPresent = jest.fn();
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: () => mockPresent(props.title),
      dismiss: jest.fn(),
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));
jest.mock('~/features/onboarding/MintDiscoverySheet', () => ({
  MintDiscoverySheet: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: () => mockPresent('Discover mints'),
      dismiss: jest.fn(),
    }));
    return require('react').createElement('MintDiscovery', props);
  }),
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['YStack', 'XStack', 'Text', 'H1', 'View', 'Separator', 'ScrollView'].map((name) => [
      name,
      name,
    ]),
  ),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'ChevronRight',
      'Fingerprint',
      'Check',
      'Circle',
      'AlertCircle',
      'WifiOff',
      'User',
      'Landmark',
    ].map((name) => [name, name]),
  ),
);
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: ({ label, ...props }: any) =>
    require('react').createElement(
      'Row',
      { ...props, label, ...(props.onPress ? { accessibilityLabel: label } : {}) },
      props.rightContent,
    ),
}));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/Blockies', () => ({ __esModule: true, default: 'Blockies' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: async () => false },
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: jest.fn(async () => true) },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ setBiometricEnabled: jest.fn() }) },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

let tree: ReactTestRenderer;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});

async function renderStep(onComplete: jest.Mock) {
  await act(async () => {
    tree = create(
      <PermissionsStep initialUsername="test-user" npub="test-npub" onComplete={onComplete} />,
    );
  });
}

function button(label: string) {
  return tree.root.findAllByType('Button' as any).find((node) => node.props.children === label)!;
}

it('finishes online without mints while retaining the biometric prompt', async () => {
  const onComplete = jest.fn();
  await renderStep(onComplete);
  await act(async () => button('Finish & Open Wallet').props.onPress());
  expect(mockPresent.mock.calls).toEqual([['Biometric security']]);
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => button('Skip & Finish').props.onPress());
  expect(onComplete).toHaveBeenCalledWith('test-user', false, false, []);
});

it('finishes without mints after biometrics have been enabled', async () => {
  const onComplete = jest.fn();
  await renderStep(onComplete);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Biometric security' }).props.onCheckedChange(true),
  );
  expect(biometricService.authenticateAsync).toHaveBeenCalledTimes(1);
  await act(async () => button('Finish & Open Wallet').props.onPress());
  expect(mockPresent).not.toHaveBeenCalled();
  expect(onComplete).toHaveBeenCalledWith('test-user', true, false, []);
});

it('keeps mint discovery opt-in and passes confirmed mints on finish', async () => {
  const onComplete = jest.fn();
  await renderStep(onComplete);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Discover mints' }).props.onPress(),
  );
  expect(mockPresent.mock.calls).toEqual([['Discover mints']]);
  await act(async () =>
    tree.root.findByType('MintDiscovery' as any).props.onConfirm([{ url: 'https://mint.test' }]),
  );
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => button('Finish & Open Wallet').props.onPress());
  await act(async () => button('Skip & Finish').props.onPress());
  expect(onComplete).toHaveBeenCalledWith('test-user', false, false, ['https://mint.test']);
});

it('replaces profile controls with actual step progress and retains choices for retry', async () => {
  const onComplete = jest.fn();
  await renderStep(onComplete);
  await act(async () =>
    tree.root.findByType('MintDiscovery' as any).props.onConfirm([{ url: 'https://mint.test' }]),
  );
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Claim @bey.cash username' })
      .props.onCheckedChange(false),
  );
  const progress = [
    { id: 'wallet', label: 'Create wallet', status: 'done' as const },
    { id: 'mint-0', label: 'Connect mint.test', status: 'running' as const },
    { id: 'finish', label: 'Open wallet', status: 'pending' as const },
  ];
  await act(async () =>
    tree.update(
      <PermissionsStep
        initialUsername="test-user"
        npub="test-npub"
        onComplete={onComplete}
        isFinishing
        setupProgress={progress}
      />,
    ),
  );
  expect(tree.root.findAllByType('Switch' as any)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Row' as any)
      .filter((row) => row.props.rightContent.type === 'Spinner'),
  ).toHaveLength(1);
  expect(tree.root.findAllByType('Row' as any).map((row) => row.props.label)).toEqual([
    'Create wallet',
    'Connect mint.test',
    'Open wallet',
  ]);
  expect(button('Retry setup')).toBeUndefined();
  await act(async () =>
    tree.update(
      <PermissionsStep
        initialUsername="test-user"
        npub="test-npub"
        onComplete={onComplete}
        setupProgress={progress.map((step) =>
          step.id === 'mint-0' ? { ...step, status: 'error' } : step,
        )}
      />,
    ),
  );
  expect(
    tree.root
      .findAllByType('Row' as any)
      .filter((row) => row.props.rightContent.type === 'Spinner'),
  ).toHaveLength(0);
  await act(async () => button('Retry setup').props.onPress());
  expect(onComplete).toHaveBeenCalledWith('test-user', false, true, ['https://mint.test']);
});

it('offers skipping only after local setup succeeds and optional setup fails', async () => {
  const onComplete = jest.fn();
  await act(async () => {
    tree = create(
      <PermissionsStep
        initialUsername="test-user"
        npub="test-npub"
        onComplete={onComplete}
        canSkipOptional
        setupProgress={[{ id: 'mint-0', label: 'Connect mint', status: 'error' }]}
      />,
    );
  });
  await act(async () => button('Skip & Open Wallet').props.onPress());
  expect(onComplete).toHaveBeenCalledWith('test-user', false, true, []);
  await act(async () => {
    tree.update(
      <PermissionsStep
        initialUsername="test-user"
        npub="test-npub"
        onComplete={onComplete}
        setupProgress={[{ id: 'wallet', label: 'Create wallet', status: 'error' }]}
      />,
    );
  });
  expect(button('Skip & Open Wallet')).toBeUndefined();
});
