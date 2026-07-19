import { SendModalScreen } from '~/screens/SendModalScreen'
import { Flex } from '~/components/UI/Flex'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SendModal() {
    const insets = useSafeAreaInsets()
    
    return (
        <Flex fill bg="$background" pb={insets.bottom || 16}>
            <SendModalScreen />
        </Flex>
    )
}

