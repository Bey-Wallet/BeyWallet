import React, { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Info } from '@tamagui/lucide-icons';
import { YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIButton,
  BUIAvatar,
  BUIListGroup,
  BUIListCheckRow,
  BUIListRow,
  BUIAlertContent,
  BUIDialog,
  BUISheet,
  BUISheetInput,
  type BUISheetRef,
  type BUIAlertAction,
  useBUITheme,
} from '~/shared/ui/BUI';
import { useBUIStore } from '~/state/buiStore';

const sheetKinds = ['Information', 'Selection', 'Form', 'Scrollable', 'Steps'] as const;
const dialogKinds = [
  'One action',
  'Two actions',
  'Destructive',
  'Message only',
  'Long content',
  'Long actions',
] as const;

export function BUISheetsScreen() {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const focused = useIsFocused();
  const [category, setCategory] = useState<'Sheets' | 'Dialogs'>('Sheets');
  const [sheetKind, setSheetKind] = useState<(typeof sheetKinds)[number]>('Information');
  const [dialogKind, setDialogKind] = useState<(typeof dialogKinds)[number]>('Two actions');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState('Everyday wallet');
  const [draftSelection, setDraftSelection] = useState(selection);
  const [name, setName] = useState('Sample wallet');
  const [draftName, setDraftName] = useState(name);
  const [fieldError, setFieldError] = useState(false);
  const [step, setStep] = useState(0);
  const [lastOption, setLastOption] = useState<number | null>(null);
  const [notice, setNotice] = useState('Open a sheet or dialog. All actions stay in this preview.');
  const sheet = useRef<BUISheetRef>(null);
  useEffect(() => {
    if (!focused) {
      Keyboard.dismiss();
      sheet.current?.dismiss();
      setDialogOpen(false);
    }
  }, [focused]);
  const closeSheet = () => sheet.current?.dismiss();
  const openSheet = () => {
    setStep(0);
    setFieldError(false);
    setDraftName(name);
    setDraftSelection(selection);
    setDialogOpen(false);
    sheet.current?.present();
  };
  const saveName = () => {
    if (!draftName.trim()) {
      setFieldError(true);
      return;
    }
    setName(draftName.trim());
    setNotice(`Saved sample name: ${draftName.trim()}`);
    closeSheet();
  };
  const positive: BUIAlertAction = {
    id: 'confirm',
    label:
      dialogKind === 'Destructive'
        ? 'Remove'
        : dialogKind === 'Long actions'
          ? 'Confirm this sample action'
          : 'OK',
    destructive: dialogKind === 'Destructive',
  };
  const negative: BUIAlertAction | undefined = [
    'Two actions',
    'Destructive',
    'Long actions',
  ].includes(dialogKind)
    ? { id: 'cancel', label: dialogKind === 'Long actions' ? 'Keep the current sample' : 'Cancel' }
    : undefined;
  const alertTitle =
    dialogKind === 'Message only'
      ? undefined
      : dialogKind === 'Destructive'
        ? 'Remove sample item?'
        : 'Sample confirmation';
  const alertMessage =
    dialogKind === 'Destructive'
      ? 'Only a preview action is recorded. No wallet data will be removed.'
      : dialogKind === 'Long content'
        ? Array.from(
            { length: 12 },
            () =>
              'This longer explanation checks wrapping and scrolling in the dialog. All content is synthetic and no operation runs.',
          ).join('\n\n')
        : 'A short explanation of the sample action. No wallet operation runs.';
  const alert = { title: alertTitle, message: alertMessage, positive, negative };
  return (
    <>
      <BUIPage
        title="BUI / Sheets & dialogs"
        status={notice}
        controls={
          <BUIChoices
            values={['Sheets', 'Dialogs'] as const}
            value={category}
            onChange={setCategory}
          />
        }
      >
        {category === 'Sheets' && (
          <>
            <BUISection
              name="Live sheet previews"
              measurement="Information, plain selection, keyboard form, long scrollable content and a three-step local flow. BUI header64 / content padding16 / button56 / minimum touch48."
            >
              <YStack px={16} gap={16}>
                <BUIChoices values={sheetKinds} value={sheetKind} onChange={setSheetKind} />
                <BUIButton appearance={appearance} size="large" fullWidth onPress={openSheet}>
                  Open sheet preview
                </BUIButton>
              </YStack>
            </BUISection>
            <BUISection
              name="Sheet host & dismissal"
              measurement="Uses the existing shared sheet host: handle36 × 4 / corners20 / height cap85% of viewport. Its gesture, backdrop, keyboard and animation behavior is retained."
            >
              <YStack px={16} gap={12}>
                <BUIText kind="body2" color={c.muted}>
                  Try the close control, swipe-down, outside tap and Android Back. Intermediate
                  sample steps use a back arrow; roots and the finished flow use close on the left.
                </BUIText>
                <BUIText kind="body2" color={c.muted}>
                  Sheet content uses BUI measurements. The reference container has different native
                  corners, motion and inset behavior; this preview does not replace the shared host.
                </BUIText>
              </YStack>
            </BUISection>
            <BUISection
              name="Local values"
              measurement="Selection and name drafts commit only through their explicit action. Dismissing and reopening restores the last saved sample values."
            >
              <BUIListGroup>
                <BUIListRow title="Selected sample wallet" value={selection} />
                <BUIListRow title="Saved sample name" subtitle={name} />
              </BUIListGroup>
            </BUISection>
          </>
        )}
        {category === 'Dialogs' && (
          <>
            <BUISection
              name="Alert variants"
              measurement="Corners20 / Android elevation8 / content padding16 × 24 / optional heading20 / primary message14/20 / title-message gap8 / divider0.5 / equal actions minimum56 / label16 Medium. No vertical action separator."
            >
              <YStack px={16}>
                <BUIChoices values={dialogKinds} value={dialogKind} onChange={setDialogKind} />
              </YStack>
              <YStack mx={24} maxHeight={360} overflow="hidden">
                {dialogKind === 'Long content' ? (
                  <BUIText kind="body2" color={c.muted}>
                    Open the dialog to inspect the long scrolling message.
                  </BUIText>
                ) : (
                  <BUIAlertContent
                    {...alert}
                    onAction={(id) => setNotice(`Inline ${id}: local preview only.`)}
                  />
                )}
              </YStack>
              <YStack px={16}>
                <BUIButton
                  appearance={appearance}
                  size="large"
                  fullWidth
                  onPress={() => {
                    Keyboard.dismiss();
                    closeSheet();
                    setDialogOpen(true);
                  }}
                >
                  Open dialog preview
                </BUIButton>
              </YStack>
            </BUISection>
            <BUISection
              name="Actions & viewport fitting"
              measurement="Action callback runs before dismissal. Outside tap and Android Back dismiss. Width cap560 / side clearance24 plus safe areas; long content scrolls within the viewport. Reduced motion removes the modal fade."
            >
              <YStack px={16}>
                <BUIText kind="body2" color={c.muted}>
                  Default action text is primary; red is an explicit destructive variant. Native
                  dialog focus, shadows and motion need device review. These are synthetic,
                  dismissible examples.
                </BUIText>
              </YStack>
            </BUISection>
          </>
        )}
      </BUIPage>
      <BUISheet
        ref={sheet}
        title={
          sheetKind === 'Steps'
            ? step === 2
              ? 'Preview complete'
              : `Sample step ${step + 1}`
            : `${sheetKind} preview`
        }
        navigation={sheetKind === 'Steps' && step === 1 ? 'back' : 'close'}
        onBack={() => setStep(0)}
        onClose={() => {
          setStep(0);
          setFieldError(false);
        }}
      >
        {sheetKind === 'Information' && (
          <YStack p={16} gap={16} items="center">
            <YStack
              width={44}
              height={44}
              rounded={22}
              bg={c.pressed}
              items="center"
              justify="center"
            >
              <Info size={28} color={c.iconSecondary} />
            </YStack>
            <BUIText kind="h3" textAlign="center">
              An informational sheet
            </BUIText>
            <BUIText kind="body1" color={c.muted} textAlign="center">
              A short explanation with one clear action. Nothing here changes the wallet.
            </BUIText>
            <BUIButton appearance={appearance} size="large" fullWidth onPress={closeSheet}>
              Got it
            </BUIButton>
          </YStack>
        )}
        {sheetKind === 'Selection' && (
          <>
            <YStack px={16} pt={16}>
              <BUIText kind="body2" color={c.muted}>
                Choose a sample wallet. There is no search or live wallet data.
              </BUIText>
            </YStack>
            <BUIListGroup>
              {['Everyday wallet', 'Travel wallet', 'Savings wallet'].map((title) => (
                <BUIListCheckRow
                  key={title}
                  title={title}
                  minHeight={76}
                  role="radio"
                  checked={draftSelection === title}
                  leading={<BUIAvatar label="" size={44} initials={title.slice(0, 1)} />}
                  onCheckedChange={() => setDraftSelection(title)}
                />
              ))}
            </BUIListGroup>
            <YStack px={16}>
              <BUIButton
                appearance={appearance}
                size="large"
                fullWidth
                onPress={() => {
                  setSelection(draftSelection);
                  setNotice(`Sample wallet selected: ${draftSelection}`);
                  closeSheet();
                }}
              >
                Use selection
              </BUIButton>
            </YStack>
          </>
        )}
        {sheetKind === 'Form' && (
          <YStack p={16} gap={16}>
            <BUIText kind="body2" color={c.muted}>
              Try the device keyboard. The input and save only affect this sample.
            </BUIText>
            <BUISheetInput
              label="Wallet name"
              accessibilityLabel="Sample sheet wallet name"
              inset={0}
              value={draftName}
              onChangeText={(value) => {
                setDraftName(value);
                if (value.trim()) setFieldError(false);
              }}
              maxLength={40}
              error={fieldError ? 'Enter a sample name.' : undefined}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              onBlur={() => setFieldError(!draftName.trim())}
            />
            <BUIButton
              appearance={appearance}
              size="large"
              fullWidth
              state={draftName.trim() ? 'Default' : 'Disabled'}
              onPress={saveName}
            >
              Save preview
            </BUIButton>
          </YStack>
        )}
        {sheetKind === 'Scrollable' && (
          <>
            <YStack px={16} pt={16}>
              <BUIText kind="body2" color={c.muted}>
                {lastOption === null
                  ? 'Scroll this list independently.'
                  : `Sample option ${lastOption} pressed.`}
              </BUIText>
            </YStack>
            <BUIListGroup>
              {Array.from({ length: 20 }, (_, index) => (
                <BUIListRow
                  key={index}
                  title={`Sample option ${index + 1}`}
                  subtitle="Scrollable sheet content"
                  onPress={() => setLastOption(index + 1)}
                />
              ))}
            </BUIListGroup>
            <YStack px={16}>
              <BUIButton appearance={appearance} size="large" fullWidth onPress={closeSheet}>
                Close preview
              </BUIButton>
            </YStack>
          </>
        )}
        {sheetKind === 'Steps' && (
          <YStack p={16} gap={16}>
            <BUIText kind="h3">
              {step === 0
                ? 'Start a sample flow'
                : step === 1
                  ? 'Review sample details'
                  : 'Preview complete'}
            </BUIText>
            <BUIText kind="body1" color={c.muted}>
              This is a local navigation sample. No payment, backup or authentication runs.
            </BUIText>
            <BUIButton
              appearance={appearance}
              size="large"
              fullWidth
              onPress={() => {
                if (step < 2) setStep((current) => current + 1);
                else closeSheet();
              }}
            >
              {step < 2 ? 'Next sample step' : 'Finish preview'}
            </BUIButton>
          </YStack>
        )}
      </BUISheet>
      <BUIDialog
        {...alert}
        visible={dialogOpen}
        onDismiss={() => setDialogOpen(false)}
        onAction={(id) =>
          setNotice(
            `${id === 'confirm' && dialogKind === 'Destructive' ? 'Remove sample' : id}: local preview only.`,
          )
        }
      />
    </>
  );
}
