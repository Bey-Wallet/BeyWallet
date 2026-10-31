import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TamaguiProvider, Theme, YStack, Text } from 'tamagui';
import { config } from '~/tamagui.config';
import AppBottomSheet, { AppBottomSheetThemeProvider } from '~/shared/ui/AppBottomSheet';
import { posColors } from '~/shared/theme/pos';

let mockContainer: React.ComponentType<React.PropsWithChildren> | undefined;
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: require('react').forwardRef((props: any, _ref: any) => {
    mockContainer = props.containerComponent;
    return null;
  }),
  BottomSheetView: 'BottomSheetView',
}));

it('carries an opted-in POS theme across the sheet portal without changing ordinary sheets', async () => {
  let source!: ReactTestRenderer;
  let portal!: ReactTestRenderer;
  try {
    await act(async () => {
      source = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <AppBottomSheetThemeProvider value="light_pos">
            <Theme name="light_pos">
              <AppBottomSheet>
                <Text>Request</Text>
              </AppBottomSheet>
            </Theme>
          </AppBottomSheetThemeProvider>
        </TamaguiProvider>,
      );
    });
    const Container = mockContainer!;
    expect(Container).toBeDefined();
    // Gorhom re-parents this container beneath the app's dark portal host.
    await act(async () => {
      portal = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <Container>
            <YStack testID="portal-content" bg="$background">
              <Text testID="portal-label" color="$color">
                Choose mint
              </Text>
            </YStack>
          </Container>
        </TamaguiProvider>,
      );
    });
    const styles = (id: string, property: 'backgroundColor' | 'color') =>
      portal.root
        .findAll((node) => node.props.testID === id)
        .map((node) => StyleSheet.flatten(node.props.style)?.[property]);
    expect(styles('portal-content', 'backgroundColor')).toContain(posColors.canvas);
    expect(styles('portal-label', 'color')).toContain(posColors.ink);
    await act(async () =>
      source.update(
        <TamaguiProvider config={config} defaultTheme="dark">
          <AppBottomSheet>
            <Text>Normal sheet</Text>
          </AppBottomSheet>
        </TamaguiProvider>,
      ),
    );
    expect(mockContainer).toBeUndefined();
  } finally {
    await act(async () => {
      source?.unmount();
      portal?.unmount();
    });
  }
});
