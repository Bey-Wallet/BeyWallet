import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Preserve existing recovery links while the root navigator owns modal presentation. */
export function RecoverFundsLegacyRoute() {
  const { mintUrl } = useLocalSearchParams<{ mintUrl?: string }>();
  return <Redirect href={{ pathname: '/recover-funds', params: mintUrl ? { mintUrl } : {} }} />;
}
