// Polyfills - MUST BE IMPORTED FIRST
import '../polyfills';

import '../../tamagui-web.css'
import { RootLayout } from '../components/layout/RootLayout'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

export default RootLayout
