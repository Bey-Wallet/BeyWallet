import React from "react";
import { YStack } from "tamagui";
import Balance from "./Balance";

export default function WalletCard() {
  return (
    <YStack width={"100%"} gap="$2">
      <Balance />
    </YStack>
  );
}
