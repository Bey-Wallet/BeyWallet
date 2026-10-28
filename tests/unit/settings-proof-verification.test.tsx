jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: jest.fn(), hide: jest.fn() }),
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VerifyProofsSettingsScreen } from '~/features/settings/WalletSettingsScreens';

const mockVerify = jest.fn();
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { verifyDleqProofs: (...args: unknown[]) => mockVerify(...args) },
}));
jest.mock('~/services/wallet/consolidationService', () => ({ consolidationService: {} }));
jest.mock('~/services/platform/biometricService', () => ({ biometricService: {} }));
jest.mock('~/features/settings/ProofManagerScreen', () => ({
  __esModule: true,
  default: 'Manager',
}));
jest.mock('~/features/settings/hooks/useProtectedValue', () => ({ useProtectedValue: jest.fn() }));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => true }));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: jest.fn() }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) =>
    select({
      activeMintUrl: 'https://mint.example',
      mints: [{ mintUrl: 'https://mint.example', name: 'Mint' }],
    }),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@tamagui/lucide-icons', () => ({ ShieldCheck: 'Shield', Landmark: 'Mint' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsDescription: 'Description',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsMessage: 'Message',
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

it.each([
  {
    statuses: ['verified', 'verified'],
    counts: '2 verified, 0 invalid, 0 unverifiable',
    error: false,
  },
  { statuses: ['invalid'], counts: '0 verified, 1 invalid, 0 unverifiable', error: true },
  { statuses: ['unverifiable'], counts: '0 verified, 0 invalid, 1 unverifiable', error: false },
  {
    statuses: ['verified', 'invalid', 'unverifiable'],
    counts: '1 verified, 1 invalid, 1 unverifiable',
    error: true,
  },
])('shows separate DLEQ counts for $statuses', async ({ statuses, counts, error }) => {
  mockVerify.mockResolvedValue(
    statuses.map((status) => ({
      status,
      valid: status === 'verified',
      secret: 'never-display-secret',
      amount: 1,
      reason: 'never-display-raw-data',
    })),
  );
  await act(async () => {
    tree = create(<VerifyProofsSettingsScreen />);
  });
  const button = tree.root.findByType('AppButton' as any);
  expect(button.props.disabled).toBe(false);
  await act(async () => button.props.onPress());
  const message = tree.root.findByType('Message' as any);
  expect(message.props.children).toContain(`${statuses.length} proofs with DLEQ: ${counts}`);
  expect(message.props.error).toBe(error);
  expect(JSON.stringify(tree.toJSON())).not.toMatch(/never-display/);
  expect(mockVerify).toHaveBeenCalledWith('https://mint.example');
});

it('explains when no proofs have DLEQ data without claiming verification success', async () => {
  mockVerify.mockResolvedValue([]);
  await act(async () => {
    tree = create(<VerifyProofsSettingsScreen />);
  });
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(tree.root.findByType('Message' as any).props.children).toContain('No DLEQ data');
});
