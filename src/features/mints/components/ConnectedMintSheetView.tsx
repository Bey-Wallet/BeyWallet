import React from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Copy,
  Info,
  Pencil,
  QrCode,
  RefreshCw,
  Trash2,
  X,
} from '~/shared/icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { appSpacing } from '~/shared/theme/appearance';
import { hapticService } from '~/services/platform/hapticService';
import { SettingsGroup, SettingsRow } from '~/features/settings/components/SettingsLayout';

export interface ConnectedMintSheetViewProps {
  name: string;
  url: string;
  icon: React.ReactNode;
  amount: string;
  unit?: string;
  secondary?: string | null;
  connection: string;
  offline: boolean;
  checking?: boolean;
  refreshDisabled?: boolean;
  units: string;
  payments: string;
  copied?: boolean;
  busy?: boolean;
  removeDisabled?: boolean;
  removeHint?: string;
  transferDisabled?: boolean;
  recoverDisabled?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  onTransfer: () => void;
  onRecover: () => void;
  onQr: () => void;
  onRename: () => void;
  onDetails: () => void;
  renameEditor?: { input: React.ReactNode; onSave: () => void; onCancel: () => void };
  children?: React.ReactNode;
}

/** The approved layout is shared by the live sheet and its isolated BUI preview. */
export function ConnectedMintSheetView(props: ConnectedMintSheetViewProps) {
  const action = (title: string, icon: React.ReactNode, onPress: () => void, disabled = false) => (
    <YStack flex={1}>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!(disabled || props.busy) }}
        minHeight={72}
        bg="$gray2"
        rounded="$6"
        overflow="hidden"
        pressStyle={{ bg: '$gray3' }}
        opacity={disabled || props.busy ? 0.48 : 1}
        onPress={() => {
          if (disabled || props.busy) return;
          hapticService.selection();
          onPress();
        }}
        disabled={disabled || props.busy}
      >
        <YStack
          minHeight={72}
          py={appSpacing.gap}
          gap={appSpacing.small}
          items="center"
          justify="center"
        >
          {icon}
          <AppText variant="label2" fontWeight="600">
            {title}
          </AppText>
        </YStack>
      </AppPressable>
    </YStack>
  );
  return (
    <>
      <XStack
        mx={-appSpacing.page}
        mt={-appSpacing.gap}
        px={appSpacing.page}
        minHeight={48}
        gap="$2"
        items="center"
      >
        <HeaderIconButton
          icon={props.renameEditor ? ArrowLeft : X}
          accessibilityLabel={props.renameEditor ? 'Cancel renaming' : 'Close mint sheet'}
          disabled={props.busy}
          onPress={props.renameEditor ? props.renameEditor.onCancel : props.onClose}
        />
        {props.renameEditor ? (
          <YStack flex={1} minWidth={0} minHeight={48} justify="center">
            {props.renameEditor.input}
            <AppText variant="body3" tone="secondary" numberOfLines={1} textAlign="center">
              {props.url}
            </AppText>
          </YStack>
        ) : (
          <YStack flex={1} minWidth={0} minHeight={48} justify="center">
            <AppPressable
              justify="center"
              accessibilityRole="button"
              accessibilityLabel={`Rename ${props.name}`}
              disabled={props.busy}
              onPress={props.onRename}
            >
              <XStack gap="$1" items="center" justify="center">
                <AppText variant="title3" numberOfLines={1} textAlign="center" flexShrink={1}>
                  {props.name}
                </AppText>
                <Pencil size={14} color="$gray10" />
              </XStack>
            </AppPressable>
            <AppPressable
              justify="center"
              accessibilityRole="button"
              accessibilityLabel="Copy mint URL"
              onPress={props.onCopy}
            >
              <XStack gap="$1" items="center" justify="center">
                <AppText
                  variant="body3"
                  tone="secondary"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  textAlign="center"
                  flexShrink={1}
                >
                  {props.url}
                </AppText>
                {props.copied ? (
                  <Check size={12} color="$gray10" />
                ) : (
                  <Copy size={12} color="$gray10" />
                )}
              </XStack>
            </AppPressable>
          </YStack>
        )}
        <HeaderIconButton
          icon={props.renameEditor ? Check : Trash2}
          accessibilityLabel={props.renameEditor ? 'Save mint name' : 'Remove mint'}
          accessibilityHint={props.renameEditor ? undefined : props.removeHint}
          loading={props.busy && !!props.renameEditor}
          disabled={props.busy || (!props.renameEditor && props.removeDisabled)}
          onPress={props.renameEditor ? props.renameEditor.onSave : props.onRemove}
        />
      </XStack>
      <YStack gap="$5" py="$4">
        <XStack gap="$4" items="center" justify="space-between">
          <YStack flex={1} minWidth={0} gap="$1">
            <XStack gap="$2" items="baseline" flexWrap="wrap">
              <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit flexShrink={1}>
                {props.amount}
              </AppText>
              {!!props.unit && <AppText tone="secondary">{props.unit}</AppText>}
            </XStack>
            {!!props.secondary && (
              <AppText variant="body1" tone="secondary">
                {props.secondary}
              </AppText>
            )}
          </YStack>
          <YStack
            width={72}
            height={72}
            rounded="$6"
            overflow="hidden"
            bg="$gray3"
            items="center"
            justify="center"
            flexShrink={0}
          >
            {props.icon}
          </YStack>
        </XStack>
        <XStack gap={appSpacing.compact} items="stretch" width="100%">
          {action(
            'Transfer',
            <ArrowRightLeft size={22} color="$color" />,
            props.onTransfer,
            props.transferDisabled,
          )}
          {action(
            'Recover',
            <RefreshCw size={22} color="$color" />,
            props.onRecover,
            props.recoverDisabled,
          )}
          {action('QR', <QrCode size={22} color="$color" />, props.onQr)}
        </XStack>
        <SettingsGroup>
          <XStack
            px={appSpacing.page}
            py={appSpacing.compact}
            minHeight={48}
            gap="$2"
            items="center"
          >
            <AppText variant="label1" flex={1}>
              Connection
            </AppText>
            <AppText tone="secondary" accessibilityLiveRegion="polite">
              {props.connection}
            </AppText>
            {(props.offline || props.checking) && (
              <HeaderIconButton
                icon={RefreshCw}
                accessibilityLabel="Refresh mint connection"
                loading={props.checking}
                disabled={props.refreshDisabled || props.busy || props.checking}
                onPress={props.onRefresh}
              />
            )}
          </XStack>
          <SettingsRow title="Units" value={props.units} />
          <XStack
            px={appSpacing.page}
            py={appSpacing.compact}
            minHeight={48}
            gap="$3"
            items="flex-start"
          >
            <AppText variant="label1" flexShrink={0}>
              Payments
            </AppText>
            <AppText flex={1} tone="secondary" textAlign="right">
              {props.payments}
            </AppText>
          </XStack>
        </SettingsGroup>
        {props.children}
        <SettingsGroup>
          <SettingsRow
            title="View full mint details"
            icon={Info}
            external
            disabled={props.busy}
            onPress={props.onDetails}
          />
        </SettingsGroup>
      </YStack>
    </>
  );
}
