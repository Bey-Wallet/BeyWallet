import React from 'react';
import { Text } from 'react-native';

/** Keep the unit secondary to the amount without changing the enclosing text style. */
export function amountLabel(value: string, fontSize: number): React.ReactNode {
  if (!value.endsWith(' sats')) return value;
  return (
    <>
      {value.slice(0, -5)}
      <Text style={{ fontSize: Math.max(12, Math.round(fontSize * 0.55)), letterSpacing: 0 }}>
        {' sats'}
      </Text>
    </>
  );
}
