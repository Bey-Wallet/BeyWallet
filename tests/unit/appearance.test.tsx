import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { Input, TamaguiProvider, Text, YStack } from 'tamagui';
import { config } from '~/tamagui.config';
import { appColors } from '~/shared/theme/appearance';
import { AppButton } from '~/shared/ui/AppButton';
import { CustomTabBar } from '~/shared/ui/CustomTabBar';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('~/features/people/hooks/usePeopleUnreadCounts', () => ({
  usePeopleUnreadCounts: () => ({ total: 3 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

const tabProps: any = {
  state: {
    index: 0,
    routes: [
      { key: 'home', name: 'index' },
      { key: 'people', name: 'people' },
    ],
  },
  descriptors: {
    home: { options: { title: 'Home', tabBarIcon: () => null } },
    people: { options: { title: 'People', tabBarIcon: () => null } },
  },
  navigation: { emit: jest.fn(() => ({})), navigate: jest.fn() },
};

it.each(['dark', 'light'] as const)(
  'renders %s colors and typography through the existing provider',
  async (appearance) => {
    let tree!: ReactTestRenderer;
    try {
      await act(async () => {
        tree = create(
          <TamaguiProvider config={config} defaultTheme={appearance}>
            <YStack testID="canvas" bg="$background" />
            <YStack testID="surface" bg="$gray2" />
            <YStack testID="sheet" bg="$sheetBackground" />
            <Text testID="primary" color="$color" fontSize="$4">
              Primary
            </Text>
            <Text testID="secondary" color="$gray10">
              Secondary
            </Text>
            <Text testID="tertiary" color="$gray9">
              Tertiary
            </Text>
            <Input testID="field" value="Kept input" />
            <AppButton testID="button">Continue</AppButton>
            <CustomTabBar {...tabProps} />
          </TamaguiProvider>,
        );
      });
      const styles = (id: string) =>
        tree.root
          .findAll((node) => node.props.testID === id)
          .map((node) => StyleSheet.flatten(node.props.style));
      const c = appColors[appearance];
      expect(styles('canvas').some((style) => style?.backgroundColor === c.canvas)).toBe(true);
      expect(styles('surface').some((style) => style?.backgroundColor === c.surface)).toBe(true);
      expect(
        styles('sheet').some(
          (style) => style?.backgroundColor === (appearance === 'light' ? '#FFFFFF' : c.surface),
        ),
      ).toBe(true);
      expect(
        styles('primary').some((style) => style?.color === c.text && style?.fontSize === 16),
      ).toBe(true);
      expect(styles('secondary').some((style) => style?.color === c.secondaryText)).toBe(true);
      expect(styles('tertiary').some((style) => style?.color === c.tertiaryText)).toBe(true);
      expect(styles('field')).toEqual(
        expect.arrayContaining([expect.objectContaining({ backgroundColor: c.field })]),
      );
      expect(styles('button').some((style) => style?.minHeight === 48)).toBe(true);
      const tabBar = tree.root.findByType(CustomTabBar);
      expect(
        tabBar.findAll((node) => {
          const style = StyleSheet.flatten(node.props.style);
          return style?.backgroundColor === c.negative;
        }).length,
      ).toBeGreaterThan(0);
      expect(
        tabBar.findAll((node) => {
          const style = StyleSheet.flatten(node.props.style);
          return node.props.children === '3' && style?.color === '#FFFFFF';
        }).length,
      ).toBeGreaterThan(0);
      const labelStyles = tree.root
        .findAll((node) => node.props.children === 'Continue')
        .map((node) => StyleSheet.flatten(node.props.style));
      expect(
        labelStyles.some(
          (style) =>
            style?.fontFamily === 'InterTextSemiBold' &&
            style?.fontSize === 16 &&
            style?.lineHeight === 24,
        ),
      ).toBe(true);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  },
);
