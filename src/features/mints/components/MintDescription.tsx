import React, { useRef, useState } from 'react';
import { YStack } from 'tamagui';
import { Text as NativeText, StyleSheet } from 'react-native';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import { buiTypography } from '~/shared/ui/BUI/typography';

/** Measure native text lines so the inline link stays inside the three-line preview. */
export function MintDescription({ description }: { description: string }) {
  const colors = useBUITheme();
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const measuredPreview = useRef<string | null | undefined>(undefined);
  const content = (
    <YStack>
      <NativeText
        style={[styles.body, styles.measurement, { color: colors.text }]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={({ nativeEvent: { lines } }) => {
          const next =
            lines.length > 3
              ? lines
                  .slice(0, 3)
                  .map((line) => line.text)
                  .join('')
                  .trimEnd()
              : null;
          if (next !== measuredPreview.current) {
            measuredPreview.current = next;
            setPreview(next);
          }
        }}
      >
        {description}
      </NativeText>
      <NativeText
        style={[styles.body, { color: colors.text }]}
        numberOfLines={!expanded && preview === null ? 3 : undefined}
        onTextLayout={({ nativeEvent: { lines } }) => {
          if (!expanded && preview && lines.length > 3) {
            const overflow = lines
              .slice(3)
              .map((line) => line.text)
              .join('').length;
            setPreview((current) => current?.slice(0, -Math.max(1, overflow)).trimEnd() ?? null);
          }
        }}
      >
        {expanded || preview === null ? description : `${preview}… `}
        {preview !== null && (
          <NativeText style={styles.link}>{expanded ? ' See less' : 'See more'}</NativeText>
        )}
      </NativeText>
    </YStack>
  );
  return preview === null ? (
    content
  ) : (
    <AppPressable
      minHeight={48}
      justify="center"
      accessibilityLabel={expanded ? 'Collapse mint description' : 'Expand mint description'}
      accessibilityHint={expanded ? description : preview}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
    >
      {content}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: 'InterTextRegular',
    fontSize: buiTypography.body2.fontSize,
    lineHeight: buiTypography.body2.lineHeight,
    letterSpacing: buiTypography.body2.letterSpacing,
    includeFontPadding: false,
  },
  link: { fontFamily: 'InterTextMedium' },
  measurement: { position: 'absolute', left: 0, right: 0, opacity: 0 },
});
