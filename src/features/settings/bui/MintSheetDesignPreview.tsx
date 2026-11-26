import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Keyboard } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Landmark } from '~/shared/icons';
import { YStack } from 'tamagui';
import { AppText } from '~/shared/ui/AppText';
import { AppButton } from '~/shared/ui/AppButton';
import { BUIChoices, BUISection, BUISheet, useBUITheme, type BUISheetRef } from '~/shared/ui/BUI';
import { useBUIStore } from '~/state/buiStore';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { hapticService } from '~/services/platform/hapticService';
import { ConnectedMintSheetView } from '~/features/mints/components/ConnectedMintSheetView';

const variants = ['Connected', 'Empty', 'Offline', 'Checking'] as const;
const sampleMintUrl = 'https://mint.example';

/** Design fixtures use the live layout without loading a wallet or making network requests. */
export function MintSheetDesignPreview() {
  const appearance = useBUIStore((state) => state.appearance);
  const colors = useBUITheme(appearance);
  const focused = useIsFocused();
  const sheet = useRef<BUISheetRef>(null);
  const [variant, setVariant] = useState<(typeof variants)[number]>('Connected');
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewRemoval, setReviewRemoval] = useState(false);
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('Everyday mint');
  const [draftName, setDraftName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const funded = variant !== 'Empty';
  useEffect(() => {
    if (!focused) {
      sheet.current?.dismiss();
      setVisible(false);
    }
  }, [focused]);
  useEffect(() => {
    if (visible) sheet.current?.present();
  }, [visible]);
  const open = () => {
    setEditingName(false);
    setCopied(false);
    setReviewRemoval(false);
    setNotice('');
    setVisible(true);
  };
  const copy = async () => {
    setNotice('');
    if (!(await copyWithFeedback(sampleMintUrl, { show: (title) => setNotice(title) }))) return;
    setCopied(true);
    hapticService.acknowledge();
  };
  return (
    <>
      <BUISection
        name="Mint sheet design"
        measurement="Connected mints only. Sample balances and actions."
      >
        <YStack px={16} gap={12}>
          <BUIChoices values={variants} value={variant} onChange={setVariant} />
          <AppButton size="large" onPress={open}>
            Preview mint sheet
          </AppButton>
        </YStack>
      </BUISection>
      {visible && (
        <BUISheet
          ref={sheet}
          appearance={appearance}
          title="Everyday mint"
          showHeader={false}
          onClose={() => setVisible(false)}
        >
          <ConnectedMintSheetView
            name={name}
            url={sampleMintUrl}
            icon={<Landmark size={32} color="$color" />}
            amount={funded ? '24,000' : '0'}
            unit="sat"
            secondary={funded ? '≈ $24.00' : '$0.00'}
            copied={copied}
            connection={
              variant === 'Offline' ? 'Offline' : variant === 'Checking' ? 'Checking…' : 'Online'
            }
            offline={variant === 'Offline'}
            checking={variant === 'Checking'}
            units="sat"
            payments="Lightning"
            removeDisabled={funded || reviewRemoval}
            removeHint={
              funded ? 'Transfer your balance before removing this mint' : 'Review removal'
            }
            onClose={() => sheet.current?.dismiss()}
            onCopy={() => void copy()}
            onRemove={() => {
              setReviewRemoval(true);
              setNotice('');
            }}
            onRefresh={() => setVariant('Connected')}
            onTransfer={() => setNotice('Transfer preview only. No funds moved.')}
            onRecover={() => setNotice('Recovery preview only. No recovery started.')}
            onQr={() => setNotice('QR preview only.')}
            onRename={() => {
              setDraftName(name);
              setEditingName(true);
              setNotice('');
            }}
            renameEditor={
              editingName
                ? {
                    input: (
                      <BottomSheetTextInput
                        accessibilityLabel="Mint name"
                        value={draftName}
                        onChangeText={setDraftName}
                        autoFocus
                        selectTextOnFocus
                        returnKeyType="done"
                        style={{
                          fontFamily: 'TikTokSansSemiBold',
                          fontSize: 18,
                          lineHeight: 25,
                          textAlign: 'center',
                          height: 32,
                          paddingVertical: 0,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          color: colors.text,
                          backgroundColor: colors.surface,
                        }}
                      />
                    ),
                    onSave: () => {
                      setName(draftName.trim() || 'Everyday mint');
                      setEditingName(false);
                      Keyboard.dismiss();
                    },
                    onCancel: () => {
                      setEditingName(false);
                      Keyboard.dismiss();
                    },
                  }
                : undefined
            }
            onDetails={() =>
              setNotice(
                'Full details preview only. Connected mints open their existing details screen.',
              )
            }
          >
            {reviewRemoval && (
              <YStack gap="$3">
                <AppText variant="title3">Remove this mint?</AppText>
                <AppText tone="secondary">Your transaction history stays in your wallet.</AppText>
                <AppButton variant="critical" onPress={() => sheet.current?.dismiss()}>
                  Remove mint
                </AppButton>
              </YStack>
            )}
            {!!notice && (
              <AppText tone="secondary" accessibilityLiveRegion="polite">
                {notice}
              </AppText>
            )}
          </ConnectedMintSheetView>
        </BUISheet>
      )}
    </>
  );
}
