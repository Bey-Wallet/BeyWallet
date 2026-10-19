import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { YStack, Text } from 'tamagui';
import {
  SettingsPage,
  SettingsGroup,
  SettingsDescription,
  SettingsMessage,
} from './components/SettingsLayout';
import { useSettingsBusy } from './hooks/useSettingsBusy';
import * as Updates from 'expo-updates';
import { DownloadCloud, RefreshCw, ArrowUpCircle } from '@tamagui/lucide-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
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
  const { downloadProgress } = Updates.useUpdates();
  const operationLock = useRef(false);
  useSettingsBusy(status === 'downloading');
  const [storedChangelog, setStoredChangelog] = useState<string[]>([]);
  const [storedVersion, setStoredVersion] = useState<string | null>(null);

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
    if (operationLock.current) return;
    operationLock.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStatus('downloading');
      await Updates.fetchUpdateAsync();

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
    } finally {
      operationLock.current = false;
    }
  };

  const handleRestart = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Updates.reloadAsync();
    } catch (e: any) {
      console.warn('[OtaUpdate] Reload failed:', e);
      setErrorMsg('Could not restart the app. Please try again.');
    }
  };

  // Parse changelog for the incoming update
  const incomingWhatsNewItems = useMemo(() => {
    if (!newManifest) return [];
    return parseChangelog(newManifest);
  }, [newManifest]);

  const currentVersionFeatures = storedChangelog;

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

  const title =
    status === 'checking'
      ? 'Checking for updates…'
      : status === 'downloading'
        ? 'Downloading update…'
        : status === 'ready'
          ? 'Update ready'
          : status === 'update-available'
            ? 'Update available'
            : status === 'error'
              ? 'Update check failed'
              : !Updates.isEnabled
                ? 'Updates unavailable in this build'
                : 'You’re up to date';
  return (
    <SettingsPage>
      <SettingsDescription>
        Keep Bey Wallet up to date. Downloads are applied when you restart the app.
      </SettingsDescription>
      <SettingsGroup>
        <YStack p="$4" gap="$2">
          <Text fontSize="$5" fontWeight="500" color="$color">
            Bey Wallet
          </Text>
          <Text fontSize="$3" color="$gray10">
            Version {appVersion} ({buildVersion}) · {channelName}
          </Text>
        </YStack>
        <YStack p="$4" gap="$2" accessibilityLiveRegion="polite">
          <Text fontSize="$5" fontWeight="500" color="$color">
            {title}
          </Text>
          {lastCheckedTime && (
            <Text fontSize="$3" color="$gray10">
              Last checked {lastCheckedTime}
            </Text>
          )}
          {status === 'downloading' && (
            <Text fontSize="$3" color="$gray10">
              {Math.round((downloadProgress ?? 0) * 100)}%
            </Text>
          )}
          {status === 'update-available' && (
            <Text fontSize="$3" color="$gray10">
              {newVersionString}
              {updateCreatedAt ? ' · ' + updateCreatedAt : ''}
            </Text>
          )}
        </YStack>
      </SettingsGroup>
      {errorMsg && <SettingsMessage error>{errorMsg}</SettingsMessage>}
      {status === 'ready' ? (
        <AppButton icon={ArrowUpCircle} onPress={handleRestart}>
          Restart to apply update
        </AppButton>
      ) : status === 'update-available' ? (
        <AppButton icon={DownloadCloud} onPress={handleDownload}>
          Download update
        </AppButton>
      ) : (
        <AppButton
          icon={RefreshCw}
          loading={status === 'checking' || status === 'downloading'}
          loadingText={status === 'downloading' ? 'Downloading update…' : 'Checking for updates…'}
          disabled={!Updates.isEnabled}
          onPress={() => handleCheckUpdates(true)}
        >
          Check for updates
        </AppButton>
      )}
      {(status === 'update-available' ? incomingWhatsNewItems : currentVersionFeatures).length >
        0 && (
        <YStack gap="$3">
          <Text fontSize="$5" fontWeight="500" color="$color">
            What’s new{storedVersion && status !== 'update-available' ? ' · ' + storedVersion : ''}
          </Text>
          <SettingsGroup>
            {(status === 'update-available' ? incomingWhatsNewItems : currentVersionFeatures).map(
              (item, index) => (
                <YStack key={index} p="$4">
                  <Text fontSize="$4" color="$color">
                    {item}
                  </Text>
                </YStack>
              ),
            )}
          </SettingsGroup>
        </YStack>
      )}
    </SettingsPage>
  );
}
