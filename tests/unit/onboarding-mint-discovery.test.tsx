import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MintDiscoverySheet } from '~/features/onboarding/MintDiscoverySheet';

jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: any, _ref: any) =>
    require('react').createElement('Sheet', props, props.children, props.footer),
  ),
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/BUI/BUISelectionControl', () => ({
  BUISelectionRow: 'Checkbox',
  BUICheckboxVisual: 'CheckboxVisual',
}));
jest.mock('~/features/explore/components/MintIcon', () => ({ MintIcon: 'MintIcon' }));
jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack', Separator: 'Separator' }));
jest.mock('~/shared/theme/appearance', () => ({ appSpacing: { group: 24 } }));
jest.mock('~/features/mints/hooks/useMintDiscovery', () => ({
  useMintDiscovery: () => ({
    data: [
      { url: 'https://one.test', name: 'One' },
      { url: 'https://two.test', name: 'Two' },
    ],
    isLoading: false,
    isError: false,
  }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('requires selection and acknowledgment before confirming all selected mints', async () => {
  const onConfirm = jest.fn();
  await act(async () => {
    tree = create(<MintDiscoverySheet selected={[]} onConfirm={onConfirm} />);
  });
  const button = () => tree.root.findByType('Button' as any);
  expect(button().props.disabled).toBe(true);
  for (const name of ['One', 'Two']) {
    await act(async () =>
      tree.root
        .findAllByType('Pressable' as any)
        .find((row) => row.props.accessibilityLabel === name)!
        .props.onPress(),
    );
  }
  expect(button().props.disabled).toBe(false);
  await act(async () => button().props.onPress());
  expect(tree.root.findByType('Sheet' as any).props.title).toBe('Trust these mints?');
  expect(tree.root.findAllByType('Pressable' as any)).toHaveLength(0);
  expect(button().props.disabled).toBe(true);
  await act(async () => button().props.onPress());
  expect(onConfirm).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Checkbox' as any).props.onCheckedChange(true));
  await act(async () => button().props.onPress());
  expect(onConfirm).toHaveBeenCalledWith([
    { url: 'https://one.test', name: 'One' },
    { url: 'https://two.test', name: 'Two' },
  ]);
});

it('retains selections on back and requires a fresh acknowledgment after changing them', async () => {
  await act(async () => {
    tree = create(<MintDiscoverySheet selected={[]} onConfirm={jest.fn()} />);
  });
  const button = () => tree.root.findByType('Button' as any);
  const toggle = (name: string) =>
    tree.root
      .findAllByType('Pressable' as any)
      .find((row) => row.props.accessibilityLabel === name)!
      .props.onPress();
  await act(async () => toggle('One'));
  await act(async () => button().props.onPress());
  await act(async () => tree.root.findByType('Checkbox' as any).props.onCheckedChange(true));
  await act(async () => tree.root.findByType('Sheet' as any).props.onNavigate());
  expect(tree.root.findAllByType('Pressable' as any)[0].props.accessibilityState.checked).toBe(
    true,
  );
  await act(async () => toggle('Two'));
  await act(async () => button().props.onPress());
  expect(button().props.disabled).toBe(true);
});
