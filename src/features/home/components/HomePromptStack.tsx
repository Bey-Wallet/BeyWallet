import React, { useRef, useState } from 'react';
import { AlertTriangle, AtSign, HeartHandshake } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SupporterModal } from '~/features/supporter/SupporterModal';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useSettingsStore } from '~/state/settingsStore';
import { useSupporterStore } from '~/state/supporterStore';
import { PromptCardStack, type HomePrompt } from './PromptCardStack';

const BACKUP_REMINDER_DELAY = 7 * 24 * 60 * 60 * 1000;

export function HomePromptStack() {
  const router = useRouter();
  const { nip05, loading } = useNip05Lookup();
  const reducedMotion = useReducedMotion();
  const seedBackedUp = useSettingsStore((state) => state.seedBackedUp);
  const backupDismissedAt = useSettingsStore((state) => state.backupDismissedAt);
  const setBackupDismissedAt = useSettingsStore((state) => state.setBackupDismissedAt);
  const usernameDismissedAt = useSettingsStore((state) => state.usernameClaimDismissedAt);
  const setUsernameDismissedAt = useSettingsStore((state) => state.setUsernameClaimDismissedAt);
  const supporterDismissed = useSupporterStore((state) => state.homeCardDismissed);
  const dismissSupporter = useSupporterStore((state) => state.dismissHomeCard);
  const opening = useRef(false);
  const [supporterVisible, setSupporterVisible] = useState(false);
  const [animationType, setAnimationType] = useState<'none' | 'slide'>('none');

  const closeSupporter = () => {
    setSupporterVisible(false);
    opening.current = false;
  };
  const cards: HomePrompt[] = [];

  if (
    !seedBackedUp &&
    (!backupDismissedAt || Date.now() - backupDismissedAt >= BACKUP_REMINDER_DELAY)
  ) {
    cards.push({
      id: 'backup',
      title: 'Secure your wallet',
      description: 'Back up your recovery phrase to protect your funds.',
      icon: <AlertTriangle size={20} color="$color" />,
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Authentication remains at the destination before recovery material is revealed.
        router.push('/(modals)/backup-seed');
      },
      onDismiss: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return setBackupDismissedAt(Date.now());
      },
    });
  }

  if (!nip05 && !loading && !usernameDismissedAt) {
    cards.push({
      id: 'username',
      title: 'Claim your username',
      description: 'Get your free @bey.cash Nostr identifier.',
      icon: <AtSign size={20} color="$color" />,
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(modals)/nostr-username');
      },
      onDismiss: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return setUsernameDismissedAt(Date.now());
      },
    });
  }

  if (!supporterDismissed) {
    cards.push({
      id: 'supporter',
      title: 'Become a Bey supporter',
      description: 'Help Bey and open-source development.',
      icon: <HeartHandshake size={20} color="$color" />,
      onPress: () => {
        if (opening.current) return;
        opening.current = true;
        setAnimationType(reducedMotion ? 'none' : 'slide');
        setSupporterVisible(true);
      },
      onDismiss: dismissSupporter,
    });
  }

  return (
    <>
      <PromptCardStack cards={cards} />
      <SupporterModal
        visible={supporterVisible}
        animationType={animationType}
        onClose={closeSupporter}
        onDoNotShowAgain={() => {
          closeSupporter();
          dismissSupporter();
        }}
      />
    </>
  );
}
