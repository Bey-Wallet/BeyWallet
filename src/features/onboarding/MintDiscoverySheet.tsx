import React, { forwardRef, useRef, useState } from 'react';
import { YStack, Separator } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { Spinner } from '~/shared/ui/Spinner';
import { BUICheckboxVisual } from '~/shared/ui/BUI/BUISelectionControl';
import { MintTrustContent } from '~/features/mints/components/MintTrustContent';
import { MintIcon } from '~/features/explore/components/MintIcon';
import { useMintDiscovery } from '~/features/mints/hooks/useMintDiscovery';
import type { MintRecommendation } from '~/services/api/mintRecommendationService';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { appSpacing } from '~/shared/theme/appearance';

export type OnboardingMint = Pick<MintRecommendation, 'url' | 'name'>;

export const MintDiscoverySheet = forwardRef<
  AppBottomSheetRef,
  { onConfirm: (mints: OnboardingMint[]) => void; selected: OnboardingMint[] }
>(function MintDiscoverySheet({ onConfirm, selected }, ref) {
  const discovery = useMintDiscovery();
  const [stage, setStage] = useState<'discover' | 'trust'>('discover');
  const [selection, setSelection] = useState<OnboardingMint[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const wasOpen = useRef(false);
  const mints = Array.from(
    new Map((discovery.data ?? []).map((mint) => [mintUrlKey(mint.url), mint])).values(),
  );

  return (
    <AppBottomSheet
      ref={ref}
      title={stage === 'discover' ? 'Discover mints' : 'Trust these mints?'}
      navigation={stage === 'trust' ? 'back' : 'close'}
      onNavigate={stage === 'trust' ? () => setStage('discover') : undefined}
      footer={
        stage === 'discover' ? (
          <AppButton
            size="large"
            emphasis="primary"
            disabled={selection.length === 0}
            onPress={() => {
              setAcknowledged(false);
              setStage('trust');
            }}
          >
            {selection.length
              ? `Add ${selection.length} ${selection.length === 1 ? 'mint' : 'mints'}`
              : 'Add mints'}
          </AppButton>
        ) : undefined
      }
      onOpenChange={(open) => {
        if (open && !wasOpen.current) {
          setStage('discover');
          setSelection(selected);
          setAcknowledged(false);
        }
        wasOpen.current = open;
      }}
    >
      <YStack gap={appSpacing.group}>
        {stage === 'discover' ? (
          <>
            <AppText tone="secondary">Choose the mints you want to connect to your wallet.</AppText>
            {discovery.isLoading && <Spinner size="large" />}
            {discovery.isError && (
              <YStack gap="$3">
                <AppText tone="error" accessibilityRole="alert">
                  Could not discover mints.
                </AppText>
                <AppButton
                  size="medium"
                  emphasis="secondary"
                  onPress={() => void discovery.refetch()}
                >
                  Try again
                </AppButton>
              </YStack>
            )}
            {!discovery.isLoading && !discovery.isError && mints.length === 0 && (
              <YStack gap="$3">
                <AppText tone="secondary">No mints found. Try again when connected.</AppText>
                <AppButton
                  size="medium"
                  emphasis="secondary"
                  onPress={() => void discovery.refetch()}
                >
                  Try again
                </AppButton>
              </YStack>
            )}
            <YStack bg="$gray2" rounded="$6" overflow="hidden">
              {mints.map((mint, index) => {
                const checked = selection.some(
                  (item) => mintUrlKey(item.url) === mintUrlKey(mint.url),
                );
                const name = mint.name || new URL(mint.url).hostname;
                return (
                  <React.Fragment key={mintUrlKey(mint.url)}>
                    {index > 0 && <Separator borderWidth={0} height={2} bg="$background" />}
                    <AppPressable
                      minHeight={48}
                      p="$3"
                      flexDirection="row"
                      items="center"
                      gap="$3"
                      pressStyle={{ bg: '$gray3' }}
                      accessibilityRole="checkbox"
                      accessibilityLabel={name}
                      accessibilityState={{ checked }}
                      onPress={() => {
                        setAcknowledged(false);
                        setSelection((current) =>
                          checked
                            ? current.filter(
                                (item) => mintUrlKey(item.url) !== mintUrlKey(mint.url),
                              )
                            : [...current, { url: mint.url, name }],
                        );
                      }}
                    >
                      <MintIcon url={mint.url} hintIcon={mint.icon} size={40} />
                      <YStack flex={1} gap="$1">
                        <AppText variant="label1">{name}</AppText>
                        <AppText tone="secondary">{mint.url}</AppText>
                      </YStack>
                      <BUICheckboxVisual checked={checked} />
                    </AppPressable>
                  </React.Fragment>
                );
              })}
            </YStack>
          </>
        ) : (
          <MintTrustContent
            mints={selection}
            acknowledgment={{ checked: acknowledged, onCheckedChange: setAcknowledged }}
            onConfirm={() => onConfirm(selection)}
          />
        )}
      </YStack>
    </AppBottomSheet>
  );
});
