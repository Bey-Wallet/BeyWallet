export const infoSheetContent = {
  'import-seed': {
    title: 'Import a recovery phrase',
    paragraphs: [
      'Enter the original 12 words in their exact order, separated by spaces. Keep your phrase private: anyone with it can access the wallet it protects.',
      'Continue opens Risk Acknowledgment. Import processing starts only after you agree on that screen.',
      'Bey checks for a backed-up mint list. Review the mints during recovery and add any missing mint URLs. Recovery depends on mint availability and supported recovery data; a phrase alone does not guarantee recovery of every token or transaction history.',
      'A recovery phrase differs from a full wallet backup, which also contains saved wallet data. Keep both securely.',
    ],
  },
  transfer: {
    title: 'About transfers',
    paragraphs: [
      'Transfer moves your ecash balance from one mint to another. Choose a source mint and a different destination mint.',
      'To pay another person or wallet, use Send.',
      'Lightning fees may apply. Review the maximum fee before confirming your transfer.',
    ],
  },
  'ecash-send': {
    title: 'Send ecash',
    paragraphs: [
      'Send creates an ecash token from your selected mint balance. Share it with the person or wallet you want to pay.',
      'Anyone who has an unlocked token can claim it. Keep it private and share it only with the intended recipient.',
      'A recipient lock restricts who can claim the token. Sharing a token does not by itself confirm that it has been claimed.',
    ],
  },
  'nostr-send': {
    title: 'Nostr delivery',
    paragraphs: [
      'Send ecash to a person using their Nostr identity. The token is delivered through encrypted messaging.',
      'Sent to relay means the message was published. It does not confirm that the recipient has read it or claimed the payment.',
      'Check the payment status in the conversation or History before sending again.',
    ],
  },
  'ecash-receive': {
    title: 'Receive ecash',
    paragraphs: [
      'Paste or scan an ecash token to receive it. The wallet checks the token and asks for approval when needed.',
      'Each token belongs to a mint. Review that mint before accepting its ecash; connecting to a mint and trusting it are separate decisions.',
      'Receiving can require a network connection, and mint fees may reduce the amount received. A token that has already been spent cannot be received again.',
    ],
  },
  'lightning-pay': {
    title: 'Lightning payments',
    paragraphs: [
      'Pay a Lightning invoice or address using ecash from the selected mint. The mint makes the Lightning payment.',
      'Review the amount and maximum fee before confirming. If a payment remains pending, check its status before trying again.',
    ],
  },
  'lightning-top-up': {
    title: 'Lightning top-up',
    paragraphs: [
      'Create an invoice from your selected mint, then pay it from another Lightning wallet. After payment and issuance complete, ecash is added to this mint balance.',
      'Creating or copying the invoice does not add funds. The invoice has an expiry, and your paying wallet may charge a Lightning fee.',
    ],
  },
  'lightning-request': {
    title: 'Payment requests',
    paragraphs: [
      'Request creates a Lightning invoice from your selected mint and sends it to the conversation.',
      'The other person must pay the invoice. Creating the request or publishing its message does not mean you have been paid.',
      'After the mint confirms payment and issues the ecash, your balance is credited. Check the conversation for payment status.',
    ],
  },
  'onchain-top-up': {
    title: 'On-chain deposits',
    paragraphs: [
      'This deposit uses Bitcoin on-chain through a mint that supports it. Send only to the address and network shown in the deposit details.',
      'Review the deposit amount, fees, expiry, and confirmation requirements before sending. Funds are not available immediately after broadcasting a transaction.',
    ],
  },
  'onchain-pay': {
    title: 'On-chain payments',
    paragraphs: [
      'Use ecash from a supporting mint to make a Bitcoin on-chain payment.',
      'Check the destination address, network, amount, and quoted fees before confirming. Bitcoin confirmations can take time; check a pending payment before trying again.',
    ],
  },
  'offline-change': {
    title: 'Offline change',
    paragraphs: [
      'Prepare smaller ecash denominations at the selected mint so more amounts can be assembled without contacting it when sending offline.',
      'Preparation requires a connection and may involve mint fees. Review the proposed change before confirming.',
      'Prepared change does not make offline verification prove that a token is unspent, or guarantee that every amount can be sent offline.',
    ],
  },
  optimize: {
    title: 'Wallet optimization',
    paragraphs: [
      'Optimization combines ecash proofs within the selected mint to reduce fragmentation. It does not transfer your balance to another mint.',
      'It requires a connection to the mint and may involve fees. Review the operation before confirming and let an in-flight operation finish.',
    ],
  },
  'lightning-address': {
    title: 'Lightning address',
    paragraphs: [
      'Your Lightning address lets others send Lightning payments that are received as ecash at your chosen receiving mint.',
      'Choose a receiving mint before enabling the address. Automatic collection controls whether pending payments are collected automatically.',
      'Disabling the service stops listening and collection in this wallet. It does not revoke an address already shared, and pending payments are preserved.',
    ],
  },
  'receiving-mint': {
    title: 'Receiving mint',
    paragraphs: [
      'This mint receives ecash from payments sent to your Lightning address. Choose a mint you trust and review its availability and fees.',
      'Changing this preference does not transfer existing balances between mints. Pending payments may still need attention at their original mint.',
    ],
  },
  'receiving-policy': {
    title: 'Receiving policy',
    paragraphs: [
      'Your receiving policy controls how incoming activity from people is handled, including whether approval is needed.',
      'Accepting a contact does not automatically make every mint they use trusted. Mint approval is a separate decision.',
      'Review unfamiliar senders and mints before accepting a payment.',
    ],
  },
  proofs: {
    title: 'Ecash proofs',
    paragraphs: [
      'Proofs represent your ecash at a mint. Unspent proofs are available to spend; in-flight proofs are involved in an operation; spent proofs are no longer spendable.',
      'Exported tokens can be spent by anyone who receives them unless they are locked. Keep exports private.',
      'Deleting spent proof records removes local records. It does not restore funds or reverse a payment.',
    ],
  },
  'verify-proofs': {
    title: 'Verify proofs',
    paragraphs: [
      'This checks stored DLEQ mint signatures without contacting the mint. Some mints and older proofs do not include the required data.',
      'A valid signature does not establish whether a proof is still unspent. Checking spend status requires contacting the mint.',
    ],
  },
  'mint-backup': {
    title: 'Mint-list backup',
    paragraphs: [
      'Mint-list backup publishes your mint URLs under your Nostr identity so they can be discovered when recovering this wallet.',
      'Mint URLs are public. This backup does not include your recovery phrase or spendable ecash, and it is not a full wallet backup.',
      'Keep your recovery phrase and full wallet backup separately.',
    ],
  },
  'export-backup': {
    title: 'Export backup',
    paragraphs: [
      'A full wallet backup includes your recovery phrase and wallet data, including spendable ecash. Keep the file private and store it securely.',
      'The file becomes out of date as you use your wallet. Restoring an old copy cannot make already spent ecash spendable again.',
    ],
  },
  'restore-backup': {
    title: 'Restore backup',
    paragraphs: [
      'Restoring imports a previously exported Bey Wallet backup and replaces the wallet data on this device.',
      'Export your current wallet before continuing. Authentication and confirmation are required before selecting the backup file.',
      'Restoring a file differs from recovering with a phrase: the file contains saved wallet data, while phrase recovery depends on discovery and what the mints can restore.',
    ],
  },
  'recover-funds': {
    title: 'Recover funds',
    paragraphs: [
      'Recovery searches selected mints for funds associated with this wallet. Review the discovered mints and choose which to recover from.',
      'Recovery depends on mint availability and supported recovery data. A recovery phrase alone does not guarantee discovery of every mint or every kind of ecash.',
      'Keep your mint list and full wallet backup as well as your recovery phrase.',
    ],
  },
  relays: {
    title: 'Nostr relays',
    paragraphs: [
      'Nostr relays carry messages and published wallet information such as mint-list backups. They are separate from the mints that issue your ecash.',
      'Connection problems can delay messaging and discovery. Recipient inbox relays may also be used for delivery.',
      'Changing relays reconnects the wallet. It does not transfer funds between mints or confirm that a payment has been claimed.',
    ],
  },
} as const;

export type InfoTopic = keyof typeof infoSheetContent;
