import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { interactionToastOptions } from '~/services/feedback/interactionPresentation';

const mockShow = jest.fn();
const mockController = { show: mockShow, hide: jest.fn() };
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockController }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
let api!: ReturnType<typeof useAppToast>;
let tree: ReactTestRenderer;
function Probe() {
  api = useAppToast();
  return null;
}
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each([
  'copiedToClipboard',
  'invoiceCopied',
  'publicKeyCopied',
  'ecashCopied',
  'mintNameUpdated',
  'requestSent',
] as const)('uses one second for the explicit %s confirmation', (key) => {
  expect(interactionToastOptions(interactionCopy[key]).duration).toBe(1000);
});

it('keeps errors readable and shows secondary text only when explicitly essential', () => {
  expect(interactionToastOptions(interactionCopy.copyFailed)).toMatchObject({
    kind: 'error',
    duration: 4000,
    message: undefined,
  });
  expect(interactionToastOptions(interactionCopy.usernameProfilePending).message).toBeUndefined();
  expect(
    interactionToastOptions(interactionCopy.couldNotConfirmReclaimCheckHistoryBefore),
  ).toMatchObject({
    kind: 'warning',
    duration: 5000,
    message: 'Check History before retrying.',
    customData: { essentialDescription: true },
  });
});

it('waits for the native clipboard before showing one short success, without copied contents', async () => {
  let complete!: () => void;
  (Clipboard.setStringAsync as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => {
    tree = create(<Probe />);
  });
  const pending = api.copy('fixture-private-content');
  expect(mockShow).not.toHaveBeenCalled();
  complete();
  expect(await pending).toBe(true);
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(mockShow).toHaveBeenCalledWith(
    'Copied',
    expect.objectContaining({ kind: 'success', duration: 1000 }),
  );
  expect(JSON.stringify(mockShow.mock.calls)).not.toContain('fixture-private-content');
});

it('reports a failed copy once with safe copy and allows an explicit retry', async () => {
  (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
    new Error('private native diagnostic'),
  );
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(await api.copy('fixture-private-content')).toBe(false);
  expect(mockShow).toHaveBeenCalledWith(
    'Could not copy',
    expect.objectContaining({ kind: 'error', duration: 4000 }),
  );
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(undefined);
  expect(await api.copy('fixture-private-content')).toBe(true);
  expect(mockShow).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(mockShow.mock.calls)).not.toContain('private native diagnostic');
});

it('treats a web clipboard false result as failure rather than a copied confirmation', async () => {
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(false);
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(await api.copy('fixture')).toBe(false);
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(mockShow).toHaveBeenCalledWith(
    'Could not copy',
    expect.objectContaining({ kind: 'error' }),
  );
});
