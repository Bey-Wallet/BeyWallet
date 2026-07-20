import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flex } from "~/components/UI/Flex";
import SwapScreen from "~/screens/SwapScreen";

export default function Swap() {
   const insets = useSafeAreaInsets()
      
      return (
          <Flex fill bg="$background" pb={insets.bottom || 16}>
              <SwapScreen />
          </Flex>
      )
}
