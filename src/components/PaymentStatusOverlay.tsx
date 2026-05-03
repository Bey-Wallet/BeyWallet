/**
 * PaymentStatusOverlay
 *
 * Full-screen overlay shown during payment processing.
 * Three states:
 *   - sending:  Animated spinner + pulsing accent glow
 *   - success:  Green checkmark, amount, recipient, details
 *   - error:    Red X, error message, retry/dismiss
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Modal } from 'react-native';
import { YStack, XStack, Text, Button, Separator, View } from 'tamagui';
import {
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Building2,
  Clock,
  Zap,
} from '@tamagui/lucide-icons';

export type PaymentStatusState = 'sending' | 'receiving' | 'success' | 'error';
export type PaymentDirection = 'send' | 'receive';

export interface PaymentStatusOverlayProps {
  visible: boolean;
  state: PaymentStatusState;
  direction: PaymentDirection;
  amount?: number;
  recipient?: string; // npub, nip05, or bey.cash username
  mintUrl?: string;
  errorMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onViewDetails?: () => void;
}

export function PaymentStatusOverlay({
  visible,
  state,
  direction,
  amount = 0,
  recipient,
  mintUrl,
  errorMessage,
  onDismiss,
  onRetry,
  onViewDetails,
}: PaymentStatusOverlayProps) {
  // ── Animations ─────────────────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (state === 'sending' || state === 'receiving') {
      // Spin animation
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Success/error: bounce in
      spinAnim.stopAnimation();
      pulseAnim.stopAnimation();
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      spinAnim.stopAnimation();
      pulseAnim.stopAnimation();
      scaleAnim.stopAnimation();
    };
  }, [visible, state]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const truncate = (s?: string) => {
    if (!s) return 'Unknown';
    if (s.includes('@')) return s; // bey.cash username
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  const mintDomain = mintUrl
    ? mintUrl.replace(/^https?:\/\//, '').split('/')[0]
    : 'Unknown';

  const isSending = state === 'sending' || state === 'receiving';
  const isSuccess = state === 'success';
  const isError = state === 'error';

  const dirLabel = direction === 'send' ? 'Sending' : 'Receiving';
  const successLabel = direction === 'send' ? 'Sent Successfully' : 'Payment Received';
  const dirIcon = direction === 'send'
    ? <ArrowUpRight size={20} color="white" />
    : <ArrowDownLeft size={20} color="white" />;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={isSuccess || isError ? onDismiss : undefined}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <YStack flex={1} items="center" justify="center" px="$5">

          {/* ── Loading State ───────────────────────────────────────────── */}
          {isSending && (
            <YStack items="center" gap="$6">
              {/* Spinner ring */}
              <View width={120} height={120} items="center" justify="center">
                <Animated.View
                  style={[
                    styles.spinnerRing,
                    { transform: [{ rotate: spin }], opacity: pulseAnim },
                  ]}
                />
                <View
                  position="absolute"
                  width={72}
                  height={72}
                  rounded="$12"
                  bg="$accent10"
                  items="center"
                  justify="center"
                >
                  {dirIcon}
                </View>
              </View>

              <YStack items="center" gap="$2">
                <Text fontSize="$7" fontWeight="900" color="white">
                  {dirLabel}
                </Text>
                {amount > 0 && (
                  <Text fontSize="$9" fontWeight="900" color="white">
                    ₿{amount.toLocaleString()}
                  </Text>
                )}
                <Text fontSize="$3" color="rgba(255,255,255,0.5)" fontWeight="600">
                  Please wait...
                </Text>
              </YStack>
            </YStack>
          )}

          {/* ── Success State ───────────────────────────────────────────── */}
          {isSuccess && (
            <Animated.View
              style={{ transform: [{ scale: scaleAnim }], width: '100%' }}
            >
              <YStack items="center" gap="$5" width="100%">
                {/* Green check circle */}
                <View
                  width={96}
                  height={96}
                  rounded="$12"
                  bg="$green9"
                  items="center"
                  justify="center"
                  shadowColor="$green9"
                  shadowOffset={{ width: 0, height: 0 }}
                  shadowOpacity={0.5}
                  shadowRadius={30}
                >
                  <Check size={48} color="white" strokeWidth={3} />
                </View>

                <YStack items="center" gap="$1">
                  <Text fontSize="$6" fontWeight="900" color="$green9">
                    {successLabel}
                  </Text>
                  <Text fontSize="$10" fontWeight="900" color="white">
                    ₿{amount.toLocaleString()}
                  </Text>
                  <Text fontSize="$4" color="rgba(255,255,255,0.4)" fontWeight="600">
                    sats
                  </Text>
                </YStack>

                {/* Details card */}
                <YStack
                  width="100%"
                  bg="rgba(255,255,255,0.08)"
                  rounded="$5"
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.1)"
                >
                  {recipient && (
                    <>
                      <XStack px="$4" py="$3" justify="space-between" items="center">
                        <XStack gap="$2" items="center">
                          <User size={16} color="rgba(255,255,255,0.5)" />
                          <Text color="rgba(255,255,255,0.5)" fontSize="$3" fontWeight="600">
                            {direction === 'send' ? 'To' : 'From'}
                          </Text>
                        </XStack>
                        <Text color="white" fontSize="$3" fontWeight="800" numberOfLines={1} style={{ maxWidth: 200 }}>
                          {truncate(recipient)}
                        </Text>
                      </XStack>
                      <Separator borderColor="rgba(255,255,255,0.08)" />
                    </>
                  )}

                  <XStack px="$4" py="$3" justify="space-between" items="center">
                    <XStack gap="$2" items="center">
                      <Building2 size={16} color="rgba(255,255,255,0.5)" />
                      <Text color="rgba(255,255,255,0.5)" fontSize="$3" fontWeight="600">
                        Mint
                      </Text>
                    </XStack>
                    <Text color="white" fontSize="$3" fontWeight="800" numberOfLines={1} style={{ maxWidth: 200 }}>
                      {mintDomain}
                    </Text>
                  </XStack>

                  <Separator borderColor="rgba(255,255,255,0.08)" />

                  <XStack px="$4" py="$3" justify="space-between" items="center">
                    <XStack gap="$2" items="center">
                      <Clock size={16} color="rgba(255,255,255,0.5)" />
                      <Text color="rgba(255,255,255,0.5)" fontSize="$3" fontWeight="600">
                        Time
                      </Text>
                    </XStack>
                    <Text color="white" fontSize="$3" fontWeight="800">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </XStack>

                  <Separator borderColor="rgba(255,255,255,0.08)" />

                  <XStack px="$4" py="$3" justify="space-between" items="center">
                    <XStack gap="$2" items="center">
                      <Zap size={16} color="rgba(255,255,255,0.5)" />
                      <Text color="rgba(255,255,255,0.5)" fontSize="$3" fontWeight="600">
                        Protocol
                      </Text>
                    </XStack>
                    <XStack bg="rgba(255,255,255,0.1)" px="$2" py="$1" rounded="$2">
                      <Text color="rgba(255,255,255,0.6)" fontSize="$2" fontWeight="800">
                        Cashu P2PK
                      </Text>
                    </XStack>
                  </XStack>
                </YStack>

                {/* Actions */}
                <YStack width="100%" gap="$2.5" pt="$2">
                  <Button
                    size="$5"
                    fontWeight="800"
                    bg="$green9"
                    color="white"
                    pressStyle={{ bg: '$green10', scale: 0.98 }}
                    onPress={onDismiss}
                  >
                    Done
                  </Button>
                </YStack>
              </YStack>
            </Animated.View>
          )}

          {/* ── Error State ─────────────────────────────────────────────── */}
          {isError && (
            <Animated.View
              style={{ transform: [{ scale: scaleAnim }], width: '100%' }}
            >
              <YStack items="center" gap="$5" width="100%">
                <View
                  width={96}
                  height={96}
                  rounded="$12"
                  bg="$red9"
                  items="center"
                  justify="center"
                  shadowColor="$red9"
                  shadowOffset={{ width: 0, height: 0 }}
                  shadowOpacity={0.5}
                  shadowRadius={30}
                >
                  <X size={48} color="white" strokeWidth={3} />
                </View>

                <YStack items="center" gap="$2">
                  <Text fontSize="$6" fontWeight="900" color="$red9">
                    Payment Failed
                  </Text>
                  {errorMessage && (
                    <Text
                      fontSize="$3"
                      color="rgba(255,255,255,0.5)"
                      text="center"
                      fontWeight="500"
                      px="$4"
                      numberOfLines={3}
                    >
                      {errorMessage}
                    </Text>
                  )}
                </YStack>

                <YStack width="100%" gap="$2.5" pt="$2">
                  {onRetry && (
                    <Button
                      size="$5"
                      fontWeight="800"
                      bg="$red9"
                      color="white"
                      pressStyle={{ bg: '$red10', scale: 0.98 }}
                      onPress={onRetry}
                    >
                      Try Again
                    </Button>
                  )}
                  <Button
                    size="$5"
                    fontWeight="800"
                    chromeless
                    color="rgba(255,255,255,0.6)"
                    pressStyle={{ opacity: 0.7 }}
                    onPress={onDismiss}
                  >
                    Dismiss
                  </Button>
                </YStack>
              </YStack>
            </Animated.View>
          )}
        </YStack>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#7c3aed',
    borderRightColor: '#7c3aed',
    position: 'absolute',
  },
});
