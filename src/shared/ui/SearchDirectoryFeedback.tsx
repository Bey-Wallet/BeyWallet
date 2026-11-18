import { Text, XStack, YStack } from 'tamagui';
import { AppButton } from './AppButton';
import { Spinner } from './Spinner';
import { appTypography } from '~/shared/theme/appearance';

export function SearchDirectoryFeedback({
  loading,
  failed,
  refreshing,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  refreshing: boolean;
  onRetry: () => void;
}) {
  if (!loading && !failed) return null;
  return (
    <YStack bg="$gray2" rounded="$6" p="$4" gap="$3">
      {loading ? (
        <XStack items="center" gap="$2">
          <Spinner size={20} />
          <Text {...appTypography.body2} color="$gray10" accessibilityLiveRegion="polite">
            Loading people directory…
          </Text>
        </XStack>
      ) : (
        <>
          <Text {...appTypography.body2} color="$gray10" accessibilityRole="alert">
            People directory unavailable. Saved people and direct public keys still work.
          </Text>
          <AppButton emphasis="secondary" size="small" loading={refreshing} onPress={onRetry}>
            Try again
          </AppButton>
        </>
      )}
    </YStack>
  );
}
