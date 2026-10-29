import { Redirect, useLocalSearchParams } from 'expo-router';
export default function LegacyTransactionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/txn-details', params: { id: id || '' } }} />;
}
