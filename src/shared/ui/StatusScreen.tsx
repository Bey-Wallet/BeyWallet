import React, { useEffect } from 'react';
import { YStack, Text, Button, XStack, Paragraph } from 'tamagui';
import { Check, X, Clock, ArrowRight } from '@tamagui/lucide-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Modal, StatusBar, Platform } from 'react-native';

type StatusType = 'success' | 'error' | 'pending';

interface StatusScreenProps {
  type: StatusType;
  title: string;
  message?: string;
  amount?: string;
  onClose?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  visible: boolean;
}

const AnimatedYStack = Animated.createAnimatedComponent(YStack);

export default function StatusScreen({
  type,
  title,
  message,
  amount,
  onClose,
  onAction,
  actionLabel = 'Done',
  visible,
}: StatusScreenProps) {
  const scale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;

    // Trigger haptic feedback based on status
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Animate entrance
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });

    iconRotate.value = withSequence(
      withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 0 }),
    );

    opacity.value = withTiming(1, { duration: 400 });

    // Pulse animation for pending state
    if (type === 'pending') {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.1, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        false,
      );
    }
  }, [type, visible]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${iconRotate.value}deg` }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'yellowgreen';
      case 'error':
        return '$red9';
      case 'pending':
        return '$orange9';
      default:
        return '$background';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'black';
      case 'error':
        return 'white';
      case 'pending':
        return 'white';
      default:
        return '$color';
    }
  };

  const getStatusBarStyle = () => {
    switch (type) {
      case 'success':
      case 'error':
      case 'pending':
        return 'light-content';
      default:
        return 'dark-content';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check size={80} color={getIconColor()} strokeWidth={3} />;
      case 'error':
        return <X size={80} color={getIconColor()} strokeWidth={3} />;
      case 'pending':
        return <Clock size={80} color={getIconColor()} strokeWidth={3} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle={getStatusBarStyle()} backgroundColor="transparent" translucent />
      <YStack
        flex={1}
        bg={getBackgroundColor()}
        items="center"
        justify="space-between"
        gap="$6"
        p="$6"
      >
        <AnimatedYStack
          style={[iconAnimatedStyle, type === 'pending' ? pulseAnimatedStyle : {}]}
          bg="black"
          width={160}
          height={160}
          rounded="$12"
          items="center"
          justify="center"
        >
          {getIcon()}
        </AnimatedYStack>

        <AnimatedYStack style={contentAnimatedStyle} gap="$3" items="center">
          <Text fontSize="$7" fontWeight="800" color={getIconColor()}>
            {title}
          </Text>
          {amount && (
            <XStack items="center" gap="$2">
              <Text fontSize="$10" fontWeight="700" color={getIconColor()}>
                {amount}
              </Text>
              <Text fontSize="$6" fontWeight="600" color={getIconColor()} opacity={0.8}>
                SATS
              </Text>
            </XStack>
          )}

          {message && (
            <YStack width={300}>
              <Text text="center" fontSize="$5" color={getIconColor()} opacity={0.9}>
                {message}
              </Text>
            </YStack>
          )}
        </AnimatedYStack>

        <AnimatedYStack style={contentAnimatedStyle} gap="$3" width="100%" maxW={400}>
          {onAction && (
            <Button
              size="$5"
              themeInverse
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onAction();
              }}
              iconAfter={<ArrowRight size={20} />}
            >
              {actionLabel}
            </Button>
          )}

          {onClose && (
            <Button
              size="$5"
              theme="gray"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
            >
              Close
            </Button>
          )}
        </AnimatedYStack>
      </YStack>
    </Modal>
  );
}
