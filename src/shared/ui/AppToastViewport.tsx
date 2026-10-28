import { ToastViewport } from '@tamagui/toast';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getToastLayout } from './toastLayout';

export function AppToastViewport() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = getToastLayout(width, insets);
  return (
    <ToastViewport
      top={layout.top}
      left={layout.gutter}
      right={layout.gutter}
      gap="$2"
      items="center"
    />
  );
}
