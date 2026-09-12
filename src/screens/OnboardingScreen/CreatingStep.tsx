import React, { useEffect, useState } from 'react';
import { YStack, Text, H2, View, Spinner } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';
import { useAppTheme } from '../../context/ThemeContext';

interface CreatingStepProps {
  onComplete: (mnemonic: string) => void;
  generateMnemonic: () => string;
}

type ProgressStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
};

export function CreatingStep({ onComplete, generateMnemonic }: CreatingStepProps) {
  const { resolvedTheme } = useAppTheme();
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: 'entropy', label: 'Gathering entropy', status: 'pending' },
    { id: 'seed', label: 'Generating seed phrase', status: 'pending' },
    { id: 'keys', label: 'Deriving keys', status: 'pending' },
    { id: 'secure', label: 'Securing wallet', status: 'pending' },
  ]);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runCreation = async () => {
      // Step 1: Gathering entropy
      setSteps((prev) => prev.map((s) => (s.id === 'entropy' ? { ...s, status: 'active' } : s)));
      await delay(800);
      if (cancelled) return;
      setSteps((prev) => prev.map((s) => (s.id === 'entropy' ? { ...s, status: 'complete' } : s)));

      // Step 2: Generating seed phrase
      setSteps((prev) => prev.map((s) => (s.id === 'seed' ? { ...s, status: 'active' } : s)));
      await delay(600);
      const generatedMnemonic = generateMnemonic();
      setMnemonic(generatedMnemonic);
      if (cancelled) return;
      setSteps((prev) => prev.map((s) => (s.id === 'seed' ? { ...s, status: 'complete' } : s)));

      // Step 3: Deriving keys
      setSteps((prev) => prev.map((s) => (s.id === 'keys' ? { ...s, status: 'active' } : s)));
      await delay(700);
      if (cancelled) return;
      setSteps((prev) => prev.map((s) => (s.id === 'keys' ? { ...s, status: 'complete' } : s)));

      // Step 4: Securing wallet
      setSteps((prev) => prev.map((s) => (s.id === 'secure' ? { ...s, status: 'active' } : s)));
      await delay(500);
      if (cancelled) return;
      setSteps((prev) => prev.map((s) => (s.id === 'secure' ? { ...s, status: 'complete' } : s)));

      // All done - proceed after brief pause
      await delay(400);
      if (cancelled) return;
      if (generatedMnemonic) {
        onComplete(generatedMnemonic);
      }
    };

    runCreation();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <YStack flex={1} bg="$background" px="$4" py="$6" justify="center" items="center">
      <YStack gap="$8" items="center" width="100%" maxWidth={320}>
        <YStack items="center" gap="$2">
          <H2 fontSize="$7" fontWeight="700" color="$color">
            Creating Your Wallet
          </H2>
          <Text color="$gray10" fontSize="$3">
            Please wait...
          </Text>
        </YStack>

        {/* Progress Steps */}
        <YStack gap="$4" width="100%">
          {steps.map((step, index) => (
            <YStack key={step.id} gap="$2">
              <View flexDirection="row" items="center" gap="$3">
                {/* Status indicator */}
                <View
                  width={32}
                  height={32}
                  rounded="$10"
                  bg={
                    step.status === 'complete'
                      ? '$green9'
                      : step.status === 'active'
                        ? '$blue9'
                        : '$gray5'
                  }
                  items="center"
                  justify="center"
                >
                  {step.status === 'complete' ? (
                    <Check size={18} color="white" />
                  ) : step.status === 'active' ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Text color="$gray8" fontSize="$3" fontWeight="600">
                      {index + 1}
                    </Text>
                  )}
                </View>

                {/* Label */}
                <Text
                  color={step.status === 'pending' ? '$gray9' : '$color'}
                  fontSize="$4"
                  fontWeight={step.status === 'active' ? '600' : '400'}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <View
                  width={2}
                  height={16}
                  bg={steps[index + 1]?.status !== 'pending' ? '$green9' : '$gray5'}
                  marginLeft={15}
                />
              )}
            </YStack>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
