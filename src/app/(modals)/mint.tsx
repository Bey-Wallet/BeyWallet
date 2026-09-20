import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flex } from '~/shared/ui/Flex';
import MintScreen from '~/features/payments/mint';

export default function MintModal() {
  const insets = useSafeAreaInsets();

  return (
    <Flex flex={1} bg="$background" pb={insets.bottom || 16}>
      <MintScreen />
    </Flex>
  );
}
