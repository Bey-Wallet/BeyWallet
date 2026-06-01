import React, { useState, useMemo, useRef } from "react";
import { YStack, XStack, Text, Input, Button, View } from "tamagui";
import { ClipboardPaste, ScanLine, AlertCircle } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Spinner } from "~/components/UI/Spinner";

interface InvoiceStageProps {
  invoice: string;
  setInvoice: (val: string) => void;
  onContinue: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function InvoiceStage({
  invoice,
  setInvoice,
  onContinue,
  isLoading,
  error,
}: InvoiceStageProps) {
  const [isPasting, setIsPasting] = useState(false);

  const isValidInvoice = useMemo(() => {
    if (!invoice.trim()) return false;
    const lower = invoice.trim().toLowerCase();
    return (
      lower.startsWith("lnbc") ||
      lower.startsWith("lntb") ||
      lower.startsWith("lnurl") ||
      lower.includes("@")
    );
  }, [invoice]);

  const handlePaste = async () => {
    setIsPasting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        // Strip lightning: prefix if present
        let cleaned = text.trim();
        if (cleaned.toLowerCase().startsWith("lightning:")) {
          cleaned = cleaned.slice(10);
        }
        setInvoice(cleaned);
      }
    } catch (e) {
      console.warn("[MeltScreen] Clipboard read failed:", e);
    } finally {
      setIsPasting(false);
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInvoice("");
  };

  return (
    <YStack flex={1} justify="flex-start" gap="$4">
      {/* Invoice Input */}
      <YStack flex={1} gap="$3">
        <YStack
          borderWidth={isValidInvoice ? 1 : 0}
          borderColor={
            invoice ? (isValidInvoice ? "$green8" : "$orange8") : "$color4"
          }
          rounded="$4"
          overflow="hidden"
          bg="$color2"
        >
          <Input
            value={invoice}
            onChangeText={setInvoice}
            placeholder="lnbc... or lightning address"
            placeholderTextColor="$gray10"
            size="$5"
            borderWidth={0}
            bg="$gray3"
            outlineColor={"transparent"}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={6}
            style={{ textAlignVertical: "top", minHeight: 120 }}
          />

          {invoice.length > 0 && (
            <XStack justify="flex-end" p="$2" pt="$0">
              <Button
                size="$3"
                chromeless
                color="$gray10"
                fontWeight={800}
                onPress={handleClear}
              >
                Clear
              </Button>
            </XStack>
          )}
        </YStack>

        {/* Paste Button */}
        <Button
          size="$5"
          height={55}
          rounded="$4"
          bg="$gray3"
          color="$color"
          fontWeight="800"
          icon={
            isPasting ? <Spinner size="small" /> : <ClipboardPaste size={20} />
          }
          onPress={handlePaste}
          disabled={isPasting}
        >
          Paste from Clipboard
        </Button>

        {/* Error Display */}
        {error && (
          <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center">
            <AlertCircle size={18} color="$red10" />
            <Text color="$red10" fontSize="$3" flex={1}>
              {error}
            </Text>
          </XStack>
        )}
      </YStack>

      {/* Continue Button */}
      <Button
        theme={isValidInvoice ? "accent" : "gray"}
        size="$5"
        height={55}
        rounded="$4"
        fontWeight="800"
        onPress={onContinue}
        disabled={!isValidInvoice || isLoading}
        icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
      >
        {isLoading ? "Getting Quote..." : "Continue"}
      </Button>
    </YStack>
  );
}
