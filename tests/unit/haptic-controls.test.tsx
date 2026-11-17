import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { hapticService } from '~/services/platform/hapticService';

jest.mock('~/services/platform/hapticService', () => ({ hapticService: { keypad: jest.fn() } }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('tamagui', () => ({ YStack: 'YStack', XStack: 'XStack', Text: 'Text', View: 'View' }));
jest.mock('@tamagui/lucide-icons', () => ({ Delete: 'Delete' }));
let tree: ReactTestRenderer;
const change = jest.fn();
const confirm = jest.fn();
async function render(value = '0', isLoading = false, allowDecimal = false) {
  await act(async () => {
    tree = create(
      <NumericKeypad
        value={value}
        isLoading={isLoading}
        onValueChange={change}
        onConfirm={confirm}
        confirmLabel="Continue"
        allowDecimal={allowDecimal}
      />,
    );
  });
}
const digit = (text: string) =>
  tree.root
    .findAllByType('Pressable' as any)
    .find((node) =>
      node.findAllByType('Text' as any).some((child) => child.props.children === text),
    )!;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it('ticks only for changed digits and meaningful backspace, never confirmation', async () => {
  await render();
  digit('0').props.onPress();
  tree.root.findByType('IconButton' as any).props.onPress();
  expect(hapticService.keypad).not.toHaveBeenCalled();
  digit('1').props.onPress();
  expect(change).toHaveBeenLastCalledWith('1');
  expect(hapticService.keypad).toHaveBeenCalledTimes(1);
  await act(async () =>
    tree.update(
      <NumericKeypad
        value="1"
        onValueChange={change}
        onConfirm={confirm}
        confirmLabel="Continue"
      />,
    ),
  );
  tree.root.findByType('Button' as any).props.onPress();
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(hapticService.keypad).toHaveBeenCalledTimes(1);
});
it('keeps disabled input silent and preserves its value', async () => {
  await render('12', true);
  digit('3').props.onPress();
  tree.root.findByType('IconButton' as any).props.onPress();
  tree.root.findByType('Button' as any).props.onPress();
  expect(change).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(hapticService.keypad).not.toHaveBeenCalled();
});
it('uses the same light keypad intent for deletion', async () => {
  await render('12');
  tree.root.findByType('IconButton' as any).props.onPress();
  expect(change).toHaveBeenCalledWith('1');
  expect(hapticService.keypad).toHaveBeenCalledTimes(1);
});

it('rejects a repeated decimal point without changing the amount or ticking', async () => {
  await render('1.2', false, true);
  digit('.').props.onPress();
  expect(change).not.toHaveBeenCalled();
  expect(hapticService.keypad).not.toHaveBeenCalled();
});
