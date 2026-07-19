
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flex } from "~/components/UI/Flex";
import MintScreen from "~/screens/MintScreen";

export default function MintModal() {
        const insets = useSafeAreaInsets()


    return (
        <Flex
            flex={1}
            bg="$background"
            pb={insets.bottom || 16}
        >
            <MintScreen />
        </Flex>
    );
}
