import { QueryClient } from '@tanstack/react-query';

/** Shared without importing the root layout into wallet lifecycle services. */
export const queryClient = new QueryClient();
