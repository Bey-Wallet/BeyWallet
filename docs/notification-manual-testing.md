# Test notifications and feedback on your phone

Use an ordinary Android or iOS **preview build** containing these changes. Use a second wallet/account
to send small payments and messages to Bey. Record Android and iOS results separately. These checks
have not been performed on a connected device in this workspace.

## Get the updated app

- Existing development build: run `yarn start:low-memory`, open Bey, and reload it. If the native
  notifications module is unavailable, install a fresh native build before testing OS notifications.
- Android preview APK: `eas build -p android --profile preview`, then install the resulting APK.
- iOS preview: `eas build -p ios --profile preview`, then install it through your configured internal
  distribution. A registered test device and the project's signing setup are required.
- Expo Go and the browser are not substitutes for these native notification checks.

## 1. Find the new settings

1. Open **Settings → Preferences → Notifications**.
2. Verify there is a dedicated page with **Enable notifications**, **Show notification details**,
   **Payments**, **Messages**, and **Review needed**.
3. Leave **Show notification details OFF**. It should start off for both a new wallet and an existing
   wallet that has never opted in. An existing disabled Enable preference should stay disabled.
4. Tap **Allow notifications** if shown, or turn Enable off and back on. Grant the OS prompt.
5. Check that **System permission** updates. Merely receiving a payment must never open this prompt.

Expected: status is informational; changing a toggle produces visible state, not a success toast.

## 2. Receive while using a different screen

1. Unlock Bey and stay on Settings or History.
2. From the other wallet, send a small Nostr payment from an accepted sender using a connected/trusted
   mint. Alternatively, send to your enabled Lightning address and allow collection.
3. Wait for the payment to appear in Bey's history.
4. Count the feedback: there should be **one compact payment toast and one outcome vibration**. There
   should not also be an OS banner. Vibration depends on your device's haptic settings.
5. Tap **View** on the toast. It should open the relevant receipt.
6. Refresh that receipt, go back and reopen it, then restart Bey. The same receipt must not announce
   itself again.

If the sender or mint needs approval, expect **Payment needs review** and a **View** action instead of
payment success. Viewing the alert opens review; it must not trust a mint or claim funds by itself.

## 3. Finish a payment while its flow is open

1. In Bey, create a Lightning receive invoice and leave its payment screen open.
2. Pay the invoice from the other wallet.
3. Expect the existing result screen and one outcome vibration. There should be no extra payment
   toast or OS banner.
4. Repeat with ecash receive, a payment request, a Lightning send, and Transfer if you have two funded
   mints. Transfer should show one overall result, with no alerts for its internal payment legs.
5. Prepare an ecash token for sharing. The screen should say **Ecash ready to share**. It must not say
   the token was delivered or claimed until existing proof-state verification supports that state.
6. When an operation remains pending, check that its screen stays pending. Use its **Check status** or
   existing retry action; it must not create a second submitted payment.

## 4. Check messages and categories

1. Have an accepted contact send a message while you are in Settings. Expect one **New message** toast;
   **View** opens the conversation.
2. Leave that conversation open and receive another message. The conversation should show it without
   an extra global toast.
3. Repeat with a blocked contact. Their message must not generate a notification preview.
4. Turn the Messages category off and test OS delivery when an event is actually detected in the
   background. It should produce no OS message alert. In-app messages/results must still work.
5. Repeat the category check with Payments and Review needed.

## 5. Check background and lock-screen privacy

1. Keep details OFF. Begin a small payment operation, then press your phone's Home button while the
   operation is still in progress. Complete the other side from your second wallet if applicable.
2. If Bey detects and saves the completion while its process is running, expect at most one local
   notification: **Payment received — Open Bey to view your payment.**, or the corresponding private
   sent/pending/Transfer copy. It must contain no amount, sender, invoice, token, proof or key.
3. Repeat with the phone locked. Tap a delivered notification; authenticate first, then verify the
   correct destination opens.
4. Turn details ON and repeat, then turn **Hide balance** on. Details must remain hidden when balances
   are hidden or the wallet is locked. Locking/hiding balances should also dismiss existing sensitive
   foreground previews.
5. On Android, inspect **system Settings → Apps → Bey Wallet → Notifications**. A fresh installation
   should have the **Wallet activity** channel at normal importance. An upgraded installation should
   retain its existing channel/user settings.

Background receiving is conditional: mobile OS suspension and Bey's existing wallet/authentication
rules can prevent detection. If nothing is detected until reopening Bey, record **not detected in
background**, not a notification-delivery pass. Opening the app should catch up quietly.

## 6. Deny or revoke permission

1. From Bey's Notifications page, tap **Open system settings** and disable notifications for Bey.
2. Return to Bey. The permission status should refresh.
3. Receive a payment while using Bey. Its in-app receipt/toast must still work, with no permission
   prompt and no OS notification.
4. Re-enable permission in system settings and return. Verify the status refreshes again.
5. With biometric lock enabled, interrupt/cancel a permission request if your OS allows it. Then
   background and reopen Bey. Its authentication protection should still work normally.

## 7. Test notification taps and missing items

1. Keep a delivered notification without tapping it, background Bey, and tap it. It should navigate
   once. Repeated tap callbacks must not open duplicate screens.
2. Keep another delivered notification, close Bey without clearing the notification, then tap it.
   Authenticate if prompted; it should navigate after initialization. On Android, developers can use
   `adb shell am kill com.thehussein01.Bey` after backgrounding Bey and settling all operations to
   exercise process recreation. This tests opening an existing alert, not closed-app receiving.
3. Keep a receipt notification, delete that receipt from History, then tap the notification. Expect
   History plus **This item is no longer available**.
4. Tap an older notification while a new wallet operation is in progress. It must wait; it must not
   replace the payment/NFC/recovery screen or submit a financial action.
5. On a disposable test wallet, verify that deleting/replacing the wallet removes obsolete alerts
   and that an old alert cannot navigate into another wallet's data.

## 8. Check reconnect, restore and everyday errors

1. Receive a payment, toggle connectivity off/on, revisit History, and restart. No duplicate receipt
   alerts or vibration should occur.
2. Restore/import a test backup or run fund recovery. Restored balances should not produce a receipt
   storm. Incomplete recovery should retain its review result rather than claim full success.
3. Scan an invalid QR code. Expect a safe explanation and the ability to scan again.
4. Copy an invoice/address/ecash value, cancel a share/file picker, and try a permission-denied native
   action. Success feedback must follow completion; cancellation must not be described as success.
   Clipboard/disk/native failures require a device or developer fault-injection test if you cannot
   reproduce them naturally.
5. Turn on TalkBack/VoiceOver and Reduce Motion. Check that toasts/inline errors are announced,
   **View** is easy to activate, controls remain tappable, and the existing spinner still works.

## What counts as a failure

- One receipt causes two toasts, an extra OS banner, or duplicate outcome vibrations.
- A prepared/pending/unknown payment is called delivered, claimed, completed, or definitely failed
  without the existing verified evidence.
- Notification content exposes a secret or private default detail, or a tap performs payment/claim/
  trust/retry instead of navigation.
- A notification interrupts a protected operation, bypasses authentication, or opens another wallet.
- Reopening history, reconnecting or restarting replays an already-delivered receipt.

**Fully closed-app receiving alerts are unsupported.** Do not expect a new payment to wake a force-
stopped or terminated Bey process. Receiving an old notification tap after a cold start is a separate
capability.

For each check, record: platform/OS, build, wallet lock and hidden-balance state, permission settings,
what event Bey actually detected, visual count, haptic count, tap destination, and pass/fail/not observed.

Settled receipt destinations open as outlined bottom sheets; pending and review-needed destinations
use full screens. Follow the
[transaction receipt device checklist](transaction-receipts.md#manual-checks-on-android-and-ios-preview-builds)
for cold/warm taps, nested details, locked state, gestures, and protected claim/reclaim actions.
These native sheet checks remain **not observed** until performed on Android/iOS preview builds.
