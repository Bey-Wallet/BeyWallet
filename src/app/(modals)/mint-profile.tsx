import { useLocalSearchParams } from 'expo-router';
import { MintProfileScreen } from '~/features/mints';

export default function MintProfileModal() {
  const { url } = useLocalSearchParams<{ url: string }>();

  if (!url) return null;

  return <MintProfileScreen url={url} />;
}
