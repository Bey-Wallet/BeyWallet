import { ReactNode } from 'react';

export interface SettingItemConfig {
    id: string;
    title: string | ReactNode;
    subTitle?: string;
    icon: any;
    iconAfter?: any;
    onPress?: () => void;
    disabled?: boolean;
    color?: string;
    opacity?: number;
    bg?: string;
    hoverStyle?: any;
    pressStyle?: any;
}

export interface SettingSectionConfig {
    title: string;
    titleColor?: string;
    items: SettingItemConfig[];
    bg?: string;
}
