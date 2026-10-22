import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useNavigation } from 'expo-router';
import { XStack } from 'tamagui';
import { SlidersHorizontal } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { HistoryScreen } from '~/features/history';

export default function History() {
  const navigation = useNavigation();
  const [showFilters, setShowFilters] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters((visible) => !visible);
  }, []);

  const filterHighlighted = showFilters || filtersActive;
  const closeFilters = useCallback(() => setShowFilters(false), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <XStack pr="$4">
          <AppIconButton
            variant="default"
            emphasis={filterHighlighted ? 'primary' : 'secondary'}
            size="small"
            shape="circular"
            accessibilityLabel="Filter history"
            icon={
              <SlidersHorizontal
                size={22}
                strokeWidth={2}
                color={filterHighlighted ? '$onAccent' : '$iconPrimary'}
              />
            }
            onPress={toggleFilters}
          />
        </XStack>
      ),
    });
  }, [navigation, filterHighlighted, toggleFilters]);

  return (
    <HistoryScreen
      showFilters={showFilters}
      onFiltersClose={closeFilters}
      onFiltersActiveChange={setFiltersActive}
    />
  );
}
