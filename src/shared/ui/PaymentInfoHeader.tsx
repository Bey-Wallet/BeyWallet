import React, { useLayoutEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { CircleHelp } from '@tamagui/lucide-icons';
import { PaymentFlowHeader } from './PaymentFlowHeader';
import { HeaderIconButton } from './HeaderIconButton';
import type { BUISheetRef } from './BUI/BUISheet';
import { useReceiptSheet } from './ReceiptSheetContext';
import { InfoSheet } from '~/shared/components/info-sheets/InfoSheet';
import { infoSheetContent, type InfoTopic } from '~/shared/components/info-sheets/infoSheetContent';

/** Explicit opt-in for entry screens; an existing trailing action always takes priority. */
export function PaymentInfoHeader({
  infoTopic,
  ...props
}: React.ComponentProps<typeof PaymentFlowHeader> & { infoTopic: InfoTopic }) {
  const sheet = useRef<BUISheetRef>(null);
  const navigation = useNavigation();
  const receipt = useReceiptSheet();
  const available = !props.headerRight && !receipt?.hasSheetHeader;
  useLayoutEffect(() => {
    if (!available) return;
    // Native header options survive a stage change. Clear this stage's Info
    // action when it leaves so result and pending screens cannot inherit it.
    return () => navigation.setOptions({ headerRight: undefined });
  }, [navigation, available]);
  if (!available) return <PaymentFlowHeader {...props} />;
  return (
    <>
      <PaymentFlowHeader
        {...props}
        headerRight={() => (
          <HeaderIconButton
            icon={CircleHelp}
            accessibilityLabel={`${infoSheetContent[infoTopic].title} information`}
            disabled={props.disabled}
            onPress={() => sheet.current?.present()}
          />
        )}
      />
      <InfoSheet ref={sheet} topic={infoTopic} busy={props.disabled} />
    </>
  );
}
