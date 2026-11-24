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

it('preserves the existing tracking of small inline balances', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="18" fontSize={14} />);
  });
  expect(StyleSheet.flatten(measures()[0].parent!.props.style).marginRight).toBeCloseTo(
    (-0.55 * 14) / 25,
  );
});

it('defaults to compact proportional cells and bounds overly tight spacing', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="18" fontSize={44} />);
  });
  const margin = () => StyleSheet.flatten(measures()[0].parent!.props.style).marginRight;
  const compact = margin();
  expect(compact).toBeLessThan(0);
  expect(measures()[0].props.fontVariant).toEqual(['tabular-nums']);
  await act(async () => {
    tree.update(<RollingNumber value="18" fontSize={44} letterSpacing={-1.4} />);
  });
  expect(margin()).toBeCloseTo(-1.4);
  await act(async () => {
    tree.update(<RollingNumber value="18" fontSize={44} letterSpacing={-2.8} />);
  });
  expect(margin()).toBeCloseTo(-2.8);
  await act(async () => {
    tree.update(<RollingNumber value="18" fontSize={44} letterSpacing={-20} />);
  });
  expect(margin()).toBeCloseTo(-2.8);
  await act(async () => {
    tree.update(<RollingNumber value="18" fontSize={44} letterSpacing={0} />);
  });
  expect(margin()).toBe(0);
});

it.each([
  ['$12.34', '$', undefined],
  ['₹1,234.56', '₹', undefined],
  ['12,34 €', undefined, '€'],
  ['12.34 CHF', undefined, 'CHF'],
])('adds a layout gap to %s without changing digit tracking', async (value, leading, trailing) => {
  await act(async () => {
    tree = create(
      <RollingNumber
        value={value}
        fontSize={44}
        fontWeight={500}
        letterSpacing={-2.5}
        affixGap={8}
      />,
    );
  });
  const prefix = tree.root.findAllByProps({ testID: 'rolling-leading-affix' });
  const suffix = tree.root.findAllByProps({ testID: 'rolling-trailing-affix' });
  if (leading) {
    expect(prefix[0].props.children).toBe(leading);
    expect(StyleSheet.flatten(prefix[0].props.style).marginRight).toBe(8);
  } else expect(prefix).toHaveLength(0);
  if (trailing) {
    expect(suffix[0].props.children).toBe(trailing);
    expect(StyleSheet.flatten(suffix[0].props.style).marginLeft).toBe(8);
  } else expect(suffix).toHaveLength(0);
  const digits = measures();
  expect(StyleSheet.flatten(digits[0].parent!.props.style).marginRight).toBe(-2.5);
  expect(StyleSheet.flatten(digits[digits.length - 1].parent!.props.style).marginRight).toBe(0);
});
