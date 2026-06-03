import React from 'react';
import { ListItem, H6, Text } from 'tamagui';
import { SettingItemConfig } from './types';

export const SettingItem: React.FC<SettingItemConfig> = ({
    title,
    value,
    icon: Icon,
    onPress,
    disabled,
    color = '$blue10',
    opacity,
    bg = "transparent",
    hoverStyle,
    pressStyle
}) => {
    const renderRight = () => {
        if (value) {
            return (
                <Text 
                    fontSize="$5" 
                    fontWeight="600" 
                    color={color}
                >
                    {value}
                </Text>
            );
        }
        if (Icon) {
            return typeof Icon === 'function' ? <Icon size={22} color={color} /> : Icon;
        }
        return null;
    };

    return (
        <ListItem
            hoverStyle={hoverStyle || { bg: '$backgroundHover' }}
            pressStyle={pressStyle || { bg: '$backgroundPress' }}
            bg={bg}
            title={typeof title === 'string' ? <H6 fontSize="$5" fontWeight="600" color={bg === '$red3' ? '$red10' : '$color'}>{title}</H6> : title}
            py='$3.5'
            px='$4'
            icon={undefined}
            iconAfter={renderRight()}
            onPress={onPress}
            disabled={disabled}
            opacity={opacity}
        />
    );
};
