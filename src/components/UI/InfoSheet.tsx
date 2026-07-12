import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { YStack, H3, Circle, Text, Button } from 'tamagui';
import { Info, CheckCircle2, AlertTriangle, XCircle } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';

export type InfoSheetType = 'success' | 'warning' | 'info' | 'error';

export interface InfoSheetRef {
    present: (options: {
        title: string;
        description: string;
        type?: InfoSheetType;
        buttonText?: string;
    }) => void;
    dismiss: () => void;
}

export const InfoSheet = forwardRef<InfoSheetRef>((_, ref) => {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const [config, setConfig] = useState<{
        title: string;
        description: string;
        type: InfoSheetType;
        buttonText: string;
    }>({
        title: '',
        description: '',
        type: 'info',
        buttonText: 'Dismiss',
    });

    useImperativeHandle(ref, () => ({
        present: (options) => {
            setConfig({
                title: options.title,
                description: options.description,
                type: options.type || 'info',
                buttonText: options.buttonText || 'Dismiss',
            });
            sheetRef.current?.present();
        },
        dismiss: () => {
            sheetRef.current?.dismiss();
        }
    }));

    const getIconConfig = () => {
        switch (config.type) {
            case 'success':
                return {
                    bg: '$green3',
                    color: '$green10',
                    Icon: CheckCircle2,
                };
            case 'warning':
                return {
                    bg: '$yellow3',
                    color: '$yellow10',
                    Icon: AlertTriangle,
                };
            case 'error':
                return {
                    bg: '$red3',
                    color: '$red10',
                    Icon: XCircle,
                };
            case 'info':
            default:
                return {
                    bg: '$blue3',
                    color: '$blue10',
                    Icon: Info,
                };
        }
    };

    const iconCfg = getIconConfig();
    const { Icon } = iconCfg;

    return (
        <AppBottomSheet ref={sheetRef}>
            <YStack p="$4" gap="$4" items="center">
                <Circle p="$3" bg={iconCfg.bg}>
                    <Icon size={32} color={iconCfg.color} />
                </Circle>
                <H3 textAlign="center" fontWeight="700" mt="$1">{config.title}</H3>
                <Text fontSize="$4" color="$color11" textAlign="center" px="$2">
                    {config.description}
                </Text>
                <Button
                    size="$5"
                    theme="active"
                    fontWeight="700"
                    rounded="$4"
                    width="100%"
                    mt="$3"
                    onPress={() => sheetRef.current?.dismiss()}
                >
                    {config.buttonText}
                </Button>
            </YStack>
        </AppBottomSheet>
    );
});

InfoSheet.displayName = 'InfoSheet';
