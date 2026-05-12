import { Button, Input, Modal, Sheet, Text, YStack, XStack, H3, Paragraph } from "tamagui";
import { useState } from "react";
import { useWalletStore } from "../../../store/walletStore";
import { mintService } from "../../../services/mintService";
import { sqliteStorage } from "../../../store/sqliteStorage";
import * as Haptics from 'expo-haptics';
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from 'expo-clipboard';

export default function MintModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { activeMintUrl, refreshBalance } = useWalletStore();
    const [amount, setAmount] = useState("");
    const [quote, setQuote] = useState<{ pr: string, quoteId: string } | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const handleRequestMint = async () => {
        if (!activeMintUrl || !amount) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsRequesting(true);
        try {
            const res = await mintService.requestMintQuote(activeMintUrl, parseInt(amount));
            setQuote({ pr: res.request, quoteId: res.quote });
            
            // Save invoice data for history screen
            try {
                const cached = sqliteStorage.getItem('mint_invoices');
                const invoices = cached ? JSON.parse(cached) : {};
                invoices[res.quote] = {
                    pr: res.request,
                    expiry: Date.now() + 3600 * 1000, // Default 1 hour
                    amount: amount,
                    mintUrl: activeMintUrl
                };
                sqliteStorage.setItem('mint_invoices', JSON.stringify(invoices));
            } catch (e) {
                console.error('[MintModal] Failed to save invoice to storage:', e);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCheckPayment = async () => {
        if (!quote) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsChecking(true);
        try {
            await mintService.checkAndMint(quote.quoteId);
            // If successful, refresh balance and close
            refreshBalance();
            onOpenChange(false);
            setQuote(null);
            setAmount("");
        } catch (err) {
            console.error(err);
            // Quote might not be paid yet
        } finally {
            setIsChecking(false);
        }
    };

    const copyToClipboard = async () => {
        if (quote) {
            await Clipboard.setStringAsync(quote.pr);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    return (
        <Sheet
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={[85]}
            dismissOnSnapToBottom
            modal
        >
            <Sheet.Frame p="$4" bg="$background">
                <Sheet.Handle />
                <YStack gap="$4" pt="$4">
                    <H3>Deposit Funds</H3>
                    {!quote ? (
                        <>
                            <Paragraph>Mint: {activeMintUrl}</Paragraph>
                            <Input
                                placeholder="Amount in SATS"
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                size="$5"
                            />
                            <Button
                                theme="blue"
                                size="$5"
                                disabled={isRequesting || !amount}
                                onPress={handleRequestMint}
                            >
                                {isRequesting ? "Requesting Invoice..." : "Get Invoice"}
                            </Button>
                        </>
                    ) : (
                        <YStack items="center" gap="$4">
                            <Text fontWeight="600">Pay this invoice to mint tokens</Text>
                            <YStack bg="white" p="$4" rounded="$4">
                                <QRCode value={quote.pr} size={200} />
                            </YStack>
                            <Button size="$3" variant="outline" onPress={copyToClipboard}>
                                Copy Invoice
                            </Button>
                            <Button
                                theme="green"
                                size="$5"
                                width="100%"
                                disabled={isChecking}
                                onPress={handleCheckPayment}
                            >
                                {isChecking ? "Checking..." : "I've Paid"}
                            </Button>
                            <Button
                                variant="outline"
                                width="100%"
                                onPress={() => setQuote(null)}
                            >
                                Go Back
                            </Button>
                        </YStack>
                    )}
                </YStack>
            </Sheet.Frame>
        </Sheet>
    );
}
