import { JWTAuthProvider, NPCClient, type SigningFunc } from 'npubcash-sdk';
import { bech32 } from 'bech32';
import { Buffer } from 'buffer';

export const NPUB_CASH = 'https://npub.cash';
export const LEGACY_NPUB_CASH = 'https://npubx.cash';
const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

export function lightningAddress(npub: string): string {
  return `${npub}@npub.cash`;
}
export function lightningAddressQr(npub: string): string {
  return bech32
    .encode('lnurl', bech32.toWords(Buffer.from(`${NPUB_CASH}/.well-known/lnurlp/${npub}`)), 2000)
    .toUpperCase();
}

export function createNpubCashClient(
  provider: string,
  signer: SigningFunc,
  authorize: () => boolean = () => true,
  disconnected?: () => void,
  connected?: () => void,
): NPCClient {
  if (provider !== NPUB_CASH && provider !== LEGACY_NPUB_CASH)
    throw new Error('Unsupported provider');
  const guardedSigner: SigningFunc = async (event) => {
    if (!authorize()) throw new Error('Wallet unavailable');
    const url = event.tags.filter((tag) => tag[0] === 'u');
    const method = event.tags.filter((tag) => tag[0] === 'method');
    const allowed = [
      `${provider}/api/v2/auth/nip98`,
      `${provider.replace('https:', 'wss:')}/api/v2/ws/quote`,
    ];
    if (
      event.kind !== 27235 ||
      event.content !== '' ||
      url.length !== 1 ||
      !allowed.includes(url[0][1]) ||
      method.length !== 1 ||
      method[0][1] !== 'GET'
    )
      throw new Error('Unexpected authentication challenge');
    return signer(event);
  };
  const auth = new JWTAuthProvider(provider, guardedSigner, silentLogger);
  const client = new NPCClient(provider, {
    getAuthToken: async (url, method) => {
      if (!authorize()) throw new Error('Wallet unavailable');
      const target = new URL(url);
      const methods: Record<string, string> = {
        '/api/v2/wallet/quotes': 'GET',
        '/api/v2/user/info': 'GET',
        '/api/v2/user/mint': 'PATCH',
      };
      if (
        target.origin !== provider ||
        target.username ||
        target.password ||
        methods[target.pathname] !== method
      )
        throw new Error('Unexpected authenticated endpoint');
      const token = await auth.getAuthToken(url, method);
      if (!authorize()) throw new Error('Wallet unavailable');
      return token;
    },
    getNostrToken: (url, method) => auth.getNostrToken(url, method),
  });
  // SDK 0.3.2 exposes close through its logger, but not its subscription callback.
  // No metadata is logged; the close message only drives the lifecycle retry.
  client.setLogger({
    ...silentLogger,
    debug(message: string) {
      if (message === 'WebSocket connection closed') disconnected?.();
      if (message === 'WebSocket challenge success') connected?.();
    },
  });
  return client;
}
