import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import * as Network from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import { Text, YStack } from 'tamagui';
import { Copy, ExternalLink, RefreshCw, Share2 } from '@tamagui/lucide-icons';
import { AppButton } from '~/shared/ui/AppButton';
import { AppTextArea } from '~/shared/ui/AppInput';
import { AppText } from '~/shared/ui/AppText';
import { clearDiagnosticFailures } from '~/services/feedback/diagnosticFailures';
import {
  formatDiagnosticReport,
  sanitizeSupportText,
  type DiagnosticDetails,
  type DiagnosticSnapshot,
} from './diagnosticReport';
import { createDiagnosticSnapshot } from './diagnosticSnapshot';
import { settingsLinks } from './settingsCatalog';
import { useSettingsOperation } from './hooks/useSettingsOperation';
import {
  SettingsDescription,
  SettingsMessage,
  SettingsPage,
  SettingsSection,
  openSettingsLink,
} from './components/SettingsLayout';

const fields = [
  { key: 'happened', label: 'What happened?', placeholder: 'Describe the problem' },
  { key: 'expected', label: 'What did you expect?', placeholder: 'Expected behavior' },
  { key: 'steps', label: 'Steps to reproduce', placeholder: 'How can we reproduce it?' },
] as const;
const networkTypes = new Set([
  'NONE',
  'WIFI',
  'CELLULAR',
  'ETHERNET',
  'BLUETOOTH',
  'VPN',
  'WIMAX',
  'OTHER',
  'UNKNOWN',
]);

export function DiagnosticReportScreen() {
  const client = useQueryClient();
  const [snapshot, setSnapshot] = useState(() => createDiagnosticSnapshot(client));
  const [details, setDetails] = useState<DiagnosticDetails>({
    happened: '',
    expected: '',
    steps: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<'copy' | 'share' | 'issue' | null>(null);
  const actionLock = useRef(false);
  const active = useRef(false);
  const mounted = useRef(true);
  const task = useSettingsOperation();
  const perform = async (kind: 'copy' | 'share' | 'issue', job: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setAction(kind);
    try {
      await job();
    } finally {
      actionLock.current = false;
      if (mounted.current) setAction(null);
    }
  };
  const report = useMemo(() => formatDiagnosticReport(snapshot, details), [snapshot, details]);
  const refresh = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    setRefreshing(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let network: DiagnosticSnapshot['network'] = {
      connected: null,
      reachable: null,
      type: 'Unavailable',
    };
    try {
      const state = await Promise.race([
        Network.getNetworkStateAsync(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Network status unavailable')), 5000);
        }),
      ]);
      network = {
        connected: state.isConnected ?? null,
        reachable: state.isInternetReachable ?? null,
        type:
          typeof state.type === 'string' && networkTypes.has(state.type) ? state.type : 'UNKNOWN',
      };
    } catch {
      /* The rest of the report remains available without network details. */
    } finally {
      clearTimeout(timeout);
      active.current = false;
      if (mounted.current) {
        setSnapshot({ ...createDiagnosticSnapshot(client), network });
        setRefreshing(false);
      }
    }
  }, [client]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  return (
    <SettingsPage keyboardShouldPersistTaps="handled">
      <SettingsDescription>
        Preview device, update and connection health with sanitized failures from this session.
        Automatic diagnostics exclude keys, proofs, tokens, invoices, balances, contacts and URLs.
      </SettingsDescription>
      <SettingsSection title="Describe the issue">
        <SettingsDescription>
          Optional. Do not enter wallet secrets or personal information.
        </SettingsDescription>
        {fields.map(({ key, label, placeholder }) => (
          <YStack key={key} gap="$2">
            <AppText variant="label2">{label}</AppText>
            <AppTextArea
              accessibilityLabel={label}
              placeholder={placeholder}
              value={details[key]}
              minHeight={80}
              maxLength={1200}
              bg="$gray2"
              color="$color"
              textAlignVertical="top"
              onChangeText={(value) =>
                setDetails((previous) => ({ ...previous, [key]: sanitizeSupportText(value) }))
              }
            />
          </YStack>
        ))}
      </SettingsSection>
      <SettingsSection title="Report preview">
        <YStack bg="$gray2" rounded="$6" p="$4">
          <Text
            testID="diagnostic-report-preview"
            selectable
            fontFamily="$body"
            fontSize={13}
            color="$color"
          >
            {report}
          </Text>
        </YStack>
        <SettingsDescription>
          Mint checks are cached observations, not live probes. Failures clear on restart or wallet
          reset. Check History for payment outcomes. Nothing is sent automatically. Copy your report
          before opening a public GitHub issue.
        </SettingsDescription>
      </SettingsSection>
      <AppButton
        icon={Copy}
        loading={action === 'copy'}
        disabled={refreshing || task.busy}
        onPress={() => void perform('copy', () => task.copy(report))}
      >
        Copy diagnostic report
      </AppButton>
      <AppButton
        icon={Share2}
        emphasis="secondary"
        disabled={refreshing || task.busy}
        loading={action === 'share'}
        onPress={() =>
          void perform('share', () =>
            task.run(async () => {
              await Share.share({ message: report, title: 'Bey Wallet diagnostic report' });
              return '';
            }, 'Could not share the report. Try copying it instead.'),
          )
        }
      >
        Share report
      </AppButton>
      <AppButton
        icon={ExternalLink}
        emphasis="secondary"
        disabled={task.busy}
        loading={action === 'issue'}
        onPress={() =>
          void perform('issue', () =>
            task.run(async () => {
              await openSettingsLink(`${settingsLinks.support}/new`);
              return 'Paste your copied report into the issue. Review it before posting.';
            }, 'Could not open GitHub. Try again when connected.'),
          )
        }
      >
        Report an issue
      </AppButton>
      <AppButton
        icon={RefreshCw}
        emphasis="secondary"
        disabled={task.busy}
        loading={refreshing}
        loadingText="Refreshing report…"
        onPress={() => {
          task.clear();
          void refresh();
        }}
      >
        Refresh report
      </AppButton>
      {!!snapshot.failures?.length && (
        <AppButton
          size="small"
          emphasis="text"
          disabled={task.busy || refreshing}
          onPress={() => {
            task.clear();
            clearDiagnosticFailures();
            setSnapshot((previous) => ({ ...previous, capturedAt: Date.now(), failures: [] }));
          }}
        >
          Clear recent failures
        </AppButton>
      )}
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}
