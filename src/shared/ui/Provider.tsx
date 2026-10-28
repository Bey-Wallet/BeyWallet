import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { TamaguiProvider, type TamaguiProviderProps } from 'tamagui';
import { ToastProvider } from '@tamagui/toast';
import { ManagerProvider, MintProvider, BalanceProvider } from 'coco-cashu-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AppToast } from '~/shared/ui/AppToast';
import { AppToastViewport } from '~/shared/ui/AppToastViewport';
import { OperationFeedbackProvider } from '~/shared/ui/OperationFeedback';
import { config } from '~/tamagui.config';
import { ThemeProvider, useAppTheme } from '~/shared/theme/ThemeContext';

export function Provider({ children, cocoManager, ...rest }: any) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <InnerProvider cocoManager={cocoManager} {...rest}>
            {children}
          </InnerProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function InnerProvider({ children, cocoManager, ...rest }: any) {
  const { resolvedTheme } = useAppTheme();

  const content = (
    <TamaguiProvider
      config={config}

      defaultTheme={resolvedTheme}
      {...rest}
    >
      <BottomSheetModalProvider>
        <ToastProvider swipeDirection="horizontal" duration={3000} native={[]}>
          <OperationFeedbackProvider>
            {children}
            <AppToast />
          </OperationFeedbackProvider>
          <AppToastViewport />
        </ToastProvider>
      </BottomSheetModalProvider>
    </TamaguiProvider>
  );

  if (cocoManager) {
    return (
      <ManagerProvider manager={cocoManager}>
        <MintProvider>
          <BalanceProvider>{content}</BalanceProvider>
        </MintProvider>
      </ManagerProvider>
    );
  }

  return content;
}
