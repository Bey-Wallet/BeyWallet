import React, { useEffect, useState } from 'react';
import { Image, View } from 'tamagui';
import Blockies from '~/shared/ui/Blockies';

export function ConversationAvatar({
  npub,
  picture,
  size = 40,
}: {
  npub: string;
  picture?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [picture]);
  return (
    <View
      width={size}
      height={size}
      rounded={size / 2}
      overflow="hidden"
      bg="$gray4"
      items="center"
      justify="center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {picture && !failed ? (
        <Image
          key={picture}
          source={{ uri: picture }}
          width={size}
          height={size}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Blockies seed={npub} size={10} scale={size / 10} />
      )}
    </View>
  );
}
