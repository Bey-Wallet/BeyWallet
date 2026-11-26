import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConsentStep } from '~/features/onboarding/ConsentStep';

const mockOpen = jest.fn();
jest.mock('tamagui', () => ({ ScrollView: 'ScrollView', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
}));
jest.mock('~/shared/ui/BUI/BUIHeader', () => ({ BUIHeader: 'Header' }));
jest.mock('~/shared/ui/BUI/BUISelectionControl', () => ({ BUISelectionRow: 'Checkbox' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ openExternal: mockOpen }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

it('explains ecash custody, mint trust and recovery limits without promising sole control of Bitcoin', async () => {
  await act(async () => {
    tree = create(<ConsentStep onBack={jest.fn()} onComplete={jest.fn()} />);
  });
  const text = tree.root
    .findAllByType('Text' as any)
    .map((node) => node.props.children)
    .join(' ');
  expect(text).toContain('You hold the ecash');
  expect(text).toContain('Your mint holds the Bitcoin');
  expect(text).toContain('refuses redemption');
  expect(text).toContain('mint support and availability');
  expect(text).toContain('may not restore every token');
  expect(text).toContain('Backups cannot recover funds from a failed mint');
  expect(text).toContain('Avoid storing large balances');
  expect(text).not.toContain('Only you control your funds');
});

it('requires explicit acknowledgment and blocks continuation and back while busy', async () => {
  const complete = jest.fn();
  const back = jest.fn();
  await act(async () => {
    tree = create(<ConsentStep onBack={back} onComplete={complete} />);
  });
  const button = () => tree.root.findByType('Button' as any);
  expect(button().props.disabled).toBe(true);
  await act(async () => button().props.onPress());
  expect(complete).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Checkbox' as any).props.onCheckedChange(true));
  expect(button().props.disabled).toBe(false);
  await act(async () => button().props.onPress());
  expect(complete).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<ConsentStep onBack={back} onComplete={complete} isBusy />));
  expect(button().props.disabled).toBe(true);
  expect(tree.root.findByType('Checkbox' as any).props.disabled).toBe(true);
  await act(async () => {
    button().props.onPress();
    tree.root.findByType('Header' as any).props.onNavigate();
  });
  expect(complete).toHaveBeenCalledTimes(1);
  expect(back).not.toHaveBeenCalled();
});
