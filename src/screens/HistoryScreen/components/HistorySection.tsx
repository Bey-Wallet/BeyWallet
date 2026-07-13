import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'tamagui';

interface HistorySectionProps {
    title: string;
    children: React.ReactNode;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ title, children }) => {
    // When used as a FlashList header (children = null), just render the label
    if (!children) {
        return (
            <View style={styles.header}>
                <Text fontSize={12} fontWeight="700" color="$gray9" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    {title}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <View style={styles.header}>
                <Text fontSize={12} fontWeight="700" color="$gray9" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    {title}
                </Text>
            </View>
            <View style={styles.card}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginTop: 8,
    },
    header: {
        paddingHorizontal: 4,
        paddingVertical: 8,
        marginTop: 12,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        // Card uses theme bg via parent — transparent so Tamagui $gray2 shows
    },
});
