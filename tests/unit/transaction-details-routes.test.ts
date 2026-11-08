import RootDetails from '~/app/txn-details';
import ModalDetails from '~/app/(modals)/txn-details';
import { TransactionDetailsScreen } from '~/features/history/TransactionDetailsScreen';

jest.mock('~/features/history/TransactionDetailsScreen', () => ({
  TransactionDetailsScreen: jest.fn(),
}));

it('renders both transaction-detail entry points directly without a redirect back to the modal alias', () => {
  expect(RootDetails).toBe(TransactionDetailsScreen);
  expect(ModalDetails).toBe(TransactionDetailsScreen);
});
