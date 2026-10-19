import React from 'react';
import { ListItem, H6, Text } from 'tamagui';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { SettingItemConfig } from '~/features/settings/components/types';

export const SettingItem: React.FC<SettingItemConfig> = ({
  title,
  value,
  icon: Icon,
  onPress,
  disabled,
  color = '$color',
  opacity,
  bg = 'transparent',
  hoverStyle,
  pressStyle,
  isSwitch,
  checked,
  onCheckedChange,
}) => {
  const renderRight = () => {
    if (isSwitch) {
      return (
        <AppSwitch
          checked={!!checked}
          onCheckedChange={(next) => onCheckedChange?.(next)}
          accessibilityLabel={typeof title === 'string' ? title : 'Toggle setting'}
          disabled={disabled}
          variant="branded"
        />
      );
    }
    if (value) {
      return (
        <Text fontSize="$5" fontWeight="600" color={color}>
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
      title={
        typeof title === 'string' ? (
          <H6 fontSize="$5" fontWeight="600" color={bg === '$red3' ? '$red10' : '$accent8'}>
            {title}
          </H6>
        ) : (
          title
        )
      }
      py="$3.5"
      px="$4"
      icon={undefined}
      iconAfter={renderRight()}
      onPress={isSwitch ? () => onCheckedChange?.(!checked) : onPress}
      disabled={disabled}
      opacity={opacity}
    />
  );
};
