import { useTheme } from 'tamagui';
import { AppScreenHeader } from './AppScreenHeader';

export function useScreenHeaderOptions() {
  const theme = useTheme();
  return {
    header: AppScreenHeader,
    headerTitleAlign: 'center' as const,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerStyle: { backgroundColor: theme.background.val },
    headerTintColor: theme.color.val,
  };
}
