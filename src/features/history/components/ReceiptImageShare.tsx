import React, { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Rect, Text as SvgText, Line, G, Path, Circle } from 'react-native-svg';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { paymentAmounts } from '~/shared/ui/PaymentAmount';
import { Text, YStack, XStack, useTheme } from 'tamagui';
import { Share2, X } from '@tamagui/lucide-icons';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppButton } from '~/shared/ui/AppButton';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { shareReceiptImage } from '~/services/platform/receiptImageService';
import type { ShareableReceipt } from '../shareableReceipt';
import { appColors } from '~/shared/theme/appearance';
import BeyIcon from '~/shared/icons/BeyIcon';

export function ReceiptImageShare({
  receipt,
  disabled,
}: {
  receipt: ShareableReceipt;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const colors =
    theme.background?.val?.toLowerCase() === appColors.dark.canvas.toLowerCase()
      ? appColors.dark
      : appColors.light;
  const [preview, setPreview] = useState<(ShareableReceipt & { secondary: string | null }) | null>(
    null,
  );
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { data: price } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30_000,
    enabled: secondaryCurrency !== 'NONE',
  });
  const values = paymentAmounts(
    receipt.sats,
    primaryCurrency,
    secondaryCurrency,
    showBitcoinSymbol,
    price?.price,
  );
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const sheet = useRef<AppBottomSheetRef>(null);
  const svg = useRef<Svg>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (preview) sheet.current?.present();
  }, [preview]);
  const pending = preview?.status === 'Pending';
  const detailsOffset = preview?.qr ? 400 : 0;
  const imageHeight = 674 + detailsOffset;
  const statusColor = pending
    ? colors.warning
    : preview?.status === 'Confirmed' || preview?.status === 'Refunded'
      ? colors.positive
      : colors.negative;
  const { qrPath, qrCount } = useMemo(() => {
    let qrPath = '';
    let qrCount = 0;
    if (!preview?.qr) return { qrPath, qrCount };
    try {
      const matrix = QRCode.create(preview.qr, { errorCorrectionLevel: 'M' }).modules;
      qrCount = matrix.size;
      for (let row = 0; row < matrix.size; row++)
        for (let col = 0; col < matrix.size; col++) {
          if (matrix.data[row * matrix.size + col]) qrPath += `M${col + 4} ${row + 4}h1v1h-1z`;
        }
    } catch {
      /* Share remains disabled if the public request cannot be encoded. */
    }
    return { qrPath, qrCount };
  }, [preview?.qr]);
  return (
    <>
      <AppButton
        emphasis="text"
        icon={Share2}
        disabled={disabled}
        onPress={() => {
          setError('');
          setPreview({
            ...receipt,
            amount: values.primary ?? 'Conversion unavailable',
            secondary: values.secondary
              ? `≈ ${values.secondary}`
              : secondaryCurrency !== 'NONE'
                ? 'Conversion unavailable'
                : null,
          });
        }}
      >
        Share receipt image
      </AppButton>
      {preview && (
        <AppBottomSheet
          ref={sheet}
          scrollable
          canDismiss={!sharing}
          onClose={() => setPreview(null)}
        >
          <BottomSheetScrollView>
            <YStack p="$4" gap="$3">
              <XStack items="center">
                <HeaderIconButton
                  icon={X}
                  accessibilityLabel="Close receipt preview"
                  disabled={sharing}
                  onPress={() => sheet.current?.dismiss()}
                />
                <Text flex={1} textAlign="center" fontFamily="$body" fontSize={16} fontWeight="600">
                  Share receipt
                </Text>
                <XStack width={48} />
              </XStack>
              <Svg
                ref={svg}
                width="100%"
                height={preview.qr ? 520 : 360}
                viewBox={`0 0 640 ${imageHeight}`}
                fontFamily="InterTextRegular"
                accessibilityLabel="Public receipt image preview"
              >
                <Rect width={640} height={imageHeight} rx={32} fill={colors.canvas} />
                <G transform="translate(48 46)">
                  <BeyIcon size={42} color={colors.icon} />
                </G>
                <SvgText
                  x={106}
                  y={82}
                  fontSize={40}
                  fontFamily="InterDisplaySemiBold"
                  fill={colors.icon}
                >
                  bey
                </SvgText>
                <SvgText x={592} y={78} textAnchor="end" fontSize={20} fill={colors.secondaryText}>
                  Receipt
                </SvgText>
                <Rect x={48} y={130} width={190} height={44} rx={22} fill={colors.raised} />
                <Circle cx={70} cy={152} r={5} fill={statusColor} />
                <SvgText
                  x={86}
                  y={159}
                  fontSize={21}
                  fontFamily="InterTextMedium"
                  fill={colors.icon}
                >
                  {preview.status}
                </SvgText>
                {preview.qr && qrCount > 0 && (
                  <G transform={`translate(48 200) scale(${360 / (qrCount + 8)})`}>
                    <Rect width={qrCount + 8} height={qrCount + 8} fill={appColors.light.canvas} />
                    <Path d={qrPath} fill={appColors.light.text} />
                  </G>
                )}
                <SvgText
                  x={48}
                  y={254 + detailsOffset}
                  fontSize={preview.amount.length > 16 ? 32 : preview.amount.length > 11 ? 46 : 64}
                  fontFamily="InterDisplaySemiBold"
                  fill={colors.icon}
                >
                  {preview.amount}
                </SvgText>
                <SvgText x={48} y={298 + detailsOffset} fontSize={24} fill={colors.secondaryText}>
                  {preview.secondary ||
                    (primaryCurrency === 'SATS' || secondaryCurrency === 'NONE'
                      ? 'Amount in satoshis'
                      : '')}
                </SvgText>
                <Line
                  x1={48}
                  x2={592}
                  y1={342 + detailsOffset}
                  y2={342 + detailsOffset}
                  stroke={colors.separator}
                  strokeWidth={2}
                />
                <SvgText x={48} y={396 + detailsOffset} fontSize={21} fill={colors.secondaryText}>
                  Type
                </SvgText>
                <SvgText
                  x={592}
                  y={396 + detailsOffset}
                  textAnchor="end"
                  fontSize={21}
                  fontFamily="InterTextMedium"
                  fill={colors.icon}
                >
                  {preview.type}
                </SvgText>
                <SvgText x={48} y={450 + detailsOffset} fontSize={21} fill={colors.secondaryText}>
                  Mint
                </SvgText>
                <SvgText
                  x={592}
                  y={450 + detailsOffset}
                  textAnchor="end"
                  fontSize={19}
                  fill={colors.icon}
                >
                  {preview.mint.length > 36 ? `${preview.mint.slice(0, 35)}…` : preview.mint}
                </SvgText>
                <SvgText x={48} y={504 + detailsOffset} fontSize={21} fill={colors.secondaryText}>
                  Direction
                </SvgText>
                <SvgText
                  x={592}
                  y={504 + detailsOffset}
                  textAnchor="end"
                  fontSize={21}
                  fill={colors.icon}
                >
                  {preview.direction}
                </SvgText>
                <SvgText x={48} y={558 + detailsOffset} fontSize={21} fill={colors.secondaryText}>
                  Date
                </SvgText>
                <SvgText
                  x={592}
                  y={558 + detailsOffset}
                  textAnchor="end"
                  fontSize={19}
                  fill={colors.icon}
                >
                  {preview.date}
                </SvgText>
                <SvgText x={48} y={imageHeight - 46} fontSize={17} fill={colors.secondaryText}>
                  {pending ? 'Payment not confirmed' : 'Payment summary'}
                </SvgText>
                <SvgText
                  x={592}
                  y={imageHeight - 46}
                  textAnchor="end"
                  fontSize={17}
                  fontFamily="InterTextMedium"
                  fill={colors.icon}
                >
                  bey.cash
                </SvgText>
              </Svg>
              {preview.qr && !qrCount && (
                <Text color="$red10" fontSize={12}>
                  This payment QR could not be encoded.
                </Text>
              )}
              {error && (
                <Text fontSize={12} color="$red10" accessibilityRole="alert">
                  {error}
                </Text>
              )}
              <AppButton
                fullWidth
                loading={sharing}
                disabled={sharing || (!!preview.qr && !qrCount)}
                loadingText="Preparing image…"
                onPress={async () => {
                  if (lock.current || !svg.current) return;
                  lock.current = true;
                  setSharing(true);
                  setError('');
                  try {
                    await shareReceiptImage(svg.current, { width: 1280, height: imageHeight * 2 });
                  } catch {
                    setError('Could not share the image. Please try again.');
                  } finally {
                    lock.current = false;
                    setSharing(false);
                  }
                }}
              >
                Share image
              </AppButton>
            </YStack>
          </BottomSheetScrollView>
        </AppBottomSheet>
      )}
    </>
  );
}
