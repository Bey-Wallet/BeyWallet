import { RemoteImage } from '~/shared/ui/RemoteImage';
import React, { useEffect, useState } from 'react';
import { View } from 'tamagui';
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
  useEffect(() => setFailed(false), [npub, picture]);
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
        <RemoteImage
          identity={npub}
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
