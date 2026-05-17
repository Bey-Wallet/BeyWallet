import React from "react";
import { Coins, ArrowLeftRight, ShieldCheck, HelpCircle, BookOpen, Mail, AlertCircle } from "@tamagui/lucide-icons";
import { H4, H5, Text, YStack, Paragraph, XStack } from "tamagui";

export interface SupportItem {
    id: string;
    title: string;
    icon: any;
    content: React.ReactNode;
}

export const SUPPORT_ITEMS: SupportItem[] = [
    {
        id: "funds",
        title: "How your funds are stored",
        icon: Coins,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>How your funds are stored</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    Unlike traditional wallets that hold private keys to custody funds on a public blockchain, <Text fontWeight="700" color="$color">Bey Wallet</Text> stores funds directly on your device as digital tokens called <Text fontWeight="700" color="$accent4">Ecash</Text> (specifically Cashu tokens).
                </Paragraph>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    These tokens represent cryptographic promises (called <Text fontWeight="600" color="$color">blind signatures</Text>) issued by Bitcoin mints. You literally hold the digital cash on your phone—just like paper bills in your physical pocket.
                </Paragraph>
                <YStack bg="$gray3" p="$3" rounded="$4" gap="$2">
                    <Text fontWeight="700" color="$orange11" fontSize="$3">⚠️ IMPORTANT:</Text>
                    <Text fontSize="$3" color="$gray12" lineHeight={18}>
                        Since your funds are stored locally in your app's secure database, if you lose your phone or delete the app without a backup, your funds will be lost forever. Make sure to back up your 12-word seed phrase!
                    </Text>
                </YStack>
            </YStack>
        )
    },
    {
        id: "deposit_withdraw",
        title: "Deposit & Withdraw to mints",
        icon: ArrowLeftRight,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>Deposit & Withdraw</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    To move funds in and out of the Ecash ecosystem, you use a process called <Text fontWeight="600" color="$color">Minting & Melting</Text>:
                </Paragraph>
                <YStack gap="$3" pl="$2" borderLeftWidth={2} borderLeftColor="$accent4">
                    <YStack gap="$1">
                        <Text fontWeight="800" color="$color" fontSize="$4">📥 Deposit (Minting)</Text>
                        <Text fontSize="$3" color="$gray12" lineHeight={18}>
                            You ask the wallet to deposit sats. The wallet generates a Lightning Invoice from your chosen mint. You pay this invoice from any Bitcoin Lightning wallet, and once paid, the mint signs and issues equivalent Ecash tokens to your device.
                        </Text>
                    </YStack>
                    <YStack gap="$1" mt="$2">
                        <Text fontWeight="800" color="$color" fontSize="$4">📤 Withdraw (Melting)</Text>
                        <Text fontSize="$3" color="$gray12" lineHeight={18}>
                            To withdraw or spend to standard Bitcoin Lightning, you provide a Lightning invoice (e.g. to pay a merchant or send to an exchange). The wallet gives the equivalent amount of Ecash tokens back to the mint, and the mint pays that invoice instantly on your behalf.
                        </Text>
                    </YStack>
                </YStack>
            </YStack>
        )
    },
    {
        id: "security",
        title: "Wallet Security",
        icon: ShieldCheck,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>Wallet Security</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    Bey Wallet implements robust, industry-grade local security parameters to keep your digital assets safe:
                </Paragraph>
                <YStack gap="$2.5">
                    <XStack gap="$2" items="flex-start">
                        <Text color="$accent4" fontWeight="bold">•</Text>
                        <Text fontSize="$3" color="$gray12" flex={1}>
                            <Text fontWeight="700" color="$color">Local Encryption</Text>: Your Cashu Ecash tokens and private keys are encrypted and stored in your device's native keychain and secure SQLite storage.
                        </Text>
                    </XStack>
                    <XStack gap="$2" items="flex-start">
                        <Text color="$accent4" fontWeight="bold">•</Text>
                        <Text fontSize="$3" color="$gray12" flex={1}>
                            <Text fontWeight="700" color="$color">Biometric Security</Text>: Access to the wallet is protected via biometric authentication (Face ID, Touch ID, or fingerprint lock), ensuring only you can initiate transfers.
                        </Text>
                    </XStack>
                    <XStack gap="$2" items="flex-start">
                        <Text color="$accent4" fontWeight="bold">•</Text>
                        <Text fontSize="$3" color="$gray12" flex={1}>
                            <Text fontWeight="700" color="$color">Blind Signatures</Text>: Mints can never trace who owns which tokens or track your transactions, preserving complete financial anonymity.
                        </Text>
                    </XStack>
                </YStack>
            </YStack>
        )
    },
    {
        id: "what_is_bey",
        title: "What is Bey? (FAQ)",
        icon: HelpCircle,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>What is Bey?</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    <Text fontWeight="700" color="$color">Bey Wallet</Text> is a premium, open-source, non-custodial Bitcoin Ecash wallet crafted for speed, absolute privacy, and seamless daily usage.
                </Paragraph>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    It allows you to hold, receive, send, and swap Bitcoin instantly without dealing with base-layer block times, variable fees, or public blockchain transaction trails.
                </Paragraph>
                <YStack gap="$2" mt="$2">
                    <Text fontWeight="800" color="$accent4" fontSize="$4">Key Features of Bey:</Text>
                    <Text fontSize="$3" color="$gray12">• <Text fontWeight="700" color="$color">NFC Pay</Text>: Tap phones with another Bey user to exchange Ecash instantly offline.</Text>
                    <Text fontSize="$3" color="$gray12">• <Text fontWeight="700" color="$color">Nostr Integrations</Text>: Send, claim, and view social Ecash payments anonymously.</Text>
                    <Text fontSize="$3" color="$gray12">• <Text fontWeight="700" color="$color">Multi-Mint Support</Text>: Seamlessly spread and swap balances across trusted Bitcoin mints.</Text>
                </YStack>
            </YStack>
        )
    },
    {
        id: "bitcoin_ecash",
        title: "Learn about Bitcoin & Ecash",
        icon: BookOpen,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>Bitcoin & Ecash Explained</H4>

                <H5 color="$color" fontWeight="700" mt="$1">What is Cashu?</H5>
                <Paragraph fontSize="$3" lineHeight={18} color="$gray12">
                    Cashu is a cutting-edge open-source Chaumian Ecash protocol built for Bitcoin, developed by <Text fontWeight="600" color="$accent4">calle</Text>. It is based on David Chaum's 1982 Chaumian Ecash design which uses blind signatures to implement absolute privacy.
                </Paragraph>

                <H5 color="$color" fontWeight="700" mt="$2">How & Why?</H5>
                <Paragraph fontSize="$3" lineHeight={18} color="$gray12">
                    The mint acts as an issuer of digital cash certificates. When you deposit Bitcoin, the mint signs a blank cheque (blinds it). You hold the blind signature, which can be unblinded and spent later.
                </Paragraph>
                <Paragraph fontSize="$3" lineHeight={18} color="$gray12">
                    Because the signature is cryptographically blinded, the mint cannot link the token you receive to the token you spend. This solves the **privacy problem** of public ledgers and allows peer-to-peer digital transfers to execute in milliseconds with zero transaction fees.
                </Paragraph>

                <H5 color="$color" fontWeight="700" mt="$2">Mints and Trusting</H5>
                <Paragraph fontSize="$3" lineHeight={18} color="$gray12">
                    Mints hold real Bitcoin backing your Ecash on their Lightning nodes. Therefore, Ecash has a <Text fontWeight="600" color="$accent4">trust assumption</Text>: you trust the mint not to steal the backing Bitcoin.
                </Paragraph>
                <Paragraph fontSize="$3" lineHeight={18} color="$gray12">
                    Bey Wallet mitigates this by supporting <Text fontWeight="600" color="$color">multiple mints</Text> and allowing you to easily swap, diversify, and manage balances across different operators to minimize counterparty risk.
                </Paragraph>
            </YStack>
        )
    },
    {
        id: "risk_disclosure",
        title: "Risk Disclosure",
        icon: AlertCircle,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$red10" fontWeight="800" letterSpacing={-0.5}>Risk Disclosure</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    Ecash is a revolutionary Bitcoin scaling and privacy layer, but it is currently in an experimental phase. Before using Bey Wallet, please read and understand the following risks:
                </Paragraph>

                <YStack gap="$3" mt="$1">
                    <YStack gap="$1">
                        <Text fontWeight="800" color="$color" fontSize="$4">1. Mint Trust Assumptions</Text>
                        <Paragraph fontSize="$3" color="$gray12" lineHeight={18}>
                            Your Ecash is backed 1:1 by real Bitcoin held in the Lightning nodes of your chosen mints. If a mint becomes insolvent, goes offline permanently, or acts dishonestly, the Ecash tokens representing your claim may become worthless. Spread your funds across multiple mints to minimize this risk.
                        </Paragraph>
                    </YStack>

                    <YStack gap="$1" mt="$1">
                        <Text fontWeight="800" color="$color" fontSize="$4">2. Local Device Storage</Text>
                        <Paragraph fontSize="$3" color="$gray12" lineHeight={18}>
                            Unlike standard non-custodial wallets that interact with public blockchains, your Ecash tokens are stored directly on your phone's database. If you lose your device, uninstall the app, or clear its cache without backing up your 12-word seed phrase, your funds will be lost forever.
                        </Paragraph>
                    </YStack>

                    <YStack gap="$1" mt="$1">
                        <Text fontWeight="800" color="$color" fontSize="$4">3. Experimental Software</Text>
                        <Paragraph fontSize="$3" color="$gray12" lineHeight={18}>
                            The Cashu specification and Lightning Network integrations are rapidly evolving open-source protocols. While we design Bey Wallet for absolute safety, software bugs or protocol updates could lead to transaction delays. Do not store life-changing sums on Ecash.
                        </Paragraph>
                    </YStack>
                </YStack>
            </YStack>
        )
    },
    {
        id: "contact",
        title: "Contact Support",
        icon: Mail,
        content: (
            <YStack gap="$3" p="$4">
                <H4 color="$accent4" fontWeight="800" letterSpacing={-0.5}>Contact Support</H4>
                <Paragraph fontSize="$4" lineHeight={22} color="$gray12">
                    Bey Wallet is non-custodial and open-source. For assistance, inquiries, or feedback:
                </Paragraph>
                <YStack gap="$2" bg="$gray3" p="$3" rounded="$4" mt="$1">
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" color="$accent4">✉️ Email:</Text>
                        <Text color="$color" fontWeight="600">support@bey.cash</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" color="$accent4">🌐 Website:</Text>
                        <Text color="$color" fontWeight="600">bey.cash</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" color="$accent4">💜 Nostr:</Text>
                        <Text color="$color" fontWeight="600">bey@nostr.wallet</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" color="$accent4">🐦 X (Twitter):</Text>
                        <Text color="$color" fontWeight="600">x.com/thehussein_01</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" color="$accent4">💻 GitHub Repo:</Text>
                        <Text color="$color" fontWeight="600">github.com/thehussein01/bey-wallet</Text>
                    </XStack>
                </YStack>
                <Paragraph fontSize="$3" color="$gray10" lineHeight={16} mt="$2">
                    *Please never share your 12-word seed phrase or private keys with anyone, including support staff. We will never ask for them.*
                </Paragraph>
            </YStack>
        )
    }
];
