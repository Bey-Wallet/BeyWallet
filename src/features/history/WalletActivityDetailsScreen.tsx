import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Text, YStack } from 'tamagui';
import {
  getWalletActivity,
  getOptimizationReceiptId,
  hideWalletActivity,
  subscribeWalletActivity,
} from '~/services/wallet/walletActivityService';
import { eventService } from '~/services/wallet/eventService';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppTextButton } from '~/shared/ui/AppTextButton';
import { useReceiptSheet } from '~/shared/ui/ReceiptSheetContext';
import { TransactionReceiptSheet } from './components/TransactionReceiptSheet';
import { ReceiptExtraDetails } from './components/ReceiptExtraDetails';
import { walletActivityStatus, walletActivityTitle } from './walletActivityPresentation';
import type { WalletActivity } from '~/storage/sqlite/repositories/WalletActivityRepository';
import { useSettingsStore } from '~/state/settingsStore';

const sats = (value: number | null) =>
  value == null ? 'Unavailable' : `${value.toLocaleString()} sats`;

function ActivityContent({
  activity,
  failed,
  retry,
}: {
  activity?: WalletActivity | null;
  failed: boolean;
  retry: () => void;
}) {
  const router = useRouter();
  const receipt = useReceiptSheet();
  if (!activity)
    return (
      <YStack gap="$3">
        <PaymentFlowHeader title="Wallet activity" navigationAction="close" />
        <Text color="$gray10">
          {failed
            ? 'Could not load this activity. Try again.'
            : 'This activity is no longer available.'}
        </Text>
        {failed && <AppTextButton onPress={retry}>Try again</AppTextButton>}
      </YStack>
    );
  const needsReview = activity.state === 'review' || activity.state === 'pending';
  const navigate = async () => {
    // Replace this receipt so navigating back never reopens a stale sheet.
    if (activity.kind === 'get-change') router.replace('/(tabs)/settings/get-change');
    else if (activity.kind === 'recovery') router.replace('/(tabs)/settings/recover-funds');
    else {
      try {
        const id = await getOptimizationReceiptId(activity);
        if (id) router.replace({ pathname: '/txn-details', params: { id } });
        else
          Alert.alert(
            'Saved payment unavailable',
            'Open Proofs to review this mint before starting another optimization.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'View proofs', onPress: () => router.replace('/(modals)/proofs') },
            ],
          );
      } catch {
        Alert.alert('Could not load the saved operation', 'Try again.');
      }
    }
  };
  return (
    <YStack gap="$3" pb="$3">
      <PaymentFlowHeader title={walletActivityTitle(activity)} navigationAction="close" />
      {needsReview && (
        <Text color="$gray10" accessibilityLiveRegion="polite">
          {activity.kind === 'recovery'
            ? 'Recovery is not complete. Review the recovery screen for each mint’s status.'
            : 'The final outcome needs checking. Review the saved operation before starting another one.'}
        </Text>
      )}
      <ListTable variant="outlined">
        <ListTableRow label="Status" value={walletActivityStatus(activity.state)} />
        <ListTableRow label="Date" value={new Date(activity.createdAt).toLocaleString()} />
        {activity.mintUrls.map((url) => (
          <ListTableRow key={url} label="Mint" value={url} multiline />
        ))}
        {activity.inputAmount != null && (
          <ListTableRow label="Input amount" value={sats(activity.inputAmount)} />
        )}
        {activity.kind !== 'recovery' && <ListTableRow label="Fee" value={sats(activity.fee)} />}
        {activity.kind !== 'recovery' && (
          <ListTableRow
            label="Balance change"
            value={
              activity.balanceDelta == null
                ? 'Unavailable'
                : activity.balanceDelta === 0
                  ? 'No change'
                  : sats(activity.balanceDelta)
            }
          />
        )}
        {activity.beforeCount != null && (
          <ListTableRow label="Proofs before" value={activity.beforeCount} />
        )}
        {activity.afterCount != null && (
          <ListTableRow label="Proofs after" value={activity.afterCount} />
        )}
        {activity.kind === 'recovery' && (
          <ListTableRow
            label="Mints completed"
            value={`${activity.completedCount ?? 0} of ${activity.totalCount ?? 0}`}
          />
        )}
        {activity.kind === 'recovery' && (
          <ListTableRow label="Observed balance" value={sats(activity.observedBalance)} />
        )}
      </ListTable>
      {activity.kind === 'recovery' && (
        <Text color="$gray10" fontSize={12}>
          Observed balance includes existing funds. It is not a newly received payment.
        </Text>
      )}
      {activity.kind === 'optimize' && (
        <Text color="$gray10" fontSize={12}>
          This groups the internal send and receive. The saved operation does not establish an exact
          fee.
        </Text>
      )}
      <ReceiptExtraDetails
        fields={[
          { label: 'Activity ID', value: activity.id, copyValue: activity.id },
          ...(activity.operationId
            ? [
                {
                  label: 'Operation ID',
                  value: activity.operationId,
                  copyValue: activity.operationId,
                },
              ]
            : []),
        ]}
      />
      {needsReview && (
        <AppTextButton onPress={navigate}>
          {activity.kind === 'optimize' && !activity.operationId
            ? 'View proofs'
            : 'Review operation'}
        </AppTextButton>
      )}
      {!needsReview && (
        <AppTextButton
          onPress={() =>
            Alert.alert(
              'Remove from History?',
              'This only hides the activity. Your funds and recovery records are kept.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    void hideWalletActivity(activity.id)
                      .then(() => receipt?.close())
                      .catch(() => Alert.alert('Could not remove activity', 'Try again.'));
                  },
                },
              ],
            )
          }
        >
          Remove from History
        </AppTextButton>
      )}
    </YStack>
  );
}

export default function WalletActivityDetailsScreen() {
  return (
    <BottomSheetModalProvider>
      <ActivityDetails />
    </BottomSheetModalProvider>
  );
}

function ActivityDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = useSettingsStore((state) => state.npub);
  const query = useQuery({
    queryKey: ['wallet-activity', wallet, id],
    queryFn: async () => (await getWalletActivity(id)) ?? null,
    enabled: typeof id === 'string',
  });
  useEffect(
    () =>
      subscribeWalletActivity(() => {
        void query.refetch();
      }),
    [query.refetch],
  );
  useEffect(
    () =>
      eventService.on('proofs:saved', () => {
        void query.refetch();
      }),
    [query.refetch],
  );
  return (
    <TransactionReceiptSheet
      ready={!query.isLoading}
      active={query.data?.state === 'review' || query.data?.state === 'pending'}
    >
      <ActivityContent
        activity={query.data}
        failed={query.isError}
        retry={() => {
          void query.refetch();
        }}
      />
    </TransactionReceiptSheet>
  );
}
