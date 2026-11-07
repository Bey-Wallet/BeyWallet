import React, { useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react';
import Svg, { Rect, Text as SvgText, Line, G, Path } from 'react-native-svg';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { paymentAmounts } from '~/shared/ui/PaymentAmount';
import { Text, YStack, useTheme, useThemeName } from 'tamagui';
import { Share2, X, Check, Clock, Minus, ArrowDownLeft } from '@tamagui/lucide-icons';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { AppButton } from '~/shared/ui/AppButton';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { shareReceiptImage } from '~/services/platform/receiptImageService';
import type { ShareableReceipt } from '../shareableReceipt';
import { appColors } from '~/shared/theme/appearance';
import BeyIcon from '~/shared/icons/BeyIcon';
import { canRenderStaticTokenQr } from '~/shared/utils/tokenQr';

type ReceiptPreview = ShareableReceipt & { secondary: string | null; ecashQr?: string };
export type ReceiptImageShareAction = { open: () => void };

export function ReceiptImageShare({
  receipt,
  disabled,
  ecashToken,
  iconOnly = false,
  hideTrigger = false,
  actionRef,
}: {
  receipt: ShareableReceipt;
  disabled?: boolean;
  /** Explicitly authorized spendable token export, separate from the public receipt model. */
  ecashToken?: string;
  iconOnly?: boolean;
  hideTrigger?: boolean;
  actionRef?: React.Ref<ReceiptImageShareAction>;
}) {
  const theme = useTheme();
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  const colors =
    theme.background?.val?.toLowerCase() === appColors.dark.canvas.toLowerCase()
      ? appColors.dark
      : appColors.light;
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const eligibleToken =
    receipt.status === 'Pending' &&
    receipt.method === 'Ecash' &&
    receipt.direction === 'Sending' &&
    /^cashu[AB][A-Za-z0-9+/_=-]+$/.test(ecashToken || '')
      ? ecashToken
      : undefined;
  const staticToken = useMemo(
    () => (eligibleToken && canRenderStaticTokenQr(eligibleToken, 280) ? eligibleToken : undefined),
    [eligibleToken],
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
  const sheet = useRef<BUISheetRef>(null);
  const svg = useRef<Svg>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (preview) sheet.current?.present();
  }, [preview]);
  const pending = preview?.status === 'Pending';
  const ecashImage = !!preview?.ecashQr;
  const qrValue = preview?.ecashQr || preview?.qr;
  const detailsOffset = ecashImage ? 340 : preview?.qr ? 400 : 0;
  const imageHeight = 548 + detailsOffset;
  const statusColor =
    preview?.status === 'Confirmed' || preview?.status === 'Refunded'
      ? colors.positive
      : preview?.status === 'Failed'
        ? colors.negative
        : colors.warning;
  const OutcomeIcon =
    preview?.status === 'Confirmed'
      ? Check
      : preview?.status === 'Refunded'
        ? ArrowDownLeft
        : preview?.status === 'Failed'
          ? X
          : preview?.status === 'Cancelled'
            ? Minus
            : Clock;
  const { qrPath, qrCount } = useMemo(() => {
    let qrPath = '';
    let qrCount = 0;
    if (!qrValue) return { qrPath, qrCount };
    try {
      const matrix = QRCode.create(qrValue, { errorCorrectionLevel: 'M' }).modules;
      qrCount = matrix.size;
      for (let row = 0; row < matrix.size; row++)
        for (let col = 0; col < matrix.size; col++) {
          if (matrix.data[row * matrix.size + col]) qrPath += `M${col + 4} ${row + 4}h1v1h-1z`;
        }
    } catch {
      /* Never export an image with an incomplete or missing payable QR. */
    }
    return { qrPath, qrCount };
  }, [qrValue]);
  const openPreview = () => {
    if (disabled || lock.current) return;
    setError('');
    setPreview({
      ...receipt,
      ecashQr: staticToken,
      amount: values.primary ?? 'Conversion unavailable',
      secondary: values.secondary
        ? `≈ ${values.secondary}`
        : secondaryCurrency !== 'NONE'
          ? 'Conversion unavailable'
          : null,
    });
  };
  useImperativeHandle(actionRef, () => ({ open: openPreview }));
  return (
    <>
      {hideTrigger ? null : iconOnly ? (
        <HeaderIconButton
          icon={Share2}
          accessibilityLabel="Share receipt image"
          disabled={disabled}
          onPress={openPreview}
        />
      ) : (
        <AppButton emphasis="text" icon={Share2} disabled={disabled} onPress={openPreview}>
          Share receipt image
        </AppButton>
      )}
      {preview && (
        <BUISheet
          title="Share receipt"
          appearance={appearance}
          ref={sheet}
          canDismiss={!sharing}
          onClose={() => setPreview(null)}
        >
          <YStack gap={12}>
            <Svg
              ref={svg}
              width="100%"
              height={qrValue ? 480 : 300}
              viewBox={`0 0 640 ${imageHeight}`}
              fontFamily="InterTextRegular"
              accessibilityLabel={
                ecashImage ? 'Ecash sharing image preview' : 'Public receipt image preview'
              }
            >
              <Rect width={640} height={imageHeight} rx={32} fill={colors.surface} />
              <G transform="translate(48 46)">
                <BeyIcon size={32} color={colors.icon} />
              </G>
              <SvgText x={92} y={72} fontSize={24} fontFamily="InterTextMedium" fill={colors.text}>
                Bey
              </SvgText>
              <G
                testID={pending ? 'receipt-pending-icon' : 'receipt-outcome-icon'}
                accessibilityLabel={`${preview.status} payment`}
                transform={`translate(${592 - preview.status.length * 12 - 40} 46)`}
              >
                <OutcomeIcon size={32} color={statusColor} strokeWidth={2.5} />
              </G>
              <SvgText
                x={592}
                y={72}
                textAnchor="end"
                fontSize={20}
                fontFamily="InterTextMedium"
                fill={colors.text}
              >
                {preview.status}
              </SvgText>
              <SvgText x={48} y={152} fontSize={22} fill={colors.secondaryText}>
                {ecashImage ? 'Ecash to share' : preview.type}
              </SvgText>
              {qrValue && qrCount > 0 && (
                <G
                  testID="receipt-qr"
                  transform={`translate(48 ${ecashImage ? 164 : 184}) scale(${(ecashImage ? 300 : 360) / (qrCount + 8)})`}
                >
                  <Rect width={qrCount + 8} height={qrCount + 8} fill={appColors.light.canvas} />
                  <Path d={qrPath} fill={appColors.light.text} />
                </G>
              )}
              <SvgText
                testID="receipt-primary-amount"
                x={48}
                y={244 + detailsOffset}
                fontSize={preview.amount.length > 16 ? 48 : preview.amount.length > 11 ? 64 : 80}
                fontFamily="InterDisplaySemiBold"
                fill={colors.icon}
              >
                {preview.amount}
              </SvgText>
              <SvgText x={48} y={288 + detailsOffset} fontSize={22} fill={colors.secondaryText}>
                {preview.secondary ||
                  (primaryCurrency === 'SATS' || secondaryCurrency === 'NONE'
                    ? 'Amount in satoshis'
                    : '')}
              </SvgText>
              <SvgText x={48} y={348 + detailsOffset} fontSize={22} fill={colors.text}>
                {ecashImage ? preview.type : preview.direction}
              </SvgText>
              <SvgText x={48} y={384 + detailsOffset} fontSize={20} fill={colors.secondaryText}>
                {preview.mint.length > 48 ? `${preview.mint.slice(0, 47)}…` : preview.mint}
              </SvgText>
              <SvgText x={48} y={420 + detailsOffset} fontSize={20} fill={colors.secondaryText}>
                {preview.date}
              </SvgText>
              <Line
                x1={48}
                x2={592}
                y1={456 + detailsOffset}
                y2={456 + detailsOffset}
                stroke={colors.canvas}
                strokeWidth={2}
              />
              <SvgText x={48} y={imageHeight - 40} fontSize={16} fill={colors.secondaryText}>
                {ecashImage ? 'Contains ecash' : 'Payment receipt'}
              </SvgText>
              <SvgText
                x={592}
                y={imageHeight - 40}
                textAnchor="end"
                fontSize={16}
                fill={colors.secondaryText}
              >
                bey.cash
              </SvgText>
            </Svg>
            {ecashImage && (
              <Text color="$gray10" fontSize={11}>
                Contains ecash. Share with the intended recipient.
              </Text>
            )}
            {eligibleToken && !staticToken && (
              <Text color="$gray10" fontSize={11}>
                This token needs an animated QR. Use Send to share the ecash; this image is a
                receipt only.
              </Text>
            )}
            {qrValue && !qrCount && (
              <Text color="$red10" fontSize={11}>
                This payment QR could not be encoded.
              </Text>
            )}
            {error && (
              <Text fontSize={11} color="$red10" accessibilityRole="alert">
                {error}
              </Text>
            )}
            <AppButton
              fullWidth
              loading={sharing}
              disabled={sharing || (!!qrValue && !qrCount)}
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
        </BUISheet>
      )}
    </>
  );
}
