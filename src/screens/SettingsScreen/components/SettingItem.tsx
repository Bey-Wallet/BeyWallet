import React from 'react';
import { ListItem, H6 } from 'tamagui';
import { ChevronRight } from '@tamagui/lucide-icons';
import { SettingItemConfig } from './types';

export const SettingItem: React.FC<SettingItemConfig> = ({
    title,
    subTitle,
    icon: Icon,
    iconAfter: IconAfter = <ChevronRight size={24} />,
    onPress,
    disabled,
    color,
    opacity,
    bg = "transparent",
    hoverStyle,
    pressStyle
}) => {
    return (
        <ListItem
            hoverStyle={hoverStyle || { bg: '$backgroundHover' }}
            pressStyle={pressStyle || { bg: '$backgroundPress' }}
            bg={bg}
            fontWeight="600"
            title={typeof title === 'string' ? <H6 color={color}>{title}</H6> : title}
            py='$4'
            icon={typeof Icon === 'function' ? <Icon size={24} color={color} /> : Icon}
            iconAfter={typeof IconAfter === 'function' ? <IconAfter size={24} color={color} /> : IconAfter}
            onPress={onPress}
            disabled={disabled}
            opacity={opacity}
        />
    );
};
