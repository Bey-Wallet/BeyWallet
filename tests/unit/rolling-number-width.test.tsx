import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { RollingNumber } from '~/shared/ui/RollingNumber';

jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    withTiming: jest.fn(mock.withTiming),
    useSharedValue: (value: number) => require('react').useRef({ value }).current,
  };
});

let tree: ReactTestRenderer;
const measures = () => tree.root.findAllByProps({ testID: 'rolling-digit-measure' });
const width = (index: number) => StyleSheet.flatten(measures()[index].parent!.props.style).width;
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.mocked(withTiming).mockClear();
});

it('shows the initial value immediately and rolls only the changed digit in either direction', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="12,340" animateChanges trigger="sats" />);
  });
  expect(withTiming).not.toHaveBeenCalled();
  await act(async () =>
    tree.update(<RollingNumber value="12,345" animateChanges trigger="sats" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(1);
  expect(withTiming).toHaveBeenLastCalledWith(-220, expect.objectContaining({ duration: 460 }));
  await act(async () =>
    tree.update(<RollingNumber value="12,345" animateChanges trigger="sats" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(1);
  await act(async () =>
    tree.update(<RollingNumber value="12,342" animateChanges trigger="sats" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(2);
  expect(withTiming).toHaveBeenLastCalledWith(-88, expect.objectContaining({ duration: 460 }));
  await act(async () => tree.update(<RollingNumber value="12.35" animateChanges trigger="fiat" />));
  await act(async () =>
    tree.update(<RollingNumber value="12.36" animateChanges={false} trigger="fiat" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(2);
});

it('rolls changed digits across currency switches without counting formatter symbols as columns', async () => {
  await act(async () => {
    tree = create(<RollingNumber value="12,34 €" animateChanges trigger="visible" />);
  });
  expect(withTiming).not.toHaveBeenCalled();
  await act(async () =>
    tree.update(<RollingNumber value="1,235" suffix=" sat" animateChanges trigger="visible" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(1);
  expect(withTiming).toHaveBeenLastCalledWith(-220, expect.objectContaining({ duration: 460 }));
  await act(async () =>
    tree.update(<RollingNumber value="12,34 €" animateChanges trigger="visible" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(2);
  expect(withTiming).toHaveBeenLastCalledWith(-176, expect.objectContaining({ duration: 460 }));
  await act(async () =>
    tree.update(<RollingNumber value="****" animateChanges trigger="hidden" />),
  );
  expect(withTiming).toHaveBeenCalledTimes(2);
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

it.each(['$12.34', '₹1,234.56', '12,34\u00a0€', '12.34 CHF'])(
  'keeps the formatted symbols and spaces in %s',
  async (value) => {
    await act(async () => {
      tree = create(
        <RollingNumber value={value} fontSize={44} fontWeight={500} letterSpacing={-2.5} />,
      );
    });
    const symbols = tree.root
      .findAllByType('Text' as any)
      .map((node) => node.props.children)
      .filter((text): text is string => typeof text === 'string' && /^\D$/.test(text));
    expect(symbols.join('')).toBe(value.replace(/\d/g, ''));
    const digits = measures();
    expect(StyleSheet.flatten(digits[0].parent!.props.style).marginRight).toBe(-2.5);
    expect(StyleSheet.flatten(digits[digits.length - 1].parent!.props.style).marginRight).toBe(
      -2.5,
    );
  },
);
