# People conversation UX

Use familiar chat interactions while retaining Bey's monochrome palette, Inter typography,
compact People list, red unread counts and payment-first conversations. The reference is
interaction quality, not another library's visual design or an instruction to install it.

## Keyboard foundation implemented

- Install `react-native-keyboard-controller` 1.18.5, as specified by Expo SDK 54's bundled modules.
- Mount one KeyboardProvider inside the app's existing gesture/safe-area providers, surrounding
  navigation and bottom-sheet portals. Preserve the existing Android edge-to-edge layout.
- Disable startup keyboard preloading because Home has no composer; avoid startup keyboard flashes.
- Use the library's KeyboardAvoidingView with padding on both native platforms. Keep the custom
  conversation header stationary while the timeline and composer fit above the keyboard.
- Anchor to the latest activity on viewport resize only when already near the bottom. Preserve
  the position of someone reading older messages and the existing pagination prepend anchor.
- Retain the four-line composer, payment controls, acceptance/blocking and encrypted send/retry paths.

This is native code: existing custom development/preview clients need rebuilding. JavaScript
reload and OTA updates cannot add the module to an old binary. Ship a compatible native runtime
before distributing an OTA that imports this dependency; the app currently uses appVersion for
runtimeVersion. No native build or device interaction is verified by unit tests.

References: [installation](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation),
[1.18 KeyboardAvoidingView](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/1.18.0/api/components/keyboard-avoiding-view),
[1.18 provider](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/1.18.0/api/keyboard-provider).

## Recommended next improvements

These are proposals, not implemented features. Scope and validate one at a time.

### 1. Timeline and navigation

- Reuse the installed LegendList for a virtualized mixed text/payment timeline. Preserve stable
  activity IDs and the visible item when prepending older messages; avoid loading/rendering the
  entire conversation. Benchmark long restored-wallet conversations on a normal device build.
- Add a small jump-to-latest control with a count of new activity while reading above the bottom.
  Incoming activity must not pull the reader away. Keep the existing immediate outgoing bubble.
- Add an unread divider when opening a conversation. Define how reading/visibility clears it
  before changing the current mark-on-open policy; local read state is not a remote read receipt.
- Keep the existing calendar separators. Refine consecutive text groups by sender, day and time
  gap rather than direction alone, with clear boundaries around payment cards.

### 2. Composer and message actions

- Replace floating payment buttons with a compact, intentional action area integrated into the
  composer. Keep Pay and Request easy to reach without overlapping the last message.
- Preserve a wallet-scoped draft per conversation, including navigation away and send failures.
  Decide protected local storage, wallet deletion cleanup and backup behavior before persistence.
- Add long-press actions anchored to the selected text bubble: copy, select text, details and retry
  where applicable. Keep full payment tokens/proofs out of generic text-copy actions.
- Make retry and publication failure easy to discover beside the failed bubble. Preserve existing
  message IDs/ciphertext and contact/authentication checks on every retry.

### 3. Finding and managing conversations

- Add search inside a conversation for local text, safe notes, amounts and dates, with navigation
  between matches. Keep raw tokens/proofs out of the index; avoid relay requests while typing.
- Add pinned conversations for frequent contacts. Consider archive and mute separately: archiving
  must not delete history, and muting must actually integrate with notification delivery.
- Improve empty/offline states with short, actionable explanations. Describe relay publication
  accurately; a connection indicator must not imply that the recipient is online or has read a message.
- Recognize ordinary links with an explicit open action. Defer automatic remote link previews until
  their metadata/privacy behavior is defined; viewing a private message should not silently fetch URLs.

### 4. Richer messaging, with interoperable transport

- Add quoted replies only after defining NIP-17 reply references, storage and legacy NIP-04 fallback.
  A reply should remain understandable when the original is unavailable or contains a payment.
- Add reactions after defining encrypted event transport, authentication, deduplication and persistence.
  Incoming reactions must not appear as ordinary text or trigger payment handling.
- Consider photos and voice messages later, with an explicit media host, encryption/access model,
  upload limits, retry/cancel behavior, retention and device permissions. This is more than adding
  attachment buttons. Native media dependencies need separate approval.
- Treat typing indicators and delivered/read receipts as separate opt-in protocol/privacy work.
  Never infer them from relay acknowledgement or local read markers. Keep NIP-17 the default and
  legacy NIP-04 selection explicit.

### 5. Finish and accessibility

- Keep restrained motion and haptics, respecting reduced motion. Keep previews compact and accessible
  at large text sizes, and retain minimum 48-point touch targets.
- Validate screen-reader order and labels for composer controls, mixed payment cards, unread counts
  and context actions. Keep amounts/currency, payment status and contact identity distinguishable.
- Review both themes, small phones, slow connections, reconnects, hardware keyboards and long histories.

Recommended order: keyboard device verification → virtualized timeline/jump-to-latest → composer
and message actions → conversation search/drafts → replies/reactions → media.
