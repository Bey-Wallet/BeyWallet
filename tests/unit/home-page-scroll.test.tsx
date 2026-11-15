import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Haptics from 'expo-haptics';
import { useHomePageScroll } from '~/features/home/hooks/useHomePageScroll';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));
function Probe({ enabled }: { enabled: boolean }) {
  return React.createElement('Paging', useHomePageScroll(enabled));
}
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Paging' as any).props;
const event = (y: number) => ({ nativeEvent: { contentOffset: { y } } });
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function render(enabled: boolean) {
  await act(async () => {
    tree = create(<Probe enabled={enabled} />);
  });
  await act(async () => props().onMintLayout({ nativeEvent: { layout: { y: 600 } } }));
}

it('keeps normal Home scrolling free and only enables snapping after expansion', async () => {
  await render(false);
  expect(props().scrollProps.snapToOffsets).toBeUndefined();
  await act(async () => tree.update(<Probe enabled />));
  expect(props().scrollProps).toMatchObject({
    snapToOffsets: [0, 584],
    snapToEnd: false,
    disableIntervalMomentum: true,
    decelerationRate: 'fast',
  });
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
});

it('gives one haptic per settled page change despite duplicate scroll events', async () => {
  await render(true);
  props().scrollProps.onScrollEndDrag(event(200));
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  props().scrollProps.onMomentumScrollEnd(event(584));
  props().scrollProps.onScrollEndDrag(event(584));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  props().scrollProps.onMomentumScrollEnd(event(0));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
});

it('does not vibrate while scrolling a long mint list and disables paging on collapse', async () => {
  await render(true);
  props().scrollProps.onMomentumScrollEnd(event(900));
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  await act(async () => tree.update(<Probe enabled={false} />));
  expect(props().scrollProps.snapToOffsets).toBeUndefined();
  props().scrollProps.onMomentumScrollEnd(event(584));
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
});

it('recalculates snap offsets from the measured mint position', async () => {
  await render(true);
  await act(async () => props().onMintLayout({ nativeEvent: { layout: { y: 480 } } }));
  expect(props().scrollProps.snapToOffsets).toEqual([0, 464]);
});
