import { Router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/store/walletStore';
import { UniversalInputResult } from './universalInputResolver';

export interface RedirectOptions {
    router: Router;
    onBeforeRedirect?: () => void;
    replace?: boolean;
}

export function handleUniversalRedirect(result: UniversalInputResult, options: RedirectOptions): boolean {
    if (result.type === 'unknown' || result.error) {
        return false;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (options.onBeforeRedirect) {
        options.onBeforeRedirect();
    }

    const { router, replace = false } = options;
    const nav = replace ? router.replace : router.push;

    switch (result.type) {
        case 'cashu_token':
        case 'bey_share_token': {
            const token = result.resolvedData?.token || result.cleaned;
            nav({
                pathname: '/(modals)/receive',
                params: { mode: 'receive', scannedToken: token }
            });
            return true;
        }

        case 'cashu_request':
        case 'bey_share_request': {
            const paymentRequest = result.resolvedData?.paymentRequest || result.cleaned;
            nav({
                pathname: '/(modals)/send',
                params: { paymentRequest }
            });
            return true;
        }

        case 'lightning_invoice':
        case 'lightning_address': {
            const target = result.resolvedData?.invoice || result.resolvedData?.address || result.cleaned;
            useWalletStore.getState().setScannerResult(target);
            nav('/(modals)/melt' as any);
            return true;
        }

        case 'bitcoin_onchain': {
            const address = result.resolvedData?.address || result.cleaned;
            useWalletStore.getState().setScannerResult(address);
            nav('/(modals)/melt?mode=onchain' as any);
            return true;
        }

        case 'nostr_contact':
        case 'bey_username': {
            const npub = result.resolvedData?.npub || result.cleaned;
            const username = result.resolvedData?.username;
            nav({
                pathname: '/(modals)/send',
                params: {
                    mode: 'nostr',
                    to: npub,
                    ...(username ? { username } : {})
                }
            });
            return true;
        }

        default:
            return false;
    }
}
