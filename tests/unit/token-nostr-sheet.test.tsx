import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TokenNostrSheet } from '~/features/payments/send/TokenNostrSheet';

const mockSend = jest.fn();
const mockRetry = jest.fn();
const mockPreventRemove = jest.fn();
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({
  BUISheet: 'Sheet',
  BUISheetInput: 'Input',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/services/wallet/tokenUtils', () => ({
  cleanToken: (value: string) => value.replace(/^cashu:/, ''),
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: {
    sendChat: (...args: unknown[]) => mockSend(...args),
    retryChat: (...args: unknown[]) => mockRetry(...args),
  },
}));

let tree: ReactTestRenderer;
const busy = jest.fn();
beforeEach(() => jest.clearAllMocks());
afterEach(async () => act(async () => tree?.unmount()));
async function render(disabled = false) {
  await act(async () => {
    tree = create(
      <TokenNostrSheet
        token="cashu:cashuBsynthetic"
        disabled={disabled}
        appearance="dark"
        onBusyChange={busy}
      />,
    );
  });
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('  npub-recipient  '),
  );
}
const send = () => tree.root.findByType('Button' as any).props.onPress();

it('sends the existing token once and prevents dismissal during relay delivery', async () => {
  let finish!: () => void;
  mockSend.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await render();
  let pending!: Promise<void>;
  await act(async () => {
    pending = send();
    void send();
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith(
    'npub-recipient',
    'cashu:cashuBsynthetic',
    expect.any(Function),
  );
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
  expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => {
    finish();
    await pending;
  });
  expect(busy.mock.calls).toEqual([[true], [false]]);
  expect(JSON.stringify(tree.toJSON())).toContain('does not confirm the recipient has claimed it');
});

it('retries the persisted delivery after failure without creating another payment message', async () => {
  const queued = { id: 'saved-message' };
  mockSend.mockImplementation(async (_recipient, _content, onQueued) => {
    onQueued(queued);
    throw new Error('Relay unavailable');
  });
  mockRetry.mockResolvedValue(undefined);
  await render();
  await act(async () => send());
  expect(tree.root.findByType('Input' as any).props.editable).toBe(false);
  await act(async () => send());
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockRetry).toHaveBeenCalledWith(queued);
});

it('does not send while the owning payment is unavailable', async () => {
  await render(true);
  await act(async () => send());
  expect(mockSend).not.toHaveBeenCalled();
});
