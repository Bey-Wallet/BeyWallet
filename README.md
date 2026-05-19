# Bey Wallet ⚡️

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Expo](https://img.shields.io/badge/Made%20with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-000000?logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![Cashu](https://img.shields.io/badge/Protocol-Cashu-FFD700.svg)](https://cashu.space)

> **Modular, Local-First Ecash Wallet for Bitcoin & Nostr.**

Bey Wallet is a premium, privacy-centric ecash wallet built on the **Cashu** protocol. It brings together high-speed Bitcoin payments and the censorship-resistant identity of **Nostr** in a fluid, modern interface.

---

## 📸 Preview

<div align="center" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/fddb0208-c9bb-4474-9837-99cbdf1331e2" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/b69f8b0f-0094-4768-87e1-f253a70ae7af" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/792bd336-f21a-4605-9137-fe037d33ea6f" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/be0c332e-e311-4d2f-9b11-c4a9e74c14f2" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/3d1a1d52-5cf9-4861-ae48-055f3901e8d0" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/c0c4be99-24c1-4aa7-91b6-fae384ab6ac3" />





  
 


</div>

---

## ✨ Features

### 💰 Cashu (Ecash) & Bitcoin
*   **Next-Gen Standards**: Support for V3 and V4 Cashu tokens (NUT-00, NUT-11 P2PK).
*   **Mint Management**: Professional dashboard to add, trust, and monitor multiple community mints.
*   **Offline NFC Payments**: Send and receive ecash seamlessly by tapping phones, even completely offline.
*   **Total Control**: Manage balances across different mints with real-time audit logs and multi-currency fiat conversions.

### 🆔 Nostr Integration
*   **Built-in Identity**: Generate your `npub` directly from your wallet seed and claim your free `@bey.cash` NIP-05 identifier.
*   **Social Payments**: Send ecash locked to any receiver's Nostr public key (P2PK) for ultimate security.
*   **Direct Messages (DMs)**: Send, receive, and **request** Ecash instantly via encrypted Nostr Direct Messages (NIP-04/NIP-17). Payments arrive and are detected automatically in the background.
*   **Contact Management**: Built-in address book to save and resolve your friends' Npubs and aliases.

### 🛡️ Privacy & Security
*   **Local-First Design**: Your data stays on your device. Period. Powered by high-performance SQLite.
*   **Secure Enclave**: Your recovery phrase and private keys are protected by hardware-level security.
*   **Biometric Guard**: Face ID, Touch ID, or Passcode protection for every sensitive operation.

### 💾 Reliability
*   **Deterministic Recovery**: Restore your entire wallet balance across all mints with just 12 words.
*   **Smart Backups**: Export and import complete wallet state via encrypted `.bey` files.

---

## 🛠️ Tech Stack

*   **Engineering**: [Expo](https://expo.dev/) & [React Native](https://reactnative.dev/)
*   **Design System**: [Tamagui](https://tamagui.dev/) (Dynamic, type-safe styles)
*   **Logic**: [Zustand](https://docs.pmnd.rs/zustand/) & [TanStack Query](https://tanstack.com/query/latest)
*   **Storage**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
*   **Core Protocols**: `cashu-ts`, `nostr-tools`

---

## 🏗️ Development

### Prerequisites
*   Node.js & Yarn
*   [Expo CLI](https://docs.expo.dev/get-started/installation/)
*   [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`)

### Quick Start
1.  **Clone the repo**:
    ```bash
    git clone https://github.com/arshfx01/bey-wallet.git
    cd bey-wallet
    ```
2.  **Install dependencies**:
    ```bash
    yarn install
    ```
3.  **Start the app**:
    ```bash
    npx expo start
    ```

### Building for Production
Bey Wallet uses EAS for builds. To build the production APK:
```bash
eas build -p android --profile production
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) to get started.

---

## ⚖️ License

Distributed under the Apache License, Version 2.0. See `LICENSE` for more information.

---

<p align="center">Made with ❤️ for the Bitcoin & Nostr communities.</p>
