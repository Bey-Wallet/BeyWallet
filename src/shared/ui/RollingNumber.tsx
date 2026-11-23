import React, { useEffect, useRef, useState } from 'react';
import { TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import { Text, type TextProps } from 'tamagui';
import { appTypography } from '~/shared/theme/appearance';

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
}

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

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
}: RollingDigitProps) => {
  const parsedDigit = parseInt(digit as string, 10);
  const measurementKey = JSON.stringify([parsedDigit, fontFamily, fontWeight, fontSize, height]);
  const currentMeasurementKey = useRef(measurementKey);
  currentMeasurementKey.current = measurementKey;
  const [measurement, setMeasurement] = useState<{ key: string; width: number }>();
  const digitWidth = measurement?.key === measurementKey ? measurement.width : undefined;
  const translateY = useSharedValue(0);

  useEffect(() => {
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
  }, [parsedDigit, height, index, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

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
        fontVariant={['proportional-nums']}
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
      <Animated.View style={animatedStyle}>
        {NUMBERS.map((num) => (
          <View
            key={num}
            style={{
              height,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              color={color}
              fontWeight={fontWeight}
              fontFamily={fontFamily}
              fontSize={fontSize}
              lineHeight={height}
              text="center"
              fontVariant={['proportional-nums']}
              letterSpacing={0}
            >
              {num}
            </Text>
          </View>
        ))}
      </Animated.View>
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
  decimalOpacity?: number;
  precision?: number;
  showDecimals?: boolean;
}

export const RollingNumber = ({
  value,
  children,
  fontSize = 40,
  color = 'black',
  fontWeight = '400',
  fontFamily,
  style,
  letterSpacing,
  lineHeight,
  trigger,
  prefix = '',
  suffix = '',
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
  const displaySpacing =
    appTypography.display.letterSpacing * (fontSize / appTypography.display.fontSize);
  // Inter's checked ink bounds allow the tighter Home override without changing other defaults.
  const minimumSpacing = Math.min(displaySpacing, -1.4 * (fontSize / 44));
  const defaultSpacing =
    fontSize >= 25
      ? displaySpacing
      : appTypography.amountSmall.letterSpacing * (fontSize / appTypography.amountSmall.fontSize);
  const characterSpacing = Math.max(minimumSpacing, letterSpacing ?? defaultSpacing);

  // Track if we've passed the decimal point
  let isDecimal = false;

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
          return (
            <RollingDigit
              key={`digit-${index}`}
              digit={char}
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
                fontVariant={['proportional-nums']}
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
