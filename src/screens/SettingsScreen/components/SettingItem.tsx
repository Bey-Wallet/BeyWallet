import React from 'react';
import { ListItem, H6, Text, Switch } from 'tamagui';
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
    pressStyle,
    isSwitch,
    checked,
    onCheckedChange
}) => {
    const renderRight = () => {
        if (isSwitch) {
            return (
                <Switch
                    size="$3"
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    backgroundColor={checked ? "#34C759" : "$gray5"}
                >
                    <Switch.Thumb animation="bouncy" />
                </Switch>
            );
        }
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
            onPress={isSwitch ? () => onCheckedChange?.(!checked) : onPress}
            disabled={disabled}
            opacity={opacity}
        />
    );
};
