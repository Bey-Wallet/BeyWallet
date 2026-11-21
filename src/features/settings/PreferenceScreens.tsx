import React from 'react';
import { useSettingsStore, type ThemePreference } from '~/state/settingsStore';
import {
  SELECTABLE_CURRENCIES,
  currencyService,
  type CurrencyCode,
} from '~/services/wallet/currencyService';
import { useQuery } from '@tanstack/react-query';
import { Coins, RefreshCw } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { RemoteImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { Spinner } from '~/shared/ui/Spinner';
import { bitcoinService } from '~/services/api/bitcoinService';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

// Flagpedia permits free use of these public-domain flag images:
// https://flagpedia.net/terms and https://flagpedia.net/download/api
const currencyRegions: Record<CurrencyCode, string> = {
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  PLN: 'pl',
  CZK: 'cz',
  JPY: 'jp',
  AUD: 'au',
  CAD: 'ca',
  CHF: 'ch',
  CNY: 'cn',
  INR: 'in',
  BRL: 'br',
  RUB: 'ru',
  ZAR: 'za',
  MXN: 'mx',
  SGD: 'sg',
  HKD: 'hk',
  NZD: 'nz',
  SEK: 'se',
  KRW: 'kr',
  TRY: 'tr',
  THB: 'th',
  NGN: 'ng',
  AED: 'ae',
  KWD: 'kw',
};

function CurrencyIcon({ code, size = 22 }: { code: string; size?: number }) {
  const region = currencyRegions[code as CurrencyCode];
  const fallback = <Coins size={size} color="$iconSecondary" />;
  if (!region) return fallback;
  return (
    <RemoteImage
      src={`https://flagcdn.com/64x48/${region}.png`}
      identity={code}
      width={size}
      height={Math.round(size * 0.75)}
      rounded="$1"
      resizeMode="contain"
      fallback={fallback}
    />
  );
}

export function ThemeSettingsScreen() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose how Bey Wallet looks. System follows your device’s appearance.
      </SettingsDescription>
      <SettingsGroup>
        {(['system', 'light', 'dark'] as ThemePreference[]).map((value) => (
          <SettingsRow
            key={value}
            title={value[0].toUpperCase() + value.slice(1)}
            selected={theme === value}
            onPress={() => void setTheme(value)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  );
}

export function CurrencySettingsScreen() {
  const currency = useSettingsStore((state) => state.secondaryCurrency);
  const setCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  const price = useQuery({
    queryKey: ['bitcoinPrice', currency],
    queryFn: () => bitcoinService.fetchPrice(currency),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: currency !== 'NONE',
  });
  const options = [
    { code: 'NONE', name: 'None', description: 'Show sats only' },
    ...SELECTABLE_CURRENCIES.map(({ code, name }) => ({
      code: String(code),
      name,
      description: undefined as string | undefined,
    })),
  ];
  return (
    <SettingsPage>
      {currency !== 'NONE' && (
        <XStack
          items="center"
          gap="$3"
          bg="$gray2"
          rounded="$6"
          px={appSpacing.page}
          py={appSpacing.compact}
        >
          <YStack flex={1} gap="$1" accessibilityLiveRegion="polite">
            <Text {...appTypography.body3} color="$gray10">
              1 BTC · {currency}
            </Text>
            <Text {...appTypography.title3} color="$color">
              {price.data
                ? currencyService.formatValue(price.data.price, currency as CurrencyCode)
                : price.isError
                  ? 'Price unavailable'
                  : 'Loading price…'}
            </Text>
            {price.data && Date.now() / 1000 - price.data.updatedAt > 120 && (
              <Text {...appTypography.body3} color="$gray10">
                Cached price
              </Text>
            )}
          </YStack>
          <AppIconButton
            accessibilityLabel="Refresh Bitcoin price"
            emphasis="ghost"
            size="small"
            disabled={price.isFetching}
            icon={price.isFetching ? <Spinner size={18} /> : RefreshCw}
            onPress={() => void price.refetch()}
          />
        </XStack>
      )}
      <SettingsGroup>
        {options.map((item) => (
          <SettingsRow
            key={item.code}
            title={item.name}
            value={item.code === 'NONE' ? undefined : item.code}
            description={item.description}
            icon={<CurrencyIcon code={item.code} />}
            selected={currency === item.code}
            onPress={() => void setCurrency(item.code)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  );
}
