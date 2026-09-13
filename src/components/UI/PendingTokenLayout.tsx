import React, { useEffect, useState, useRef } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Separator,
  View,
  ScrollView,
  useTheme,
  YGroup,
} from 'tamagui';
import {
  Copy,
  Share2,
  Check,
  RotateCcw,
  Gauge,
  ArrowDownLeft,
  Nfc,
  Globe,
  ChevronRight,
  UsersRound,
  Clock,
  AlertCircle,
  X,
  Send,
} from '@tamagui/lucide-icons';
import { Buffer } from 'buffer';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare, Platform } from 'react-native';
import { useToastController } from '@tamagui/toast';
import * as Linking from 'expo-linking';

import { Spinner } from './Spinner';
import { Stack, router } from 'expo-router';

import { UR, UREncoder } from '@gandlaf21/bc-ur';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import {
  cleanToken,
  decodeToken,
  encodeTokenV4,
  encodeTokenV3,
  mintManager,
} from '~/services/core';
import { nip19 } from 'nostr-tools';
import { nfcService } from '~/services/nfcService';
import { ProcessingSheet, ProcessingStatus } from './ProcessingSheet';
import { useAuthStore } from '~/store/authStore';
import { StatusBadge, BadgeStatus } from './StatusBadge';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';

export interface PendingTokenLayoutProps {
  token: string;
  amount: number | string;
  fee?: number;
  mintUrl?: string;
  onReclaim?: () => void | Promise<void>;
  isReclaiming?: boolean;
  lockedToNpub?: string | null;
  hideDetails?: boolean;
  hideActions?: boolean;
  onClaim?: () => void | Promise<void>;
  isClaiming?: boolean;
  onNfcPress?: () => void;
  expiresAt?: number;
  /** Controls the status badge color in the header. Defaults to 'pending'. */
  headerStatus?: BadgeStatus;
  /** Called when the status badge is tapped. */
  onCheckStatus?: () => void | Promise<void>;
  /** Shows spinner on the badge while a status check is in-flight. */
  isCheckingStatus?: boolean;
  customHeaderRight?: () => React.ReactNode;
}

export function PendingTokenLayout({
  token,
  amount,
  fee = 0,
  mintUrl,
  onReclaim,
  isReclaiming = false,
  lockedToNpub,
  hideDetails = false,
  hideActions = false,
  onClaim,
  isClaiming = false,
  onNfcPress,
  expiresAt,
  headerStatus = 'pending',
  onCheckStatus,
  isCheckingStatus = false,
  customHeaderRight,
}: PendingTokenLayoutProps) {
  const toast = useToastController();
  const { primaryCurrency, secondaryCurrency, npub } = useSettingsStore();
  const theme = useTheme();
  const { setLockDisabled } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [currentToken, setCurrentToken] = useState<string>(token || '');
  const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
  const [showAnimatedQR, setShowAnimatedQR] = useState(true);
  const [fragmentLength, setFragmentLength] = useState(150);
  const [intervalMs, setIntervalMs] = useState(150);
  const encoderRef = useRef<UREncoder | null>(null);
  const shareSheetRef = useRef<AppBottomSheetRef>(null);
  const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(
    token?.startsWith('cashuB') ? 'V4' : 'V3',
  );

  const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeftStr(null);
      return;
    }

    const updateTime = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('Expired');
      } else {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        const secs = Math.floor((diff % (60 * 1000)) / 1000);

        if (hours > 0) {
          setTimeLeftStr(`${hours}h ${mins}m left`);
        } else if (mins > 0) {
          setTimeLeftStr(`${mins}m ${secs}s left`);
        } else {
          setTimeLeftStr(`${secs}s left`);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const [parsedNpub, setParsedNpub] = useState<string | null>(lockedToNpub || null);

  const MAX_STATIC_QR_LENGTH = 1000;

  const [showNfcSheet, setShowNfcSheet] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<ProcessingStatus>('processing');
  const [nfcMessage, setNfcMessage] = useState('Preparing to send...');
  const [nfcError, setNfcError] = useState<string | undefined>(undefined);
  const simulationRef = useRef<any>(null);

  const handleNfcShare = () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/nfc-send',
      params: {
        token: currentToken,
        amount: String(amount),
        mintUrl: mintUrl || '',
      },
    });
  };

  const handleWriteToTag = async () => {
    if (simulationRef.current) {
      await nfcService.stopHceSimulation(simulationRef.current);
      simulationRef.current = null;
    }
    setNfcStatus('processing');
    setNfcMessage('Approach physical tag to write...');
    try {
      await nfcService.writeNdefTag(currentToken);
      setNfcStatus('success');
      setNfcMessage('Token written to tag!');
    } catch (e: any) {
      console.error('NFC write error:', e);
      setNfcStatus('error');
      setNfcMessage('NFC Write Failed');
      setNfcError(e.message || 'An error occurred during NFC transmission.');
    }
  };

  const handleCloseNfc = async () => {
    setShowNfcSheet(false);
    if (simulationRef.current) {
      await nfcService.stopHceSimulation(simulationRef.current);
      simulationRef.current = null;
    }
  };

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const fiatValue = React.useMemo(() => {
    if (!btcData?.price) return '...';
    return currencyService.formatValue(
      currencyService.convertSatsToCurrency(Number(amount), btcData.price),
      secondaryCurrency as CurrencyCode,
    );
  }, [amount, btcData?.price, secondaryCurrency]);

  useEffect(() => {
    if (token && token !== currentToken) {
      setCurrentToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!currentToken || currentToken.startsWith('http')) return;

    try {
      const clean = cleanToken(currentToken);
      const decoded = decodeToken(clean) as any;

      let proofs: any[] = [];
      if (decoded.token && decoded.token.length > 0) proofs = decoded.token[0].proofs;
      else if (decoded.proofs) proofs = decoded.proofs;

      if (!lockedToNpub && proofs.length > 0) {
        const firstSecret = proofs[0]?.secret;
        if (typeof firstSecret === 'string' && firstSecret.startsWith('["P2PK"')) {
          try {
            const parsed = JSON.parse(firstSecret);
            const hexPubkey = parsed[1]?.data;
            if (hexPubkey) setParsedNpub(nip19.npubEncode(hexPubkey));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to decode token:', e);
    }
  }, [currentToken, lockedToNpub]);

  useEffect(() => {
    if (!currentToken) return;

    try {
      if (currentToken.startsWith('http')) {
        setQrCodeFragment(currentToken);
        return;
      }

      const clean = cleanToken(currentToken);

      if (showAnimatedQR) {
        const ur = UR.fromBuffer(Buffer.from(clean));
        encoderRef.current = new UREncoder(ur, fragmentLength, 0);
        setQrCodeFragment(encoderRef.current.nextPart());
      } else {
        setQrCodeFragment(clean);
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to setup QR:', e);
      setQrCodeFragment(currentToken);
    }
  }, [currentToken, fragmentLength, showAnimatedQR]);

  useEffect(() => {
    if (!showAnimatedQR || !encoderRef.current) return;
    const interval = setInterval(() => {
      setQrCodeFragment(encoderRef.current!.nextPart());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [showAnimatedQR, intervalMs]);

  const handleCopy = async () => {
    if (currentToken) {
      await Clipboard.setStringAsync(currentToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      toast.show('Copied!', { message: 'Token copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setLockDisabled(true);

      const shareMessage = currentToken.startsWith('http')
        ? `Claim my ecash send of ${amount} sats:\n\n${currentToken}`
        : `Claim my ecash send of ${amount} sats:\n\n${Linking.createURL('/(modals)/receive', { queryParams: { scannedToken: currentToken } })}`;

      await RNShare.share({
        message: shareMessage,
        title: 'Share Token',
      });
    } catch (error) {
      handleCopy();
    } finally {
      setTimeout(() => setLockDisabled(false), 1000);
    }
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishToWeb = async () => {
    if (!currentToken || currentToken.startsWith('http')) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPublishing(true);
    try {
      const secretKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
      const secretKeyHex = Buffer.from(secretKeyBytes).toString('hex');

      const { buildEcashNostrEvent } = require('~/utils/ecashSharing');
      const { event } = buildEcashNostrEvent(cleanToken(currentToken), secretKeyHex);

      const { SimplePool } = require('nostr-tools');
      const { RELAYS } = require('~/services/core/nostrService');
      const pool = new SimplePool();
      await Promise.any(pool.publish(RELAYS, event));
      pool.close(RELAYS);

      const websiteUrl = 'https://bey.cash/c/';
      const shareLink = `${websiteUrl}#${secretKeyHex}`;

      setCurrentToken(shareLink);
      toast.show('Published!', { message: 'Token published on bey.cash' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('[PendingTokenLayout] Publish to web failed:', e);
      toast.show('Publish Failed', { message: e?.message || 'Could not publish to Nostr relays' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleVersion = () => {
    if (!currentToken) return;
    try {
      const decoded = decodeToken(currentToken);
      if (tokenVersion === 'V3') {
        const encodedV4 = encodeTokenV4(decoded);
        setCurrentToken(encodedV4);
        setTokenVersion('V4');
        toast.show('Switched to V4', { message: 'Compact CBOR encoding enabled' });
      } else {
        const encodedV3 = encodeTokenV3(decoded);
        setCurrentToken(encodedV3);
        setTokenVersion('V3');
        toast.show('Switched to V3', { message: 'Standard JSON encoding enabled' });
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to toggle version:', e);
      toast.show('Error', { message: 'Cannot convert this token format' });
    }
  };

  const [computedFee, setComputedFee] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRealFee() {
      try {
        let proofsCount = 0;
        let targetMint = mintUrl;

        if (currentToken) {
          try {
            const clean = cleanToken(currentToken);
            const decoded = decodeToken(clean) as any;
            let proofs: any[] = [];
            if (decoded.token && decoded.token.length > 0) proofs = decoded.token[0].proofs || [];
            else if (decoded.proofs) proofs = decoded.proofs || [];

            proofsCount = proofs.length;
            if (!targetMint) {
              targetMint = (decoded.token && decoded.token[0]?.mint) || decoded.mint;
            }
          } catch (e) {
            console.warn('[PendingTokenLayout] Error decoding token for fee:', e);
          }
        }

        if (targetMint) {
          const feePpk = await mintManager.getFeePpk(targetMint);
          if (feePpk > 0) {
            const inputsCount = proofsCount > 0 ? proofsCount : 1;
            const feeInSats = Math.ceil((inputsCount * feePpk) / 1000);
            if (isMounted) setComputedFee(feeInSats);
            return;
          }
        }

        if (fee > 0 && fee < 100) {
          if (isMounted) setComputedFee(fee);
        } else {
          if (isMounted) setComputedFee(0);
        }
      } catch (err) {
        console.warn('[PendingTokenLayout] Failed to calculate real mint fee:', err);
        if (isMounted) setComputedFee(0);
      }
    }

    fetchRealFee();

    return () => {
      isMounted = false;
    };
  }, [currentToken, mintUrl, fee]);

  const displayFee = computedFee !== null ? computedFee : fee > 0 && fee < 100 ? fee : 0;

  const displayNpub = lockedToNpub || parsedNpub;

  return (
    <YStack flex={1} bg="$background" gap="$4" pb="$5" width="100%">
      <Stack.Screen
        options={{
          headerTitle(props) {
            return (
              <>
                <XStack
                  self="center"
                  items="center"
                  gap="$2"
                  bg={
                    headerStatus === 'success'
                      ? '$green9'
                      : headerStatus === 'failed'
                        ? '$red9'
                        : '$orange9'
                  }
                  px="$4"
                  py="$3"
                  rounded="$10"
                  onPress={onCheckStatus}
                  pressStyle={{ opacity: 0.8 }}
                >
                  {isCheckingStatus ? (
                    <Spinner size="small" color="white" />
                  ) : headerStatus === 'success' ? (
                    <Check size={16} color="white" />
                  ) : headerStatus === 'failed' ? (
                    <AlertCircle size={16} color="white" />
                  ) : (
                    <Clock size={16} color="white" />
                  )}
                  <Text fontSize="$3" fontWeight="700" color="white">
                    {isCheckingStatus
                      ? 'Checking Status...'
                      : headerStatus === 'success'
                        ? 'Claimed'
                        : headerStatus === 'failed'
                          ? 'Failed'
                          : 'Pending Claim'}
                  </Text>
                </XStack>
              </>
            );
          },
          headerTitleAlign: 'center',
          headerRight: customHeaderRight || (() => null),
        }}
      />

      {/* Middle Amount Display */}
      {/* <YStack gap="$2" py="$5" items="center" justify="center">
                <Text fontSize={52}  fontWeight="700" color="$color" lineHeight={54}>
                    {currencyService.formatSats(Number(amount || 0))}
                </Text>
                <Text color="$accent9" fontWeight="600" fontSize={16}>
                    {fiatValue}
                </Text>
            </YStack> */}

      {/* QR Code Container */}
      <YStack items="center" gap="$3" pt="$4">
        <View
          bg="white"
          p="$3"
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          elevation={2}
        >
          {qrCodeFragment ? (
            qrCodeFragment.length > MAX_STATIC_QR_LENGTH ? (
              <YStack width={330} height={330} items="center" justify="center" px="$4">
                <Gauge size={50} color="$orange8" opacity={0.5} />
                <Text mt="$4" color="$gray10" text="center" fontWeight="600">
                  Token too large
                </Text>
                <Text mt="$2" color="$gray9" text="center" fontSize="$2" px="$4">
                  Please enable Animated QR (UR) or switch to V4 encoding to make it smaller.
                </Text>
              </YStack>
            ) : (
              <QRCode
                value={qrCodeFragment}
                size={320}
                backgroundColor="white"
                color="black"
                quietZone={10}
              />
            )
          ) : (
            <YStack width={330} height={330} items="center" justify="center">
              <Spinner size="large" color="$color" />
            </YStack>
          )}
        </View>

        {/* QR Interactive Settings Controls */}
      </YStack>
      {/* Verification status badge */}

      {/* Unified Details Card (flat table layout consistent with ResultStage) */}
      {(!hideDetails || currentToken.startsWith('http')) && (
        <YStack bg="$gray2" rounded="$6" overflow="hidden">
          <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
            <DetailRowItem
              label="Amount"
              value={`${currencyService.formatSats(Number(amount || 0))} (${fiatValue})`}
            />
            <DetailRowItem
              label="Fees"
              value={`${currencyService.formatSats(Number(fee || 0))}`}
            />
            {currentToken.startsWith('http') && (
              <DetailRowItem
                label="Web Link"
                value={`${currentToken.slice(0, 20)}…${currentToken.slice(-8)}`}
                isCopyable
                onCopy={async () => {
                  await Clipboard.setStringAsync(currentToken);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  toast.show('Copied!', { message: 'Web share link copied' });
                }}
              />
            )}
            {!hideDetails && (
              <>
                {displayFee > 0 && <DetailRowItem label="Mint Fee" value={`${displayFee} sats`} />}
                {!!expiresAt && (
                  <DetailRowItem label="Expiry" value={timeLeftStr || 'Checking...'} />
                )}
                {displayNpub && (
                  <DetailRowItem
                    label="Locked To"
                    value={
                      displayNpub === npub
                        ? 'You (Safe)'
                        : `${displayNpub.substring(0, 10)}...${displayNpub.substring(displayNpub.length - 6)}`
                    }
                    isCopyable={displayNpub !== npub}
                    onCopy={async () => {
                      await Clipboard.setStringAsync(displayNpub);
                      Haptics.selectionAsync();
                      toast.show('Copied!', { message: 'NPUB copied' });
                    }}
                  />
                )}
                <DetailRowItem
                  label="Mint"
                  value={mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown'}
                />
              </>
            )}
          </YGroup>
        </YStack>
      )}

      {/* Action Buttons: Share / Send & Copy */}
      <XStack gap="$3" width="100%">

        <Button
          flex={1}
         
          bg={copied ? '$green3' : '$color2'}
          hoverStyle={{ bg: copied ? '$green4' : '$color3' }}
          color={copied ? '$green11' : '$color'}
          size="$6"
          height={65}
          rounded="$6"
          onPress={handleCopy}
          pressStyle={{ scale: 0.97 }}
          icon={copied ? <Check size={20} color="$green11" /> : <Copy size={20} color="$accent5" />}
          fontWeight="800"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          flex={1}
         bg="$color2"
          size="$6"
       
          height={65}
          rounded="$6"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            shareSheetRef.current?.present();
          }}
          pressStyle={{ scale: 0.97 }}
          icon={<Send size={20} />}
          fontWeight="800"
        >
          Send
        </Button>
      </XStack>

      {/* Reclaim Button (separated for visibility outside details list) */}
      {onReclaim && !onClaim && (
        <YStack>
          <Button
            chromeless
            color="$orange10"
            hoverStyle={{ bg: '$orange4' }}
            size="$5"
            height={55}
            rounded="$4"
            onPress={onReclaim}
            disabled={isReclaiming}
            icon={
              isReclaiming ? (
                <Spinner size="small" color="$orange10" />
              ) : (
                <RotateCcw size={18} color="$orange10" />
              )
            }
            fontWeight="700"
          >
            Reclaim Token
          </Button>
        </YStack>
      )}

      {/* Primary Action Button (Claim Now) */}
      {!hideActions && onClaim && (
        <YStack mt="auto" pb="$8">
          <Button
            chromeless
            hoverStyle={{ bg: '$accent11' }}
            color="$accent3"
            size="$5"
            height={60}
            rounded="$12"
            onPress={onClaim}
            disabled={isClaiming}
            icon={
              isClaiming ? (
                <Spinner size="small" color="$accent3" />
              ) : (
                <ArrowDownLeft size={20} color="$accent3" />
              )
            }
            fontWeight="800"
          >
            Claim Now
          </Button>
        </YStack>
      )}

      <AppBottomSheet ref={shareSheetRef} backgroundColor="$gray4">
        <YStack flex={1} px="$4" gap="$4">
          <XStack items="center" justify="space-between" width="100%" pt="$2">
            <Text fontSize="$6" fontWeight="800" color="$color">
              Share / Send
            </Text>
            <Button
              circular
              size="$3"
              bg="$gray4"
              pressStyle={{ scale: 0.95, bg: '$gray5' }}
              icon={<X size={20} color="$color11" strokeWidth={3} />}
              onPress={() => shareSheetRef.current?.dismiss()}
            />
          </XStack>

          <YStack gap="$1" pb="$4">
            {/* System Share */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                handleShare();
              }}
            >
              <Share2 size={24} color="$color" />
              <Text fontWeight="800" fontSize={17} color="$color" flex={1}>
                Share via App
              </Text>
            </XStack>

            {/* NFC Send */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                if (onNfcPress) onNfcPress();
                else handleNfcShare();
              }}
            >
              <Nfc size={24} color="$color" />
              <Text fontWeight="800" fontSize={17} color="$color" flex={1}>
                NFC Send
              </Text>
            </XStack>

            {/* Nostr Send */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              disabled={!!displayNpub}
              opacity={displayNpub ? 0.4 : 1}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toast.show('Nostr Send', { message: 'Nostr sending is not implemented yet' });
              }}
            >
              <UsersRound size={24} color="$color" />
              <Text fontWeight="800" fontSize={17} color="$color" flex={1}>
                Nostr Send
              </Text>
            </XStack>

            {/* Publish Web */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              disabled={isPublishing}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                if (currentToken.startsWith('http')) {
                  Clipboard.setStringAsync(currentToken);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  toast.show('Copied!', { message: 'Web share link copied' });
                } else {
                  handlePublishToWeb();
                }
              }}
            >
              {isPublishing ? (
                <Spinner size="small" />
              ) : (
                <Globe size={24} color={currentToken.startsWith('http') ? '$green10' : '$color'} />
              )}
              <Text
                fontWeight="800"
                fontSize={17}
                color={currentToken.startsWith('http') ? '$green10' : '$color'}
                flex={1}
              >
                {currentToken.startsWith('http') ? 'Copy Web Link' : 'Publish Web'}
              </Text>
            </XStack>

            {/* Copy Token */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                handleCopy();
              }}
            >
              {copied ? <Check size={24} color="$green10" /> : <Copy size={24} color="$color" />}
              <Text fontWeight="800" fontSize={17} color={copied ? '$green10' : '$color'} flex={1}>
                {copied ? 'Copied!' : 'Copy Token'}
              </Text>
            </XStack>
          </YStack>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}

function DetailRowItem({
  label,
  value,
  isCopyable,
  onCopy,
}: {
  label: string;
  value: string;
  isCopyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <XStack justify="space-between" items="center" py="$3" px="$4">
      <Text fontSize="$3" color="$gray10" fontWeight="600">
        {label}
      </Text>
      <XStack gap="$2" items="center">
        <Text
          fontSize="$3"
          fontWeight="800"
          color="$color"
          numberOfLines={1}
          style={{ maxWidth: 260 }}
        >
          {value}
        </Text>
        {isCopyable && (
          <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
        )}
      </XStack>
    </XStack>
  );
}
