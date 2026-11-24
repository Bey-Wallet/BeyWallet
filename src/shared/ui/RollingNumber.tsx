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

function DigitSlide({
  previous,
  height,
  children,
}: {
  previous: React.ReactNode;
  height: number;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(height);
  useLayoutEffect(() => {
    offset.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [offset]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return (
    <Animated.View style={style}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={{ position: 'absolute', top: -height, left: 0, right: 0 }}
      >
        {previous}
      </View>
      {children}
    </Animated.View>
  );
}

function ChangedDigit({
  digit,
  height,
  enabled,
  renderDigit,
}: {
  digit: number;
  height: number;
  enabled: boolean;
  renderDigit: (digit: number) => React.ReactNode;
}) {
  const [change, setChange] = useState<{ current: number; previous?: number }>({ current: digit });
  if (change.current !== digit)
    setChange({ current: digit, previous: enabled ? change.current : undefined });
  if (change.previous === undefined) return renderDigit(digit);
  return (
    <DigitSlide
      key={`${change.previous}:${digit}`}
      previous={renderDigit(change.previous)}
      height={height}
    >
      {renderDigit(digit)}
    </DigitSlide>
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

  const renderDigit = (num: number) => (
    <View key={num} style={{ height, justifyContent: 'center', alignItems: 'center' }}>
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
        <Animated.View style={animatedStyle}>{NUMBERS.map(renderDigit)}</Animated.View>
      ) : (
        <ChangedDigit
          key={`${animateChanges}:${height}`}
          digit={parsedDigit}
          height={height}
          enabled={animateChanges}
          renderDigit={renderDigit}
        />
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
  /** Optional layout gap around currency affixes; numeric tracking stays unchanged. */
  affixGap?: number;
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
  affixGap,
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
  const affixes = affixGap === undefined ? null : valueStr.match(/^(\D*)([\s\S]*\d)(\D*)$/);
  const leadingAffix = affixes?.[1].trim();
  const trailingAffix = affixes?.[3].trim();
  const numberText = affixes ? affixes[2] : valueStr;
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

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]} key={trigger}>
      {!!leadingAffix && (
        <Text
          testID="rolling-leading-affix"
          color={color}
          fontWeight={fontWeight}
          fontFamily={resolvedFamily}
          fontSize={fontSize}
          lineHeight={itemHeight}
          letterSpacing={characterSpacing}
          style={{ marginRight: affixGap }}
        >
          {leadingAffix}
        </Text>
      )}
      {numberText.split('').map((char, index) => {
        const spacing =
          affixGap !== undefined && index === numberText.length - 1 ? 0 : characterSpacing;
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
              key={`digit-${animateChanges === undefined ? index : numberText.length - index}`}
              digit={char}
              animateChanges={animateChanges}
              height={itemHeight}
              index={index}
              color={color}
              fontWeight={fontWeight}
              fontFamily={resolvedFamily}
              fontSize={fontSize}
              letterSpacing={spacing}
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
                marginRight: spacing,
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
      {!!trailingAffix && (
        <Text
          testID="rolling-trailing-affix"
          color={color}
          fontWeight={fontWeight}
          fontFamily={resolvedFamily}
          fontSize={fontSize}
          lineHeight={itemHeight}
          letterSpacing={characterSpacing}
          style={{ marginLeft: affixGap }}
        >
          {trailingAffix}
        </Text>
      )}
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
