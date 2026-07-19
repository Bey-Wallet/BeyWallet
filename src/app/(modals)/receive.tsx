import { ReceiveModalScreen } from '~/screens/ReceiveModalScreen'
import { Flex } from '~/components/UI/Flex'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ReceiveModal() {
     const insets = useSafeAreaInsets()
       
       return (
           <Flex fill bg="$background" pb={insets.bottom || 16}>
               <ReceiveModalScreen />
           </Flex>
       )
}
