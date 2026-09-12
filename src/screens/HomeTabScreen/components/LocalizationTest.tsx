import React, { useEffect, useState } from 'react';
import { YStack, XStack, Text, Card, H3, Separator } from 'tamagui';
import * as Localization from 'expo-localization';
import { Globe, Clock, CreditCard, Languages, Flag } from '@tamagui/lucide-icons';

export function LocalizationTest() {
  const [deviceTime, setDeviceTime] = useState(new Date().toLocaleTimeString());
  const locales = Localization.getLocales();
  const calendars = Localization.getCalendars();

  const primaryLocale = locales[0];
  const primaryCalendar = calendars[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setDeviceTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const InfoRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value: string | null | undefined;
  }) => (
    <XStack items="center" gap="$3" py="$2">
      <Icon size={18} color="$blue10" />
      <YStack flex={1}>
        <Text fontSize="$2" color="$gray10" textTransform="uppercase" fontWeight="600">
          {label}
        </Text>
        <Text fontSize="$4" color="$color" fontWeight="500">
          {value || 'N/A'}
        </Text>
      </YStack>
    </XStack>
  );

  return (
    <Card elevate size="$4" bordered bg="$background" p="$4" width="100%" maxWidth={400}>
      <Card.Header mb="$2">
        <H3 color="$blue10">Device Localization</H3>
        <Text color="$gray11" fontSize="$2">
          Real-time locale information
        </Text>
      </Card.Header>

      <YStack separator={<Separator />}>
        <InfoRow icon={Clock} label="Local Time" value={deviceTime} />
        <InfoRow
          icon={Languages}
          label="Language"
          value={`${primaryLocale?.languageCode} (${primaryLocale?.languageTag})`}
        />
        <InfoRow icon={Globe} label="Region" value={primaryLocale?.regionCode} />
        <InfoRow icon={Flag} label="Region Code" value={primaryLocale?.regionCode} />
        <InfoRow
          icon={CreditCard}
          label="Currency"
          value={`${primaryLocale?.currencyCode} (${primaryLocale?.currencySymbol})`}
        />
        <InfoRow icon={Globe} label="Time Zone" value={primaryCalendar?.timeZone} />
      </YStack>
    </Card>
  );
}
