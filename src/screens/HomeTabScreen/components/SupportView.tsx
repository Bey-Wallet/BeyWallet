import { ChevronRight } from "@tamagui/lucide-icons";
import { H6, Text, XStack, YStack } from "tamagui";

export default function SupportView() {
    return (
        <YStack width="100%" gap="$4" px="$1" >
            <XStack>
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Support</H6>
            </XStack>
            <YStack gap={"$3"}>

                <XStack items={"center"} gap={10}>
                    <H6>How your funds are stored</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
                <XStack items={"center"} gap={10}>
                    <H6>Deposit & Withdraw to mints</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
                <XStack items={"center"} gap={10}>
                    <H6>Wallet Security</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
                <XStack items={"center"} gap={10}>
                    <H6>What is Bey? (FAQ)</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
                <XStack items={"center"} gap={10}>
                    <H6>Learn about Bitcoin & Ecash</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
                <XStack items={"center"} gap={10}>
                    <H6>Contact Support</H6>
                    <ChevronRight strokeWidth={3} color="$color" />
                </XStack>
            </YStack>
        </YStack>
    )
}