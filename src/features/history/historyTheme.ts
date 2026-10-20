import { useAppTheme } from '~/shared/theme/ThemeContext';

// Sampled from the supplied History reference. Keep this palette local to History.
export const historyDarkColors = {
  background: '#000000',
  card: '#171719',
  circle: '#222224',
  selectedPill: '#2F2E33',
  primary: '#D8D8DA',
  secondary: '#8F8E93',
  icon: '#8C8B91',
  pillText: '#F1F0F3',
  hover: '#202022',
  press: '#29282C',
};

const historyLightColors: typeof historyDarkColors = {
  background: '#FFFFFF',
  card: '#F3F3F5',
  circle: '#E5E5E9',
  selectedPill: '#DCDCE2',
  primary: '#29282D',
  secondary: '#76757C',
  icon: '#77767D',
  pillText: '#29282D',
  hover: '#EDEDF0',
  press: '#E3E3E8',
};

export function useHistoryColors() {
  return useAppTheme().resolvedTheme === 'dark' ? historyDarkColors : historyLightColors;
}
