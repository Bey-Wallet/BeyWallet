import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import { Text, type TextProps } from 'tamagui';
import { getAmountLetterSpacing } from '~/shared/theme/appearance';

interface RollingDigitProps {
  digit: string | number;
  height: number;
  width?: number;
  color?: any;
  fontWeight?: any;
  fontFamily?: TextProps['fontFamily'];
  fontSize?: number;
  index: number;
  letterSpacing?: number;
  duration?: number;
  opacity?: number;
  animateChanges?: boolean;
}

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function DigitWheel({
  digit,
  height,
  renderDigit,
}: {
  digit: number;
  height: number;
  renderDigit: (digit: number, hidden?: boolean) => React.ReactNode;
}) {
  const target = -digit * height;
  const offset = useSharedValue(target);
  const previousTarget = useRef(target);

  useLayoutEffect(() => {
    if (previousTarget.current === target) return;
    previousTarget.current = target;
    offset.value = withTiming(target, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [offset, target]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return (
    <Animated.View style={style}>
      {NUMBERS.map((number) => renderDigit(number, number !== digit))}
    </Animated.View>
  );
}

const RollingDigit = ({
  digit,
  height,
  color,
  fontWeight,
  fontFamily,
  fontSize,
  index,
  letterSpacing = 0,
  duration = 800,
  opacity = 1,
  animateChanges,
}: RollingDigitProps) => {
  const parsedDigit = parseInt(digit as string, 10);
  const measurementKey = JSON.stringify([
    animateChanges === undefined ? parsedDigit : 'tabular',
    fontFamily,
    fontWeight,
    fontSize,
    height,
  ]);
  const currentMeasurementKey = useRef(measurementKey);
  currentMeasurementKey.current = measurementKey;
  const [measurement, setMeasurement] = useState<{ key: string; width: number }>();
  const digitWidth = measurement?.key === measurementKey ? measurement.width : undefined;
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (animateChanges !== undefined) return;
    if (!isNaN(parsedDigit)) {
      translateY.value = withDelay(
        index * 50,
        withTiming(-parsedDigit * height, {
          duration: duration,
          easing: Easing.out(Easing.exp),
        }),
      );
    } else {
      translateY.value = 0;
    }
  }, [parsedDigit, height, index, duration, animateChanges]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const renderDigit = (num: number, hidden = false) => (
    <View
      key={num}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : undefined}
      aria-hidden={hidden}
      style={{ height, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text
        color={color}
        fontWeight={fontWeight}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={height}
        text="center"
        fontVariant={['tabular-nums']}
        letterSpacing={0}
      >
        {num}
      </Text>
    </View>
  );

  return (
    <View
      style={{ height, width: digitWidth, overflow: 'hidden', marginRight: letterSpacing, opacity }}
    >
      {/* A proportional face must not inherit the widest numeral's column width. */}
      <Text
        testID="rolling-digit-measure"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        fontWeight={fontWeight}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={height}
        letterSpacing={0}
        fontVariant={['tabular-nums']}
        numberOfLines={1}
        style={{ position: 'absolute', opacity: 0, width: 10000 }}
        onTextLayout={({ nativeEvent }) => {
          if (currentMeasurementKey.current !== measurementKey) return;
          const width = nativeEvent.lines[0]?.width;
          if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return;
          setMeasurement((current) =>
            current?.key === measurementKey && current.width === width
              ? current
              : { key: measurementKey, width },
          );
        }}
      >
        {parsedDigit}
      </Text>
      {animateChanges === undefined ? (
        <Animated.View style={animatedStyle}>
          {NUMBERS.map((number) => renderDigit(number))}
        </Animated.View>
      ) : animateChanges ? (
        <DigitWheel key={height} digit={parsedDigit} height={height} renderDigit={renderDigit} />
      ) : (
        renderDigit(parsedDigit)
      )}
    </View>
  );
};

export interface RollingNumberProps {
  value?: number | string;
  children?: number | string;
  fontSize?: number;
  color?: any;
  fontWeight?: any;
  fontFamily?: TextProps['fontFamily'];
  style?: ViewStyle;
  letterSpacing?: number;
  lineHeight?: number;
  trigger?: any;
  prefix?: string;
  suffix?: string;
  /** When provided, roll only changed digits or display them immediately if false. */
  animateChanges?: boolean;
  decimalOpacity?: number;
  precision?: number;
  showDecimals?: boolean;
}

export const RollingNumber = ({
  value,
  children,
  fontSize = 40,
  color = 'black',
  fontWeight = '500',
  fontFamily,
  style,
  letterSpacing,
  lineHeight,
  trigger,
  prefix = '',
  suffix = '',
  animateChanges,
  decimalOpacity = 1,
  precision = 2,
  showDecimals = true,
}: RollingNumberProps) => {
  // Current display value
  const displayValue = children !== undefined ? children : value;

  // Build the string to display
  let formattedValue = '';

  if (typeof displayValue === 'number') {
    const finalPrecision = showDecimals ? precision : 0;
    formattedValue = displayValue.toLocaleString(undefined, {
      minimumFractionDigits: finalPrecision,
      maximumFractionDigits: finalPrecision,
    });
  } else {
    formattedValue = displayValue?.toString() || '';
  }

  const hasSatsSuffix = suffix.trim() === 'sat';
  const valueStr = prefix + formattedValue + (hasSatsSuffix ? '' : suffix);
  const itemHeight = Math.round(lineHeight || fontSize * 1.1);
  const resolvedFamily = fontFamily ?? (fontSize >= 25 ? '$display' : '$body');
  // Glyphs occupy separate cells. Allow the measured compact balance tracking,
  // scaled to this size, but prevent older aggressive margins from merging cells.
  const displaySpacing = getAmountLetterSpacing(fontSize);
  // Preserve the compact Home override while measuring cells with the current font.
  const minimumSpacing = displaySpacing;
  const defaultSpacing =
    fontSize >= 25
      ? displaySpacing
      : // Preserve small inline balances, including Home's connected-mint rows.
        -0.55 * (fontSize / 25);
  const characterSpacing = Math.max(minimumSpacing, letterSpacing ?? defaultSpacing);

  // Track if we've passed the decimal point
  let isDecimal = false;
  // Formatter punctuation and currency affixes must not shift the rolling digit columns.
  let digitsRemaining = (valueStr.match(/[0-9]/g) || []).length;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]} key={trigger}>
      {valueStr.split('').map((char, index) => {
        if (char === '.' || char === ',') {
          // Check if this comma is a decimal separator (some locales use , for decimal)
          // But usually in English formatting it's a dot.
          // Let's assume '.' is decimal for simplicity or check position.
          if (char === '.') isDecimal = true;
        }

        const currentOpacity = isDecimal ? decimalOpacity : 1;

        if (/[0-9]/.test(char)) {
          const digitIndex = digitsRemaining--;
          return (
            <RollingDigit
              key={`digit-${animateChanges === undefined ? index : digitIndex}`}
              digit={char}
              animateChanges={animateChanges}
              height={itemHeight}
              index={index}
              color={color}
              fontWeight={fontWeight}
              fontFamily={resolvedFamily}
              fontSize={fontSize}
              letterSpacing={characterSpacing}
            />
          );
        } else {
          return (
            <View
              key={`char-${index}`}
              style={{
                height: itemHeight,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: characterSpacing,
              }}
            >
              <Text
                color={color}
                fontWeight={fontWeight}
                fontFamily={resolvedFamily}
                fontSize={fontSize}
                lineHeight={itemHeight}
                letterSpacing={0}
                fontVariant={['tabular-nums']}
              >
                {char}
              </Text>
            </View>
          );
        }
      })}
      {hasSatsSuffix && (
        <Text
          color={color}
          fontWeight={fontWeight}
          fontSize={Math.max(11, Math.round(fontSize * 0.55))}
        >
          {' sat'}
        </Text>
      )}
    </View>
  );
};
