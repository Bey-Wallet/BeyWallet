import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { hapticService } from '~/services/platform/hapticService';
import { useHomePageScroll } from '~/features/home/hooks/useHomePageScroll';

jest.mock('~/services/platform/hapticService', () => ({
  hapticService: { selection: jest.fn(), epoch: jest.fn(() => 1) },
}));
function Probe({ enabled }: { enabled: boolean }) {
  return React.createElement('Paging', useHomePageScroll(enabled));
}
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Paging' as any).props;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hapticService.epoch).mockReturnValue(1);
});
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
  expect(hapticService.selection).not.toHaveBeenCalled();
});

const scroll = (y: number, velocity = 0) => ({
  nativeEvent: { contentOffset: { y }, velocity: { y: velocity } },
});

it('ticks once when a user swipe settles on the other section in either direction', async () => {
  await render(true);
  props().scrollProps.onScrollBeginDrag(scroll(0));
  props().scrollProps.onScrollEndDrag(scroll(300, 1));
  expect(hapticService.selection).not.toHaveBeenCalled();
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  expect(hapticService.selection).toHaveBeenCalledTimes(1);
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  expect(hapticService.selection).toHaveBeenCalledTimes(1);
  props().scrollProps.onScrollBeginDrag(scroll(584));
  props().scrollProps.onScrollEndDrag(scroll(0));
  props().scrollProps.onMomentumScrollEnd(scroll(0));
  expect(hapticService.selection).toHaveBeenCalledTimes(2);
});

it('does not vibrate while scrolling a long mint list and disables paging on collapse', async () => {
  await render(true);
  props().scrollProps.onScrollBeginDrag(scroll(584));
  props().scrollProps.onMomentumScrollEnd(scroll(900));
  props().scrollProps.onScrollBeginDrag(scroll(900));
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  props().scrollProps.onMomentumScrollEnd(scroll(0));
  expect(hapticService.selection).not.toHaveBeenCalled();
  await act(async () => tree.update(<Probe enabled={false} />));
  expect(props().scrollProps.snapToOffsets).toBeUndefined();
  expect(props().scrollProps.onScrollBeginDrag).toBeUndefined();
  expect(hapticService.selection).not.toHaveBeenCalled();
});

it('keeps snap-back, layout changes and programmatic scrolling quiet', async () => {
  await render(true);
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  props().scrollProps.onScrollBeginDrag(scroll(0));
  props().scrollProps.onScrollEndDrag(scroll(200));
  props().scrollProps.onMomentumScrollEnd(scroll(0));
  props().scrollProps.onScrollBeginDrag(scroll(0));
  await act(async () => props().onMintLayout({ nativeEvent: { layout: { y: 500 } } }));
  props().scrollProps.onMomentumScrollEnd(scroll(484));
  expect(hapticService.selection).not.toHaveBeenCalled();
});

it('does not replay a swipe after its feedback eligibility changes', async () => {
  await render(true);
  props().scrollProps.onScrollBeginDrag(scroll(0));
  jest.mocked(hapticService.epoch).mockReturnValue(2);
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  expect(hapticService.selection).not.toHaveBeenCalled();
  jest.mocked(hapticService.epoch).mockReturnValue(undefined);
  props().scrollProps.onScrollBeginDrag(scroll(0));
  jest.mocked(hapticService.epoch).mockReturnValue(3);
  props().scrollProps.onMomentumScrollEnd(scroll(584));
  expect(hapticService.selection).not.toHaveBeenCalled();
});

it('recalculates snap offsets from the measured mint position', async () => {
  await render(true);
  await act(async () => props().onMintLayout({ nativeEvent: { layout: { y: 480 } } }));
  expect(props().scrollProps.snapToOffsets).toEqual([0, 464]);
});
