# Header and utility icon manual checks

Header actions use 22-point glyphs. Other utility icon buttons use proportional
14/16/18/20/24-point glyphs from xxsmall through large. Back and close controls stay
on the left. Check both light and dark mode, larger system text, and Android hardware back.
Keep every control easy to tap: at least a 48-point effective target, including hit slop.

## Navigation and headers

| Area                                                                                      | What to check                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Settings root and all preference screens                                                  | Left back arrow; root returns to the originating tab, nested screens return to their parent; centered title. |
| Conversation, including legacy person-details links                                       | Left back arrow returns to People or the originating screen; contact and info icons stay on the right.       |
| Mints and mint details                                                                    | Back arrow; scan, edit, and save icons use the common header size.                                           |
| Mint profile, Discover Mints, transaction details, token details, Proof Manager           | Back arrow returns to the previous screen; direct entry remains safe.                                        |
| Nostr username, settings, diagnostics, activity                                           | Back arrow; profile refresh uses the common header size.                                                     |
| Standalone modals: Nostr profile, search, people search, updates, backup, optimize wallet | Left X dismisses; unrelated header actions stay on the right.                                                |
| Scanner                                                                                   | Left X; paste and flashlight icons use the common header size; scan/paste actions still work.                |
| Onboarding consent                                                                        | Left back arrow; existing destination preserved.                                                             |
| Home header and History                                                                   | NFC icon uses the common header size; filter icon is 22 points and retains its selected background.          |
| Home mint selector                                                                        | Left X, centered title, right add icon; locked selection still disables actions.                             |
| Send/Receive action sheets                                                                | Left X at root; choosing Bitcoin replaces it with a left back arrow; back returns to choices, X dismisses.   |

Restore progress and pending-token Share / Send sheets also use a left X at the shared
header size, with centered titles.

## Payment stages

| Flow                                               | What to check                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Send ecash, locked ecash, Nostr send, scan and pay | Initial screen uses X; confirmation uses back; returning to initial input restores X.                                       |
| Send results and pending token                     | Left X; done, copy, share, and reclaim actions retain behavior.                                                             |
| Payment requests received for payment              | Left X exits the request review/pending screen; disabled while sending.                                                     |
| Receive ecash                                      | Initial X; confirmation back returns to editable input; scanned-token direct review uses X because it exits; results use X. |
| Request ecash                                      | Left X for request and success stages; generation/sending retains disabled controls.                                        |
| Lightning top-up                                   | Amount uses X; confirmation uses back; invoice and result use X. Back from confirmation restores the initial X.             |
| Lightning payment                                  | Input uses X; confirmation back returns to invoice input and restores X; receipt uses X.                                    |
| Transfer                                           | Amount uses X; confirmation uses back; result uses X.                                                                       |
| On-chain deposit                                   | Initial confirmation uses X; preparing deposit disables the control; deposit address and result use X.                      |
| On-chain payment                                   | Input uses X; confirmation uses back; sending disables it; pending/result uses X; error retry uses back to return to input. |
| Historical pending transactions                    | Back arrow returns to History, including pending invoices, tokens, and on-chain transactions.                               |
| Amount keypad                                      | Backspace glyph deletes the last digit and does not look like screen navigation.                                            |

## Utility controls affected by shared sizing

- Home: backup/username notice dismissals, restore dismissal, and connected-mint add action.
- People: clear/paste search, people-search paste/scan, profile-item copy, and conversation send.
- Mints: details copy and mint health refresh.
- Nostr profile: retry lookup and share; Settings relays: copy and remove.
- Payment inputs: clear, paste, scan, Nostr paste, and receive-preview refresh.
- Payment details: table copy, status refresh, token options, and pending-token settings dismissal.
- Universal input: clear and validation controls; button playground: tertiary icon examples.

Check enabled, disabled, loading, and pressed states. Home action cards, bottom-tab icons,
avatars, status artwork, payment logic, and spinner animation are intentionally preserved.
Native appearance, touch behavior, biometrics, NFC, and real payment execution require device checks.
