import React from 'react';
import { XStack, YStack, Text, Button, View, Input } from 'tamagui';
import { Clipboard as ClipboardIcon, ScanLine, X as XIcon } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import * as Haptics from 'expo-haptics';

interface DestinationInputRowProps {
    value: string;
    onChangeText: (val: string) => void;
    placeholder?: string;
    label?: string;
    onPaste: () => void;
    onScan: () => void;
    defaultIcon?: React.ReactNode;
    isPasting?: boolean;
    onIconPress?: () => void;
    isError?: boolean;
}

export function DestinationInputRow({
    value,
    onChangeText,
    placeholder = 'Enter address...',
    label,
    onPaste,
    onScan,
    defaultIcon,
    isPasting = false,
    onIconPress,
    isError = false,
}: DestinationInputRowProps) {
    const [isFocused, setIsFocused] = React.useState(false);
    const inputRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (isFocused && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isFocused]);

    const isNpubOrNostr = React.useMemo(() => {
        const val = value.trim().toLowerCase();
        return val.startsWith('npub1') || val.endsWith('@bey.cash') || val.includes('.');
    }, [value]);

    const showBlockies = isNpubOrNostr && value.trim().length > 0;

    const handleClear = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChangeText('');
    };

    const containerBg = isError ? '$red3' : '$gray3';
    const textColor = isError ? '$red10' : '$color';
    const labelColor = isError ? '$red9' : '$gray10';
    const accentColor = isError ? '$red10' : '$accent5';

    return (
        <XStack
            justify="space-between"
            items="center"
            width="100%"
            bg={containerBg}
            p="$4"
            rounded="$6"
            minH={70}
        >
            <XStack gap="$3" items="center" flex={1} mr="$2">
                {showBlockies ? (
                    <Blockies seed={value.trim()} size={10} scale={3} style={{ borderRadius: 5 }} onPress={onIconPress} />
                ) : (
                    defaultIcon && (
                        <View 
                            items="center" 
                            justify="center"
                            onPress={onIconPress}
                            pressStyle={onIconPress ? { opacity: 0.7 } : undefined}
                        >
                            {React.isValidElement(defaultIcon) 
                                ? React.cloneElement(defaultIcon as React.ReactElement<any>, { color: isError ? '$red10' : (defaultIcon.props.color || '$accent5') }) 
                                : defaultIcon}
                        </View>
                    )
                )}
                
                <YStack flex={1} justify="center">
                    {label && (
                        <Text fontSize="$1" fontWeight="800" color={labelColor} textTransform="uppercase" mb="$1">
                            {label}
                        </Text>
                    )}
                    
                    {isFocused || !value ? (
                        <Input
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            placeholderTextColor={isError ? '$red8' : undefined}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            size="$3"
                            borderWidth={0}
                            bg="transparent"
                            autoCapitalize="none"
                            autoCorrect={false}
                            color={textColor}
                            fontSize="$5"
                            fontWeight={800}
                            p={0}
                            height={30}
                            style={{ outlineStyle: 'none' }}
                        />
                    ) : (
                        <Text
                            fontSize="$5"
                            fontWeight="800"
                            color={accentColor}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            onPress={() => setIsFocused(true)}
                            height={30}
                            style={{ lineHeight: 30 }}
                        >
                            {value}
                        </Text>
                    )}
                </YStack>
            </XStack>

            <XStack gap="$1" items="center">
                {value.length > 0 ? (
                    <Button
                        size="$3"
                        circular
                        chromeless
                        icon={<XIcon size="$1.5" color={accentColor} strokeWidth={2.5} />}
                        onPress={handleClear}
                    />
                ) : (
                    <>
                        <Button
                            size="$3"
                            circular
                            chromeless
                            icon={<ClipboardIcon size="$1.5" color={accentColor} strokeWidth={2.5} />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                                onPaste();
                            }}
                            disabled={isPasting}
                        />
                        <Button
                            size="$3"
                            circular
                            chromeless
                            icon={<ScanLine size="$1.5" color={accentColor} strokeWidth={2.5} />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                                onScan();
                            }}
                        />
                    </>
                )}
            </XStack>
        </XStack>
    );
}
