
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flex } from "~/components/UI/Flex";
import MeltScreen from "~/screens/MeltScreen";

export default function Melt() {


    const insets = useSafeAreaInsets()
    
    return (
        <Flex fill bg="$background" pb={insets.bottom || 16}>
            <MeltScreen />
        </Flex>
    )
}
