import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, type TamaguiProviderProps } from 'tamagui';
import { ToastProvider, ToastViewport } from '@tamagui/toast';
import { ManagerProvider, MintProvider, BalanceProvider } from 'coco-cashu-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { CurrentToast } from './CurrentToast';
import { config } from '../tamagui.config';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';

export function Provider({ children, cocoManager, ...rest }: any) {
  return (
    <SafeAreaProvider>
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
        <ToastProvider swipeDirection="horizontal" duration={6000} native={[]}>
          {children}
          <CurrentToast />
          <ToastViewport top="$8" left={0} right={0} />
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
