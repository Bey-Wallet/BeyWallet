import type { Plugin, ServiceMap } from 'coco-cashu-core';

export type ChangeServices = Pick<ServiceMap, 'walletService' | 'proofService' | 'eventBus'>;
let services: ChangeServices | undefined;
export function getChangeServices(): ChangeServices {
  if (!services) throw new Error('Open your wallet first.');
  return services;
}
export const ChangePreparationPlugin: Plugin<['walletService', 'proofService', 'eventBus']> = {
  name: 'change-preparation',
  required: ['walletService', 'proofService', 'eventBus'],
  onInit: ({ services: current }) => {
    services = current;
    return () => {
      if (services === current) services = undefined;
    };
  },
};
