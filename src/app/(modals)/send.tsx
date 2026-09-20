import { SendModalScreen } from '~/features/payments/send';
import { Flex } from '~/shared/ui/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SendModal() {
  const insets = useSafeAreaInsets();

  return (
    <Flex fill bg="$background" pb={insets.bottom || 16}>
      <SendModalScreen />
    </Flex>
  );
}
