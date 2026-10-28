import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppToastViewport } from '~/shared/ui/AppToastViewport';
import { getToastLayout } from '~/shared/ui/toastLayout';

let mockInsets = { top: 59, left: 0, right: 0, bottom: 34 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('@tamagui/toast', () => ({ ToastViewport: 'ToastViewport' }));

it('keeps notifications below the status bar and inside cutouts after rotation', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppToastViewport />);
  });
  let viewport = tree.root.findByType('ToastViewport' as any);
  expect(viewport.props.top).toBeGreaterThan(mockInsets.top);
  expect(viewport.props).toMatchObject({ top: 71, left: 16, right: 16 });
  mockInsets = { top: 0, left: 59, right: 0, bottom: 21 };
  await act(async () => tree.update(<AppToastViewport />));
  viewport = tree.root.findByType('ToastViewport' as any);
  expect(viewport.props).toMatchObject({ top: 12, left: 75, right: 75 });
  await act(async () => tree.unmount());
});

it.each([320, 390, 844])(
  'keeps the card centered and inside both safe edges at width %i',
  (width) => {
    const insets = { top: 0, left: 59, right: 0, bottom: 21 };
    const layout = getToastLayout(width, insets);
    const left = layout.gutter + (width - 2 * layout.gutter - layout.width) / 2;
    const right = left + layout.width;
    expect((left + right) / 2).toBe(width / 2);
    expect(left).toBeGreaterThanOrEqual(insets.left + 16);
    expect(right).toBeLessThanOrEqual(width - insets.right - 16);
    expect(layout.width).toBeLessThanOrEqual(360);
  },
);
