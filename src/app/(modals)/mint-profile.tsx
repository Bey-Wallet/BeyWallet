import { useLocalSearchParams } from 'expo-router';
import { MintProfileScreen } from '../../screens/MintProfileScreen';

export default function MintProfileModal() {
  const { url } = useLocalSearchParams<{ url: string }>();

  if (!url) return null;

  return <MintProfileScreen url={url} />;
}
