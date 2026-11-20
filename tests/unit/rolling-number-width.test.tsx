import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { RollingNumber } from '~/shared/ui/RollingNumber';

jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

let tree: ReactTestRenderer;
const measures = () => tree.root.findAllByProps({ testID: 'rolling-digit-measure' });
const width = (index: number) => StyleSheet.flatten(measures()[index].parent!.props.style).width;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('uses each displayed numeral width instead of the widest numeral for every column', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="18" fontSize={44} />);
  });
  await act(async () => {
    measures()[0].props.onTextLayout({ nativeEvent: { lines: [{ width: 15 }] } });
    measures()[1].props.onTextLayout({ nativeEvent: { lines: [{ width: 27 }] } });
  });
  expect(width(0)).toBe(15);
  expect(width(1)).toBe(27);
  expect(measures()[0].props.accessible).toBe(false);
  expect(measures()[0].props.letterSpacing).toBe(0);
});

it('ignores stale measurements when a digit changes and rejects invalid widths', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="1" fontSize={44} />);
  });
  const staleLayout = measures()[0].props.onTextLayout;
  await act(async () => {
    tree.update(<RollingNumber value="8" fontSize={44} />);
  });
  await act(async () => {
    measures()[0].props.onTextLayout({ nativeEvent: { lines: [{ width: 27 }] } });
    staleLayout({ nativeEvent: { lines: [{ width: 15 }] } });
  });
  expect(width(0)).toBe(27);
  await act(async () => {
    measures()[0].props.onTextLayout({ nativeEvent: { lines: [{ width: NaN }] } });
  });
  expect(width(0)).toBe(27);
});
