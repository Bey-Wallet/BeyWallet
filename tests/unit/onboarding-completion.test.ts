import * as SecureStore from 'expo-secure-store';
import { useOnboardingStore } from '~/state/onboardingStore';

jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState({
    isOnboarded: false,
    currentStep: 'permissions',
    generatedMnemonic: 'synthetic-seed-fixture',
  });
});

it('retains setup for retry if its completion marker cannot be saved', async () => {
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error('Synthetic storage failure'));
  await expect(useOnboardingStore.getState().completeOnboarding()).rejects.toThrow(
    'Could not save wallet setup',
  );
  expect(useOnboardingStore.getState()).toMatchObject({
    isOnboarded: false,
    currentStep: 'permissions',
    generatedMnemonic: 'synthetic-seed-fixture',
  });
  await useOnboardingStore.getState().completeOnboarding();
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith('bey_wallet_onboarded', 'true');
  expect(useOnboardingStore.getState()).toMatchObject({
    isOnboarded: true,
    currentStep: 'complete',
    generatedMnemonic: null,
  });
});
