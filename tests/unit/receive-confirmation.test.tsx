import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConfirmStage } from '~/features/payments/receive/ConfirmStage';

const mockCheck = jest.fn();
const mockFee = jest.fn(async () => 0);
let mockMints = [{ mintUrl: 'https://mint.example', name: 'Example mint', trusted: true }];
jest.mock('~/services/wallet', () => ({
  proofService: { checkProofStates: (...args: unknown[]) => mockCheck(...args) },
  mintManager: { getFeePpk: (...args: unknown[]) => mockFee(...(args as [])) },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({ decodeToken: () => ({ proofs: [] }) }));
jest.mock('~/state/walletStore', () => ({ useWalletStore: () => ({ mints: mockMints }) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (selector: (state: { npub: string }) => unknown) =>
    selector({ npub: 'npub-me' }),
}));
jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('@tamagui/lucide-icons', () => ({ RefreshCw: 'RefreshCw' }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, footer, children }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/FirstUseGuidance', () => ({ FirstUseGuidance: 'FirstUseGuidance' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));

const props = {
  token: 'first-token',
  tokenInfo: { mint: 'https://mint.example', amount: 100, proofCount: 3 },
  onConfirm: jest.fn(),
  onReceiveLater: jest.fn(),
  onBack: jest.fn(),
};
let tree: ReactTestRenderer;
const status = () => tree.root.findByProps({ label: 'Status' });
const refresh = () => status().props.rightContent;
const receive = () => tree.root.findByProps({ emphasis: 'primary' });

async function render() {
  await act(async () => {
    tree = create(<ConfirmStage {...props} />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMints = [{ mintUrl: 'https://mint.example', name: 'Example mint', trusted: true }];
  mockCheck.mockResolvedValue([{ state: 'UNSPENT' }]);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('shows minimal mint and status rows without token or proof details', async () => {
  await render();
  expect(tree.root.findAllByType('Row' as any).map((row) => row.props.label)).toEqual([
    'Mint',
    'Status',
  ]);
  expect(status().props.value).toBe('Unspent');
  expect(receive().props.disabled).toBeFalsy();
  expect(tree.root.findByType('Amount' as any).props.amount).toBe(100);
  expect(tree.root.findByProps({ label: 'Mint' }).props.isCopyable).toBeUndefined();
  expect(tree.root.findByProps({ label: 'Mint' }).props.onCopy).toBeUndefined();
});

it('shows a copyable received memo while the mint remains read-only', async () => {
  await act(async () => {
    tree = create(<ConfirmStage {...props} tokenInfo={{ ...props.tokenInfo, memo: 'Lunch ☕' }} />);
  });
  expect(tree.root.findByProps({ label: 'Note' }).props).toMatchObject({
    value: 'Lunch ☕',
    copyValue: 'Lunch ☕',
    isCopyable: true,
  });
  expect(tree.root.findByProps({ label: 'Mint' }).props.isCopyable).toBeUndefined();
});

it('refreshes status and blocks receiving until the check finishes', async () => {
  await render();
  let resolve!: (states: unknown[]) => void;
  mockCheck.mockReturnValueOnce(new Promise((done) => (resolve = done)));
  await act(async () => refresh().props.onPress());
  expect(mockCheck).toHaveBeenCalledTimes(2);
  expect(mockCheck).toHaveBeenLastCalledWith('first-token');
  expect(status().props.value).toBe('Checking…');
  expect(refresh().props.disabled).toBe(true);
  expect(receive().props.disabled).toBe(true);
  await act(async () => refresh().props.onPress());
  expect(mockCheck).toHaveBeenCalledTimes(2);
  await act(async () => resolve([{ state: 'SPENT' }]));
  expect(status().props.value).toBe('Already spent');
  expect(receive().props.disabled).toBe(true);
});

it.each([[], null, new Error('Offline')])(
  'keeps an unavailable status unverified (%s)',
  async (result) => {
    if (result instanceof Error) mockCheck.mockRejectedValueOnce(result);
    else mockCheck.mockResolvedValueOnce(result);
    await render();
    expect(status().props.value).toBe('Unverified');
    expect(refresh().props.disabled).toBeFalsy();
  },
);

it('ignores a stale check after the token changes', async () => {
  let resolve!: (states: unknown[]) => void;
  mockCheck.mockReturnValueOnce(new Promise((done) => (resolve = done)));
  await render();
  await act(async () => {
    tree.update(<ConfirmStage {...props} token="replacement-token" />);
  });
  expect(status().props.value).toBe('Unspent');
  await act(async () => resolve([{ state: 'SPENT' }]));
  expect(status().props.value).toBe('Unspent');
});

it.each([
  [[{ state: 'PENDING' }], 'Pending'],
  [[{ state: 'UNRECOGNIZED' }], 'Unverified'],
  [[{ state: 'PENDING' }, { state: 'SPENT' }], 'Already spent'],
])('shows the returned status accurately (%j)', async (states, expected) => {
  mockCheck.mockResolvedValueOnce(states);
  await render();
  expect(status().props.value).toBe(expected);
});

it('retains explicit trust consent and recipient lock information', async () => {
  mockMints = [];
  await render();
  await act(async () => {
    tree.update(
      <ConfirmStage {...props} tokenInfo={{ ...props.tokenInfo, p2pkNpub: 'npub-me' }} />,
    );
  });
  expect(receive().props.children).toBe('Trust & Receive');
  expect(tree.root.findByProps({ label: 'Locked To' }).props.value).toBe('You (Safe)');
  expect(tree.root.findByType('Text' as any).props.children).toBe(
    'Receiving will add and trust this mint.',
  );
});

it('offers only save-and-claim-later offline without checking the mint or trusting it', async () => {
  mockMints = [];
  await act(async () => {
    tree = create(<ConfirmStage {...props} offline />);
  });
  expect(mockCheck).not.toHaveBeenCalled();
  expect(mockFee).not.toHaveBeenCalled();
  expect(receive().props.children).toBe('Save & claim later');
  expect(receive().props.disabled).toBeFalsy();
  expect(status().props.value).toBe('Unverified · offline');
  expect(refresh().props.disabled).toBe(true);
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(1);
  await act(async () => receive().props.onPress());
  expect(props.onReceiveLater).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('checks proof state again when connectivity returns', async () => {
  await act(async () => {
    tree = create(<ConfirmStage {...props} offline />);
  });
  await act(async () => tree.update(<ConfirmStage {...props} offline={false} />));
  expect(mockCheck).toHaveBeenCalledWith('first-token');
  expect(status().props.value).toBe('Unspent');
  expect(receive().props.children).toBe('Receive');
});
