import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import React, { useEffect, useState, useRef } from 'react';
import { YStack, XStack, Text, Separator, View, Popover, ListItem, Adapt, Sheet } from 'tamagui';
import {
  Copy,
  Share,
  Zap,
  ArrowUpDown,
  MoreHorizontal,
  Link,
  Contact2,
  Trash2,
  Scan,
  Share2,
  Check,
  RotateCcw,
  XCircle,
  Gauge,
  ZoomIn,
  Hexagon,
  ChevronDown,
  Repeat,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useToastController } from '@tamagui/toast';
import { Spinner } from '~/shared/ui/Spinner';
import { Buffer } from 'buffer';
import { UR, UREncoder } from '@gandlaf21/bc-ur';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import {
  historyService,
  cleanToken,
  decodeToken,
  encodeToken,
  encodePeanut,
  encodeTokenV4,
  encodeTokenV3,
} from '~/services/wallet';

// Ensure Buffer is available globally
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

interface HistoryEntry {
  id: string;
  type: 'send' | 'receive' | 'mint' | 'melt';
  amount: number;
  unit: string;
  mintUrl: string;
  state?: string;
  createdAt: number;
  metadata?: any;
  token?: any;
}

export default function TokenDetailsModal() {
  const router = useRouter();
  const { id, token: paramToken } = useLocalSearchParams<{ id: string; token: string }>();
  const toast = useToastController();
  const insets = useSafeAreaInsets();
  const { secondaryCurrency } = useSettingsStore();

  const [copied, setCopied] = useState(false);

  // Fetch transaction if ID is provided
  const { data: entry, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (!id) return null;
      const history = await historyService.getHistory(100, 0);
      return history.find((e: any) => e.id === id) as HistoryEntry | undefined;
    },
    enabled: !!id,
  });

  const getTokenString = () => {
    if (paramToken) return paramToken;

    // Handle metadata.token which might be object or string
    if (entry?.metadata?.token) {
      if (typeof entry.metadata.token === 'string') {
        return entry.metadata.token;
      }
      try {
        // Try to encode if it's an object
        return encodeToken(entry.metadata.token);
      } catch (e) {
        console.warn('[TokenDetails] Failed to encode metadata token:', e);
      }
    }

    if (entry?.token) {
      try {
        return typeof entry.token === 'string' ? entry.token : encodeToken(entry.token);
      } catch (e) {
        console.warn('[TokenDetails] Failed to encode token from entry:', e);
        return '';
      }
    }
    return '';
  };

  const token = getTokenString();
  const amount = entry?.amount || 0;
  const mintUrl = entry?.mintUrl || '';

  // Animated QR states
  const [currentToken, setCurrentToken] = useState<string>(token || '');
  const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
  const [showAnimatedQR, setShowAnimatedQR] = useState(false);
  const [fragmentLength, setFragmentLength] = useState(150); // L=150, M=100, S=50
  const [intervalMs, setIntervalMs] = useState(140); // F=140, M=250, S=500
  const encoderRef = useRef<UREncoder | null>(null);
  const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(
    token?.startsWith('cashuB') ? 'V4' : 'V3',
  );

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  useEffect(() => {
    if (token && !currentToken) {
      setCurrentToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!currentToken) return;

    try {
      // Normalize token (strip prefix for decoding)
      const clean = cleanToken(currentToken);
      const decoded = decodeToken(clean) as any;
      const proofs = decoded.token?.[0]?.proofs || [];

      // Animate if the token is large (>400 chars) or has more than 2 proofs
      const shouldAnimate = proofs.length > 2 || clean.length > 400;

      if (shouldAnimate) {
        setShowAnimatedQR(true);
        const messageBuffer = Buffer.from(clean);
        const ur = UR.fromBuffer(messageBuffer);
        encoderRef.current = new UREncoder(ur, fragmentLength, 0);
      } else {
        setShowAnimatedQR(false);
        setQrCodeFragment(currentToken);
      }
    } catch (e) {
      console.error('Failed to decode token for QR:', e);
      setShowAnimatedQR(false);
      setQrCodeFragment(currentToken);
    }
  }, [currentToken, fragmentLength]);

  useEffect(() => {
    if (!showAnimatedQR || !encoderRef.current) return;

    const interval = setInterval(() => {
      setQrCodeFragment(encoderRef.current!.nextPart());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [showAnimatedQR, intervalMs, fragmentLength]);

  const changeSpeed = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (intervalMs === 250) setIntervalMs(500);
    else if (intervalMs === 500) setIntervalMs(140);
    else setIntervalMs(250);
  };

  const changeSize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fragmentLength === 100) setFragmentLength(50);
    else if (fragmentLength === 50) setFragmentLength(150);
    else setFragmentLength(100);
  };

  const speedLabel = intervalMs === 140 ? 'F' : intervalMs === 250 ? 'M' : 'S';
  const sizeLabel = fragmentLength === 150 ? 'L' : fragmentLength === 100 ? 'M' : 'S';

  const handleCopy = async () => {
    if (currentToken) {
      await Clipboard.setStringAsync(currentToken);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopied(true);
      toast.show('Token copied to clipboard', { kind: 'success' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyEmoji = async () => {
    if (currentToken) {
      const peanut = encodePeanut(cleanToken(currentToken));
      await Clipboard.setStringAsync(peanut);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast.show('Peanut token copied to clipboard', { kind: 'success' });
    }
  };

  const handleToggleVersion = () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const decoded = decodeToken(currentToken);
      if (tokenVersion === 'V3') {
        const encodedV4 = encodeTokenV4(decoded);
        setCurrentToken(encodedV4);
        setTokenVersion('V4');
        toast.show('Switched to V4 (compact CBOR)', { kind: 'info' });
      } else {
        const encodedV3 = encodeTokenV3(decoded);
        setCurrentToken(encodedV3);
        setTokenVersion('V3');
        toast.show('Switched to V3 (standard JSON)', { kind: 'info' });
      }
    } catch (e) {
      console.error('Failed to toggle token version:', e);
      toast.show('Failed to switch token version', { kind: 'error' });
    }
  };

  const handleShare = async () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const shareText = `cashu:${currentToken}`;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        const { Share: RNShare } = require('react-native');
        await RNShare.share({
          message: shareText,
        });
      } else {
        handleCopy();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      handleCopy();
    }
  };

  // Get mint display name
  const getMintDisplayName = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (isLoading && id) {
    return (
      <YStack flex={1} justify="center" items="center" bg="$background">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!token) {
    return (
      <YStack flex={1} justify="center" items="center" gap="$4" p="$4" bg="$background">
        <XCircle size={80} color="$red10" />
        <Text color="$red10" fontSize="$6" fontWeight="700" text="center">
          Token Not Found
        </Text>
        <AppButton
          variant="default"
          emphasis="secondary"
          size="large"
          width="100%"
          onPress={() => router.back()}
        >
          Go Back
        </AppButton>
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          title: 'Token Details',
          presentation: 'modal',
          headerRight: () => (
            <Popover size="$5" allowFlip placement="bottom-end">
              <Adapt when="sm" platform="touch">
                <Sheet modal dismissOnSnapToBottom animation="bouncy">
                  <Sheet.Frame pb="$5" bg="$sheetBackground">
                    <Adapt.Contents />
                  </Sheet.Frame>
                  <Sheet.Overlay
                    animation="lazy"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  />
                </Sheet>
              </Adapt>

              <Popover.Trigger asChild>
                <HeaderIconButton
                  accessibilityLabel="More options"
                  icon={<MoreHorizontal />}
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                />
              </Popover.Trigger>

              <Popover.Content
                borderWidth={1}
                borderColor="$borderColor"
                enterStyle={{ y: -10, opacity: 0, scale: 0.95 }}
                exitStyle={{ y: -10, opacity: 0, scale: 0.95 }}
                elevate
                animation="quick"
                p={0}
                width={220}
              >
                <Popover.Arrow borderWidth={1} borderColor="$borderColor" />
                <YStack>
                  <ListItem
                    icon={Link}
                    title="Copy as Emoji"
                    onPress={handleCopyEmoji}
                    pressStyle={{ bg: '$backgroundHover' }}
                  />
                  <ListItem
                    icon={Hexagon}
                    title={`Switch to ${tokenVersion === 'V3' ? 'V4' : 'V3'}`}
                    onPress={handleToggleVersion}
                    pressStyle={{ bg: '$backgroundHover' }}
                  />
                  <Separator />
                </YStack>
              </Popover.Content>
            </Popover>
          ),
        }}
      />

      {/* QR Code Segment */}
      <YStack items="center" gap="$4" pt="$4">
        <View
          bg="white"
          p="$3"
          rounded="$6"
          style={{
            elevation: 15,
            shadowColor: 'rgba(0,0,0,0.2)',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 12,
          }}
        >
          {/* QRCode disabled due to crashes
                    {currentToken && typeof currentToken === 'string' && currentToken.length > 0 && (
                        <QRCode
                            value={showAnimatedQR ? qrCodeFragment : (currentToken.startsWith('cashu:') ? currentToken : `cashu:${currentToken}`)}
                            size={300}
                            backgroundColor="white"
                            color="black"
                            quietZone={10}
                        />
                    )}
                    */}
          <Text color="black" p="$4">
            QR Code disabled
          </Text>
        </View>

        <XStack
          gap="$1.5"
          bg="$color3"
          px="$4"
          py="$2"
          rounded="$10"
          flexWrap="wrap"
          justify="center"
        >
          {showAnimatedQR && (
            <>
              <AppButton
                variant="default"
                emphasis="secondary"
                size="xxsmall"
                icon={<Gauge size={16} />}
                onPress={changeSpeed}
              >
                {speedLabel}
              </AppButton>
              <Separator
                vertical
                height={15}
                style={{ alignSelf: 'center' }}
                borderColor="$gray8"
              />
              <AppButton
                variant="default"
                emphasis="secondary"
                size="xxsmall"
                icon={<ZoomIn size={16} />}
                onPress={changeSize}
              >
                {sizeLabel}
              </AppButton>
              <Separator
                vertical
                height={15}
                style={{ alignSelf: 'center' }}
                borderColor="$gray8"
              />
            </>
          )}
          <AppButton
            variant="default"
            emphasis="secondary"
            size="xxsmall"
            icon={<Hexagon size={16} />}
            onPress={handleToggleVersion}
          >
            {tokenVersion}
          </AppButton>
        </XStack>
      </YStack>

      {/* Amount Section */}
      <YStack items="center" gap="$0" py="$4">
        <PaymentAmount amount={Number(amount)} size="prominent" compact />
      </YStack>

      <YStack px="$4">
        <ListTable compact>
          <ListTableRow label="Unit" value="SAT" />
          {secondaryCurrency !== 'NONE' && (
            <ListTableRow
              label="Fiat"
              value={
                btcData?.price
                  ? currencyService.formatValue(
                      currencyService.convertSatsToCurrency(Number(amount), btcData.price),
                      secondaryCurrency as CurrencyCode,
                    )
                  : '$0.00'
              }
            />
          )}
          <ListTableRow label="Mint" value={mintUrl ? getMintDisplayName(mintUrl) : 'Unknown'} />
        </ListTable>
      </YStack>

      {/* Action Buttons */}
      <XStack mt="auto" pb={insets.bottom + 20} gap="$2" width="100%" px="$4">
        <AppIconButton
          variant="default"
          emphasis="secondary"
          size="medium"

          accessibilityLabel="Share"
          icon={<Share2 size={18} />}
          flex={1}
          onPress={handleShare}
        />

        <AppButton
          variant="default"
          emphasis="secondary"
          size="medium"
          icon={copied ? <Check size={18} /> : <Copy size={18} />}
          flex={1.5}
          onPress={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </AppButton>
      </XStack>
    </YStack>
  );
}
