import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
  Stack: {
    Screen: ({ options }: any) => (
      <>
        {options.headerLeft()}
        {options.headerRight?.()}
      </>
    ),
  },
}));
jest.mock('@tamagui/lucide-icons', () => ({ ArrowLeft: 'ArrowLeft', X: 'X' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/useScreenHeaderOptions', () => ({ useScreenHeaderOptions: () => ({}) }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function render(props: React.ComponentProps<typeof PaymentFlowHeader>) {
  await act(async () => {
    tree = create(<PaymentFlowHeader {...props} />);
  });
}
const button = () => tree.root.findByType('IconButton' as any);

it('switches between close and back as payment stages change and retains the custom callback', async () => {
  const onBack = jest.fn();
  await render({ title: 'Receipt', navigationAction: 'close', onBack });
  expect(button().props).toMatchObject({ accessibilityLabel: 'Close', icon: 'X', iconSize: 22 });
  button().props.onPress();
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(mockBack).not.toHaveBeenCalled();
  await act(async () =>
    tree.update(<PaymentFlowHeader title="Confirm" onBack={onBack} disabled />),
  );
  expect(button().props).toMatchObject({
    accessibilityLabel: 'Back',
    icon: 'ArrowLeft',
    disabled: true,
  });
  await act(async () =>
    tree.update(<PaymentFlowHeader title="Receive" navigationAction="close" />),
  );
  expect(button().props.accessibilityLabel).toBe('Close');
  expect(button().props.disabled).toBeUndefined();
});

it.each(['back', 'close'] as const)(
  'keeps router back and direct-entry fallback for %s',
  async (navigationAction) => {
    await render({ title: 'Payment', navigationAction });
    button().props.onPress();
    expect(mockBack).toHaveBeenCalledTimes(1);
    mockCanGoBack = false;
    button().props.onPress();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  },
);

it('retains screen-specific header actions', async () => {
  await render({ title: 'Payment', headerRight: () => <>{'Details'}</> });
  expect(JSON.stringify(tree.toJSON())).toContain('Details');
});
