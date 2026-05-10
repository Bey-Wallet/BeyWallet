# Bey Wallet ⚡️

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Expo](https://img.shields.io/badge/Made%20with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-000000?logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![Cashu](https://img.shields.io/badge/Protocol-Cashu-FFD700.svg)](https://cashu.space)

> **Modular, Local-First Ecash Wallet for Bitcoin & Nostr.**

Bey Wallet is a premium, privacy-centric ecash wallet built on the **Cashu** protocol. It brings together high-speed Bitcoin payments and the censorship-resistant identity of **Nostr** in a fluid, modern interface.

---

## 📸 Preview

<div align="center">
  
  <!-- <img src="./assets/banner.png" width="800" alt="Bey Wallet Banner" /> -->
  <img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/3e2d78d1-8728-4b16-b218-4141f28ed6ff" />
  <img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/cf34a709-03b0-4b3f-8d28-5f01fb9782ba" />
  <img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/ebcc4044-cc31-4388-a6b5-3433befa9ac9" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/faa37928-0d9f-4210-bad7-c488c7edcb9d" />
<img width="95" height="210" alt="image" src="https://github.com/user-attachments/assets/d92709b2-b5a7-4215-8043-f2a9625d776e" />


</div>

---

## ✨ Features

### 💰 Cashu (Ecash) & Bitcoin
*   **Next-Gen Standards**: Support for V3 and V4 Cashu tokens for maximum compatibility.
*   **Mint Management**: Professional mint dashboard to add, trust, and monitor multiple community mints.
*   **One-Tap Setup**: Simplified onboarding that gets you started with reliable default mints in seconds.
*   **Total Control**: Manage balances across different mints with real-time audit logs.

### 🆔 Nostr Integration
*   **Built-in Identity**: Transparently generate your Nostr `npub` directly from your wallet seed.
*   **Social Payments**: Send ecash locked to any receiver's Nostr public key (P2PK).
*   **Cloud Sync**: Securely sync your mint preferences and history via your preferred Nostr relays.

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
