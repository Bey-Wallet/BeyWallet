import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flex } from '~/shared/ui/Flex';
import SwapScreen from '~/features/payments/swap';

export default function Swap() {
  const insets = useSafeAreaInsets();

  return (
    <Flex fill bg="$background" pb={insets.bottom || 16}>
      <SwapScreen />
    </Flex>
  );
}
