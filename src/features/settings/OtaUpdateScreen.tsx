import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { YStack, XStack, Text, Button, Spinner, useTheme, View, ScrollView } from 'tamagui';
import * as Updates from 'expo-updates';
import {
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowUpCircle,
  Check,
} from '@tamagui/lucide-icons';
import { SafeFlex } from '~/shared/ui/Flex';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import BeyIcon from '~/shared/icons/BeyIcon';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '~/shared/theme/ThemeContext';
import { Stack } from 'expo-router';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

const STORAGE_KEY_LAST_OTA_CHANGELOG = 'last_installed_ota_changelog';
const STORAGE_KEY_LAST_OTA_VERSION = 'last_installed_ota_version';
const STORAGE_KEY_LAST_OTA_DATE = 'last_installed_ota_date';

const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.2.0';
const buildVersion =
  Application.nativeBuildVersion ??
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.expoConfig?.android?.versionCode?.toString() ??
  '1';

type UpdateStatus =
  'idle' | 'checking' | 'no-update' | 'update-available' | 'downloading' | 'ready' | 'error';

// Default changelog highlights for the base app version
const DEFAULT_VERSION_HIGHLIGHTS = [
  'Lightning-fast Cashu e-cash payments & instant mint settlement',
  'NFC Tap-to-Pay and contactless token exchange',
  'Multi-mint balance management and proof security',
  'Encrypted seed phrase backup and instant restore',
];

/**
 * Extracts and normalizes changelog / What's New items from any EAS manifest or string message.
 */
function parseChangelog(raw: any): string[] {
  if (!raw) return [];

  // If already an array
  if (Array.isArray(raw)) {
    return raw
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof raw === 'object') {
    const candidate =
      raw.message ||
      raw.metadata?.message ||
      raw.extra?.message ||
      raw.extra?.expoClient?.extra?.updatesMessage ||
      raw.extra?.expoClient?.extra?.message ||
      raw.extra?.expoClient?.updates?.message ||
      raw.extra?.expoClient?.description ||
      '';
    if (candidate && typeof candidate === 'string') {
      return parseChangelog(candidate);
    }
    return [];
  }

  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try parsing JSON format
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (Array.isArray(parsed.whatsNew)) return parsed.whatsNew.map(String).filter(Boolean);
      if (Array.isArray(parsed.changes)) return parsed.changes.map(String).filter(Boolean);
      if (typeof parsed.message === 'string') return parseChangelog(parsed.message);
    } catch {}
  }

  // Normalize literal escaped "\n" into actual newlines
  const normalized = trimmed.replace(/\\n/g, '\n');

  // Split by newlines or semicolons, and remove bullet symbols (- / * / • / numbers)
  const lines = normalized
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines : [trimmed];
}

export default function OtaUpdateScreen() {
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [newManifest, setNewManifest] = useState<any>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [storedChangelog, setStoredChangelog] = useState<string[]>([]);
  const [storedVersion, setStoredVersion] = useState<string | null>(null);
  const [storedDate, setStoredDate] = useState<string | null>(null);

  const theme = useTheme();
  const { resolvedTheme } = useAppTheme();

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Load previous/current update changelog from storage or running manifest
  useEffect(() => {
    try {
      // 1. Check running update manifest from Updates module
      const runningManifest = Updates.manifest;
      const runningParsed = parseChangelog(runningManifest);
      if (runningParsed.length > 0) {
        setStoredChangelog(runningParsed);
      } else {
        // 2. Check local SQLite storage for previously installed update
        const storedRaw = sqliteStorage.getItem(STORAGE_KEY_LAST_OTA_CHANGELOG);
        if (storedRaw) {
          const parsed = parseChangelog(storedRaw);
          if (parsed.length > 0) {
            setStoredChangelog(parsed);
          }
        }
      }

      const version = sqliteStorage.getItem(STORAGE_KEY_LAST_OTA_VERSION);
      if (version) setStoredVersion(version);

      const dateStr = sqliteStorage.getItem(STORAGE_KEY_LAST_OTA_DATE);
      if (dateStr) setStoredDate(dateStr);
    } catch (e) {
      console.warn('[OtaUpdate] Error reading stored update notes:', e);
    }
  }, []);

  const handleCheckUpdates = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setStatus('checking');
      setErrorMsg('');

      // In development or when expo-updates is not enabled
      if (!Updates.isEnabled) {
        setLastCheckedTime(formatCurrentTime());
        setStatus('no-update');
        return;
      }

      const check = await Updates.checkForUpdateAsync();
      setLastCheckedTime(formatCurrentTime());

      if (check.isAvailable && check.manifest) {
        setNewManifest(check.manifest);
        setStatus('update-available');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStatus('no-update');
      }
    } catch (error: any) {
      console.error('[OtaUpdate] Check failed:', error);
      setStatus('error');
      setErrorMsg(
        error.message || 'Failed to check for updates. Please check your internet connection.',
      );
      setLastCheckedTime(formatCurrentTime());
    }
  }, []);

  // Automatically check for OTA updates on mount
  useEffect(() => {
    handleCheckUpdates(false);
  }, [handleCheckUpdates]);

  const handleDownload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStatus('downloading');
      setDownloadProgress(20);

      // Smooth progress animation while downloading bundle
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return prev + 15;
        });
      }, 300);

      const fetchResult = await Updates.fetchUpdateAsync();
      clearInterval(progressInterval);
      setDownloadProgress(100);

      // Persist the incoming update changelog into sqliteStorage
      if (newManifest) {
        const rawMessage =
          newManifest.message ||
          newManifest.metadata?.message ||
          newManifest.extra?.message ||
          newManifest.extra?.expoClient?.extra?.updatesMessage ||
          '';
        if (rawMessage) {
          sqliteStorage.setItem(STORAGE_KEY_LAST_OTA_CHANGELOG, rawMessage);
        }
        const version =
          newManifest.metadata?.version || newManifest.extra?.expoClient?.version || appVersion;
        sqliteStorage.setItem(STORAGE_KEY_LAST_OTA_VERSION, `v${version}`);

        if (newManifest.createdAt) {
          sqliteStorage.setItem(
            STORAGE_KEY_LAST_OTA_DATE,
            new Date(newManifest.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          );
        }
      }

      setStatus('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error('[OtaUpdate] Download failed:', error);
      setStatus('error');
      setErrorMsg(error.message || 'Failed to download update bundle.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRestart = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Updates.reloadAsync();
    } catch (e: any) {
      console.warn('[OtaUpdate] Reload failed:', e);
    }
  };

  // Parse changelog for the incoming update
  const incomingWhatsNewItems = useMemo(() => {
    if (!newManifest) return [];
    return parseChangelog(newManifest);
  }, [newManifest]);

  // Features list for the current/previous update (fallback to base highlights)
  const currentVersionFeatures = useMemo(() => {
    if (storedChangelog.length > 0) {
      return storedChangelog;
    }
    return DEFAULT_VERSION_HIGHLIGHTS;
  }, [storedChangelog]);

  // Format incoming new version if available
  const newVersionString = useMemo(() => {
    if (!newManifest) return '';
    const version = newManifest.metadata?.version || newManifest.extra?.expoClient?.version || '';
    return version ? `v${version}` : '';
  }, [newManifest]);

  const updateCreatedAt = useMemo(() => {
    if (!newManifest?.createdAt) return null;
    try {
      const d = new Date(newManifest.createdAt);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [newManifest]);

  const channelName = Updates.channel || (Updates.isEnabled ? 'Release' : 'Standard');

  return (
    <SafeFlex fill bg="$background" px="$4">
      <Stack.Screen
        options={{
          title: 'App Updates',
          headerTitleAlign: 'center',
        }}
      />

      <YStack flex={1} justify="space-between" py="$3" gap="$4">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingBottom: 20 }}
        >
          {/* Top App Header Card */}
          <XStack items="center" gap="$3.5" rounded="$5">
            <View p="$3" bg="$gray3" rounded="$5" items="center" justify="center">
              <BeyIcon size={34} color={resolvedTheme === 'dark' ? 'white' : 'black'} />
            </View>
            <YStack flex={1} gap="$1">
              <XStack items="center" justify="space-between">
                <Text fontSize="$5" fontWeight="900" color="$color">
                  Bey Wallet
                </Text>
                <XStack bg="$gray4" px="$2.5" py="$1.5" rounded="$10">
                  <Text fontSize={10} fontWeight="800" color="$gray11" textTransform="uppercase">
                    {channelName}
                  </Text>
                </XStack>
              </XStack>
              <Text fontSize="$2" color="$gray10" fontWeight="600">
                Current Version: v{appVersion} ({buildVersion})
              </Text>
            </YStack>
          </XStack>

          {/* Status Section */}
          {status === 'idle' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
              <YStack gap="$4" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <RefreshCw size={28} color="$color" />
                </View>
                <YStack flex={1} gap="$2" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Check for Updates
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    See if a new over-the-air release is available for Bey Wallet.
                  </Text>
                </YStack>
              </YStack>
              <YStack flex={1} items="center">
                <Button
                  size="$3"
                  rounded="$10"
                  fontWeight="700"
                  icon={<RefreshCw size={12} />}
                  onPress={() => handleCheckUpdates(true)}
                >
                  Check Now
                </Button>
              </YStack>
            </YStack>
          )}

          {status === 'checking' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
              <YStack gap="$4" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <Spinner size="small" color="$color" />
                </View>
                <YStack flex={1} gap="$2" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Checking for Updates...
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    Connecting to the update server to check for new releases.
                  </Text>
                </YStack>
              </YStack>
            </YStack>
          )}

          {status === 'no-update' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$3">
              <YStack gap="$3" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <Check size={28} color="$color" />
                </View>
                <YStack flex={1} gap="$1.5" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Your App is Up to Date
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    You are running the latest version available.
                  </Text>
                  {lastCheckedTime && (
                    <Text fontSize={11} color="$gray9" fontWeight="600" mt="$1">
                      Last checked today at {lastCheckedTime}
                    </Text>
                  )}
                </YStack>
              </YStack>
            </YStack>
          )}

          {status === 'update-available' && (
            <YStack gap="$4">
              <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
                <YStack gap="$4" items="center">
                  <View p="$3" bg="$gray4" rounded="$4">
                    <Sparkles size={28} color="$color" />
                  </View>
                  <YStack flex={1} gap="$2" items="center">
                    <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                      New Update Available {newVersionString}
                    </Text>
                    <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                      A new over-the-air update is ready to download and install.
                    </Text>
                    {updateCreatedAt && (
                      <Text fontSize="$1" color="$gray10" fontWeight="600">
                        Released {updateCreatedAt}
                      </Text>
                    )}
                  </YStack>
                </YStack>
              </YStack>

              {/* What's New in this Update */}
              <YStack gap="$2">
                <Text
                  fontSize="$2"
                  fontWeight="800"
                  color="$gray10"
                  textTransform="uppercase"
                  px="$1"
                >
                  What's New in this Update
                </Text>

                <ListTable width="100%">
                  {incomingWhatsNewItems.map((item, idx) => (
                    <ListTableRow
                      key={idx}
                      label={item}
                      icon={Sparkles}
                      iconColor="$accent10"
                      multiline
                    />
                  ))}
                </ListTable>
              </YStack>
            </YStack>
          )}

          {status === 'downloading' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
              <YStack gap="$4" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <Spinner size="small" color="$color" />
                </View>
                <YStack flex={1} gap="$2" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Downloading Update...
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    {downloadProgress < 50
                      ? 'Fetching update bundle from server...'
                      : 'Verifying and preparing update assets...'}
                  </Text>
                </YStack>
              </YStack>
              <YStack width="100%" gap="$2">
                <View width="100%" height={6} bg="$gray4" rounded="$10" overflow="hidden">
                  <View height="100%" width={`${downloadProgress}%`} bg="$color" rounded="$10" />
                </View>
                <Text fontSize="$1" color="$gray10" fontWeight="700" textAlign="center">
                  {downloadProgress}%
                </Text>
              </YStack>
            </YStack>
          )}

          {status === 'ready' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
              <YStack gap="$4" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <CheckCircle2 size={28} color="$color" />
                </View>
                <YStack flex={1} gap="$2" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Update Ready to Apply
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    The update bundle has been downloaded. Restart Bey Wallet to apply the changes.
                  </Text>
                </YStack>
              </YStack>
              <YStack flex={1} items="center">
                <Button
                  size="$3"
                  rounded="$10"
                  fontWeight="700"
                  icon={<ArrowUpCircle size={12} />}
                  onPress={handleRestart}
                >
                  Restart App
                </Button>
              </YStack>
            </YStack>
          )}

          {status === 'error' && (
            <YStack bg="$gray2" p="$5" rounded="$5" gap="$4">
              <YStack gap="$4" items="center">
                <View p="$3" bg="$gray4" rounded="$4">
                  <AlertCircle size={28} color="$color" />
                </View>
                <YStack flex={1} gap="$2" items="center">
                  <Text fontSize="$4" fontWeight="800" color="$color" textAlign="center">
                    Check Failed
                  </Text>
                  <Text fontSize="$2" color="$gray10" fontWeight="500" textAlign="center">
                    {errorMsg}
                  </Text>
                </YStack>
              </YStack>
              <YStack flex={1} items="center">
                <Button
                  size="$3"
                  rounded="$10"
                  fontWeight="700"
                  icon={<RefreshCw size={12} />}
                  onPress={() => handleCheckUpdates(true)}
                >
                  Try Again
                </Button>
              </YStack>
            </YStack>
          )}

          {/* Current / Previous Version Highlights Section (Shown when Up to Date, Idle, Checking, or Error) */}
          {(status === 'no-update' ||
            status === 'idle' ||
            status === 'checking' ||
            status === 'error') && (
            <YStack gap="$2.5">
              <XStack items="center" justify="space-between" px="$1">
                <Text fontSize="$2" fontWeight="800" color="$gray10" textTransform="uppercase">
                  {storedVersion
                    ? `What's New in ${storedVersion}`
                    : `What's New in v${appVersion}`}
                </Text>
                {storedDate && (
                  <Text fontSize={11} color="$gray9" fontWeight="600">
                    {storedDate}
                  </Text>
                )}
              </XStack>

              <ListTable width="100%">
                {currentVersionFeatures.map((item, idx) => (
                  <ListTableRow
                    key={idx}
                    label={item}
                    icon={Sparkles}
                    iconColor="$accent10"
                    multiline
                  />
                ))}
              </ListTable>
            </YStack>
          )}
        </ScrollView>

        {/* Bottom Action Buttons */}
        <YStack gap="$2" width="100%">
          {(status === 'idle' || status === 'no-update' || status === 'error') && (
            <Button
              theme="accent"
              size="$5"
              height={52}
              rounded="$5"
              fontWeight="800"
              onPress={() => handleCheckUpdates(true)}
              icon={<RefreshCw size={18} color="white" />}
              disabled={status === 'checking'}
            >
              Check for Updates
            </Button>
          )}

          {status === 'update-available' && (
            <Button
              theme="accent"
              size="$5"
              height={52}
              rounded="$5"
              fontWeight="800"
              onPress={handleDownload}
              icon={<DownloadCloud size={20} color="white" />}
            >
              Download & Install
            </Button>
          )}

          {status === 'ready' && (
            <Button
              theme="accent"
              size="$5"
              height={52}
              rounded="$5"
              fontWeight="800"
              onPress={handleRestart}
              icon={<ArrowUpCircle size={20} color="white" />}
            >
              Restart App to Apply
            </Button>
          )}
        </YStack>
      </YStack>
    </SafeFlex>
  );
}
