/**
 * Translations module — language resources for i18next.
 *
 * Each key is a locale code (e.g. 'en-US') and the value is a flat
 * { key: translatedString } map used by i18next's `translation` namespace.
 *
 * To add a new language:
 *   1. Create a new entry below with the locale code as key.
 *   2. Fill in the translation strings.
 *
 * See https://www.i18next.com/translation-format for the flat-key format.
 */

const translations: Record<string, Record<string, string>> = {
    'en-US': {
        // Common
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.retry': 'Retry',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.back': 'Back',
        'common.next': 'Next',
        'common.done': 'Done',

        // Wallet
        'wallet.balance': 'Balance',
        'wallet.send': 'Send',
        'wallet.receive': 'Receive',
        'wallet.scan': 'Scan',
        'wallet.history': 'History',
        'wallet.settings': 'Settings',
        'wallet.mint': 'Mint',
        'wallet.melt': 'Melt',
        'wallet.swap': 'Swap',

        // Send
        'send.title': 'Send Ecash',
        'send.amount': 'Amount',
        'send.recipient': 'Recipient',
        'send.confirm': 'Confirm Send',
        'send.success': 'Payment Sent!',
        'send.error': 'Send Failed',

        // Receive
        'receive.title': 'Receive Ecash',
        'receive.paste': 'Paste Token',
        'receive.scan': 'Scan QR Code',
        'receive.nfc': 'Receive via NFC',
        'receive.success': 'Payment Received!',
        'receive.error': 'Receive Failed',

        // Settings
        'settings.title': 'Settings',
        'settings.theme': 'Theme',
        'settings.currency': 'Currency',
        'settings.language': 'Language',
        'settings.backup': 'Backup Seed',
        'settings.delete': 'Delete Wallet',
        'settings.biometric': 'Biometric Lock',
        'settings.notifications': 'Notifications',

        // Onboarding
        'onboarding.welcome': 'Welcome to Bey Wallet',
        'onboarding.create': 'Create New Wallet',
        'onboarding.import': 'Import Existing Wallet',
        'onboarding.seed': 'Recovery Phrase',
        'onboarding.seed.warning': 'Write down these 12 words and store them safely. They are the only way to recover your wallet.',
    },
};

export default translations;
