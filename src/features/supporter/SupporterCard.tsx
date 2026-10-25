import React, { useRef, useState } from 'react';
import { ChevronRight, HeartHandshake } from '@tamagui/lucide-icons';
import { Text, View } from 'tamagui';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { appTypography } from '~/shared/theme/appearance';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useSupporterStore } from '~/state/supporterStore';
import { SupporterModal } from './SupporterModal';

/** Local UI preview. Opening it never starts a payment or activates a membership. */
function SupporterCardContent({ onDoNotShowAgain }: { onDoNotShowAgain: () => void }) {
  const reducedMotion = useReducedMotion();
  const opening = useRef(false);
  const [visible, setVisible] = useState(false);
  const [animationType, setAnimationType] = useState<'none' | 'slide'>('none');

  const open = () => {
    if (opening.current) return;
    opening.current = true;
    // Freeze the animation for this presentation, even if the motion setting changes.
    setAnimationType(reducedMotion ? 'none' : 'slide');
    setVisible(true);
  };
  const close = () => {
    setVisible(false);
    opening.current = false;
  };

  return (
    <>
      <AppPressable
        width="100%"
        minHeight={56}
        rounded="$6"
        bg="$buttonDefaultSecondary"
        px="$4"
        py="$3"
        flexDirection="row"
        items="center"
        gap="$3"
        hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
        pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
        accessibilityLabel="Become a Bey supporter"
        accessibilityHint="Learn how optional support could help Bey and open-source development"
        onPress={open}
      >
        <View width={24} items="center" justify="center" aria-hidden>
          <HeartHandshake size={22} color="$color" strokeWidth={1.8} />
        </View>
        <Text {...appTypography.label2} color="$color" flex={1}>
          Become a Bey supporter
        </Text>
        <ChevronRight size={20} color="$gray10" aria-hidden />
      </AppPressable>
      <SupporterModal
        visible={visible}
        animationType={animationType}
        onClose={close}
        onDoNotShowAgain={() => {
          close();
          onDoNotShowAgain();
        }}
      />
    </>
  );
}

export function SupporterCard() {
  const dismissed = useSupporterStore((state) => state.homeCardDismissed);
  const dismiss = useSupporterStore((state) => state.dismissHomeCard);
  return dismissed ? null : <SupporterCardContent onDoNotShowAgain={dismiss} />;
}
