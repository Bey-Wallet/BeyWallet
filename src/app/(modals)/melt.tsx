import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flex } from '~/shared/ui/Flex';
import MeltScreen from '~/features/payments/melt';

export default function Melt() {
  const insets = useSafeAreaInsets();

  return (
    <Flex fill bg="$background" pb={insets.bottom || 16}>
      <MeltScreen />
    </Flex>
  );
}
