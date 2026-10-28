import type { FeedbackSeverity } from './feedbackCatalog';

// Explicit copy/severity: presentation never infers severity from English text.
export const interactionCopy = {
  clipboardReadFailed: {
    title: 'Could not read the clipboard. Paste or type the details.',
    severity: 'error',
  },
  usernameSaved: { title: 'Username saved', severity: 'success' },
  usernameProfilePending: {
    title: 'Username saved',
    body: 'Your profile will update when you reconnect.',
    severity: 'info',
  },
  usernameNeedsReview: {
    title: 'Username needs review',
    body: 'Your new name is active. The previous name could not be released. Review it in Settings.',
    severity: 'warning',
  },
  copyFailed: {
    title: 'Could not copy. Please try again.',
    severity: 'error',
  },
  couldNotVerifyStatusPleaseTryAgain: {
    title: 'Could not verify status. Please try again.',
    severity: 'error',
  },
  couldNotOpenBlockchainExplorer: {
    title: 'Could not open blockchain explorer',
    severity: 'error',
  },
  invoiceCopiedToClipboard: {
    title: 'Invoice copied to clipboard',
    severity: 'success',
  },
  transactionDetailsErasedFromDevice: {
    title: 'Transaction details erased from device',
    severity: 'success',
  },
  failedToDeleteTransaction: {
    title: 'Failed to delete transaction',
    severity: 'error',
  },
  fundsReclaimedToYourWallet: {
    title: 'Funds reclaimed to your wallet',
    severity: 'success',
  },
  couldNotConfirmReclaimCheckHistoryBefore: {
    title: 'Could not confirm reclaim. Check History before trying again.',
    severity: 'warning',
  },
  ecashCopied: {
    title: 'Ecash copied',
    severity: 'success',
  },
  failedToSwitchTokenVersion: {
    title: 'Failed to switch token version',
    severity: 'error',
  },
  paymentReceived: {
    title: 'Payment received',
    severity: 'success',
  },
  couldNotConfirmReceiptCheckHistoryBefore: {
    title: 'Could not confirm receipt. Check History before trying again.',
    severity: 'warning',
  },
  depositRemovedFromPending: {
    title: 'Deposit removed from pending',
    severity: 'info',
  },
  invoiceNotPaidYetTryAgainShortly: {
    title: 'Invoice not paid yet. Try again shortly.',
    severity: 'info',
  },
  publicKeyCopied: {
    title: 'Public key copied',
    severity: 'success',
  },
  bitcoinAddressCopied: {
    title: 'Bitcoin address copied',
    severity: 'success',
  },
  invoiceCopied: {
    title: 'Invoice copied',
    severity: 'success',
  },
  priceUnavailablePleaseTryAgainLater: {
    title: 'Price unavailable. Please try again later.',
    severity: 'error',
  },
  couldNotRefreshYourWalletPleaseTry: {
    title: 'Could not refresh your wallet. Please try again.',
    severity: 'error',
  },
  couldNotOpenTermsOfService: {
    title: 'Could not open terms of service',
    severity: 'error',
  },
  mintConnected: {
    title: 'Mint connected',
    severity: 'success',
  },
  copiedToClipboard: {
    title: 'Copied to clipboard',
    severity: 'success',
  },
  mintRemoved: {
    title: 'Mint removed',
    severity: 'success',
  },
  couldNotRemoveThisMintCheckIts: {
    title: 'Could not remove this mint. Check its balance and try again.',
    severity: 'error',
  },
  mintNameUpdated: {
    title: 'Mint name updated',
    severity: 'success',
  },
  couldNotSaveMintNamePleaseTry: {
    title: 'Could not save mint name. Please try again.',
    severity: 'error',
  },
  missingKeysPleaseReauthenticate: {
    title: 'Missing keys. Please re-authenticate.',
    severity: 'error',
  },
  couldNotDecodeKeys: {
    title: 'Could not decode keys',
    severity: 'error',
  },
  couldNotRegisterThisUsernamePleaseTry: {
    title: 'Could not register this username. Please try again.',
    severity: 'error',
  },
  usernameDeleted: {
    title: 'Username deleted',
    severity: 'success',
  },
  localReferenceRemoved: {
    title: 'Local reference removed',
    severity: 'info',
  },
  couldNotDeleteThisUsernamePleaseTry: {
    title: 'Could not delete this username. Please try again.',
    severity: 'error',
  },
  couldNotShareAddressPleaseTryAgain: {
    title: 'Could not share address. Please try again.',
    severity: 'error',
  },
  failedToOpenSavedWallet: {
    title: 'Failed to open saved wallet.',
    severity: 'error',
  },
  walletDeleted: {
    title: 'Wallet deleted',
    severity: 'success',
  },
  failedToCompletelyDeleteTheWallet: {
    title: 'Failed to completely delete the wallet.',
    severity: 'error',
  },
  importFailedPleaseTryAgain: {
    title: 'Import failed. Please try again.',
    severity: 'error',
  },
  walletCreationFailedPleaseTryAgain: {
    title: 'Wallet creation failed. Please try again.',
    severity: 'error',
  },
  addressPastedFromClipboard: {
    title: 'Address pasted from clipboard',
    severity: 'info',
  },
  addressCopiedToClipboard: {
    title: 'Address copied to clipboard',
    severity: 'success',
  },
  noNewPaymentsDetectedYet: {
    title: 'No new payments detected yet.',
    severity: 'info',
  },
  couldNotCheckPaymentStatusPleaseTry: {
    title: 'Could not check payment status. Please try again.',
    severity: 'error',
  },
  couldNotCopyInvoicePleaseTryAgain: {
    title: 'Could not copy invoice. Please try again.',
    severity: 'error',
  },
  paymentNotReceivedYetTryAgainShortly: {
    title: 'Payment not received yet. Try again shortly.',
    severity: 'info',
  },
  walletAlreadyOptimized: {
    title: 'Wallet already optimized',
    severity: 'info',
  },
  paymentRequestCopiedToClipboard: {
    title: 'Payment request copied to clipboard',
    severity: 'success',
  },
  requestSent: {
    title: 'Request sent',
    severity: 'success',
  },
  couldNotSendRequestPleaseTryAgain: {
    title: 'Could not send request. Please try again.',
    severity: 'error',
  },
  unableToCheckPaymentPleaseTryAgain: {
    title: 'Unable to check payment. Please try again.',
    severity: 'error',
  },
  couldNotReadThisQRCodeScan: {
    title: 'Could not read this QR code. Scan again or enter the payment details.',
    severity: 'error',
  },
  receiptHasNotBeenConfirmedYet: {
    title: 'Receipt has not been confirmed yet.',
    severity: 'info',
  },
  thisItemIsNoLongerAvailable: {
    title: 'This item is no longer available',
    severity: 'info',
  },
  clipboardIsEmpty: {
    title: 'Clipboard is empty',
    severity: 'info',
  },
} as const satisfies Record<string, { title: string; body?: string; severity: FeedbackSeverity }>;
