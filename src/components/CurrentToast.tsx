import { Check, Loader, AlertCircle, Info } from '@tamagui/lucide-icons'
import { Toast, useToastController, useToastState } from '@tamagui/toast'
import { Button, H4, View, XStack, YStack, Spinner } from 'tamagui'
import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated'

const SpinningLoader = ({ size, color }: { size: number, color: any }) => {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    }
  })

  return (
    <Animated.View style={animatedStyle}>
      <Loader strokeWidth={3} size={size} color={color} />
    </Animated.View>
  )
}

export function CurrentToast() {
  const currentToast = useToastState()

  useEffect(() => {
    if (currentToast) {
      if (currentToast.title === 'Success' || currentToast.title === 'Loaded successfully!') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    }
  }, [currentToast?.id, currentToast?.title])

  if (!currentToast || currentToast.isHandledNatively) return null

  const toastType = (currentToast as any).type || (currentToast as any).theme
  const isLoading = currentToast.title?.includes('Loading')
  const isError = currentToast.title && ['Error', 'Failed', 'Not Paid Yet', 'Invalid', 'Warning'].some(keyword => currentToast.title.includes(keyword))
  
  // Determine if it is a success action or general info
  const isSuccess = toastType === 'success' || (currentToast.title && ['success', 'save', 'paid', 'claim', 'add', 'updat', 'received', 'loaded'].some(keyword => currentToast.title.toLowerCase().includes(keyword)))
  const isInfo = toastType === 'info' || toastType === 'blue' || !isSuccess

  return (
    <Toast
      key={currentToast.id}
      duration={currentToast.duration || 3000}
      viewportName={currentToast.viewportName}
      enterStyle={{ opacity: 0, scale: 0.5, y: -25 }}
      exitStyle={{ opacity: 0, scale: 1, y: -20 }}
      width={350}
      theme={isLoading ? "gray" : isError ? "red" : isInfo ? "gray" : "green"}
      rounded="$5"
      transition="quick"
      p="$3"

      borderWidth={1}
      borderColor="$borderColor"
    >
      <XStack gap="$3" items="center" px="$2">
        {isLoading ? (
          <SpinningLoader size={18} color="$color" />
        ) : isError ? (
          <AlertCircle size={18} strokeWidth={3} color="$red11" />
        ) : isInfo ? (
          <Info size={18} strokeWidth={3} color="$color" opacity={0.8} />
        ) : (
          <Check size={18} strokeWidth={3} color="$green12" />
        )}
        <YStack flex={1} justify="center">
          <Toast.Title fontWeight="700" fontSize="$4">{currentToast.title}</Toast.Title>
          {!!currentToast.message && (
            <Toast.Description color="$color" opacity={0.6} fontSize="$3" mt="$-1">
              {currentToast.message}
            </Toast.Description>
          )}
        </YStack>
      </XStack>
    </Toast>
  )
}

export function ToastControl() {
  const toast = useToastController()

  const showLoaderDemo = () => {
    const id = 'demo-loader'
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toast.show('Loading...', {
      id,
    })

    setTimeout(() => {
      toast.show('Loaded successfully!', {
        id,
      })
    }, 2000)
  }

  return (
    <YStack gap="$2" items="center">
      <H4>Toast demo</H4>
      <XStack gap="$2" justify="center" flexWrap="wrap">
        <Button
          onPress={() => {
            toast.show('Successfully saved!')
          }}
        >
          Simple Success
        </Button>

        <Button
          theme="blue"
          onPress={showLoaderDemo}
        >
          Show Loader
        </Button>

        <Button
          onPress={() => {
            toast.hide()
          }}
        >
          Hide
        </Button>
      </XStack>
    </YStack>
  )
}
