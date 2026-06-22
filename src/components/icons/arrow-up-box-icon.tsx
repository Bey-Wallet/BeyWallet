import React from 'react';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from 'tamagui';
import { IconProps } from '../../types/icon';

const ArrowUpBoxIcon = ({ size = 24, color, strokeWidth = 2 }: IconProps) => {
    const theme = useTheme();
    const iconColor = color || theme.color.val;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M0 0h16v16H0z" fill="none"
            />
            <Path
                fill={iconColor}
                fillRule="evenodd"
                d="M7.47 1.22a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 1 1-1.06 1.06L8.75 3.56v7.69a.75.75 0 0 1-1.5 0V3.56L6.03 4.78a.75.75 0 0 1-1.06-1.06zM4.25 6.5a.75.75 0 0 1 0 1.5H4a1.5 1.5 0 0 0-1.5 1.5V12A1.5 1.5 0 0 0 4 13.5h8a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 12 8h-.25a.75.75 0 0 1 0-1.5H12a3 3 0 0 1 3 3V12a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3z"
                clipRule="evenodd"
            />
        </Svg>
    );
};

export default ArrowUpBoxIcon;

