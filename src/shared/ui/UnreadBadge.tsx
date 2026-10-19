import { Text, YStack } from 'tamagui';

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <YStack
      bg="$buttonBrandedPrimary"
      rounded={10}
      minWidth={20}
      height={20}
      px={5}
      items="center"
      justify="center"
      pointerEvents="none"
    >
      <Text fontSize={11} fontWeight="600" color="$buttonBrandedPrimaryText">
        {count > 99 ? '99+' : String(count)}
      </Text>
    </YStack>
  );
}
