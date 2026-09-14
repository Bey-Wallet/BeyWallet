import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useNavigation } from 'expo-router';
import { Button, XStack } from 'tamagui';
import { Filter } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { HistoryScreen } from '~/screens/HistoryScreen';

export default function History() {
  const navigation = useNavigation();
  const [showFilters, setShowFilters] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters((visible) => !visible);
  }, []);

  const filterHighlighted = showFilters || filtersActive;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <XStack pr="$4">
          <Button
            circular
            size="$3"
            chromeless
            icon={
              <Filter
                size={22}
                strokeWidth={filterHighlighted ? 2.8 : 2.4}
                color={filterHighlighted ? '$color' : '$gray10'}
              />
            }
            onPress={toggleFilters}
          />
        </XStack>
      ),
    });
  }, [navigation, filterHighlighted, toggleFilters]);

  return (
    <HistoryScreen showFilters={showFilters} onFiltersActiveChange={setFiltersActive} />
  );
}
