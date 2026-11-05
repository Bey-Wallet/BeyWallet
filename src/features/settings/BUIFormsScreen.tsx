import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ScanLine } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIPage, BUISection, BUIChoices, BUIText, BUIButton, useBUITheme } from '~/shared/ui/BUI';
import { BUIInput, BUITextArea, BUIPasswordInput, BUISearchInput } from '~/shared/ui/BUI/BUIInput';
import { useBUIStore } from '~/state/buiStore';
import { validateBUIFormPreview, type BUIFormPreview } from './bui/formPreview';

export function BUIFormsScreen() {
  const appearance = useBUIStore((state) => state.appearance);
  const c = useBUITheme(appearance);
  const [category, setCategory] = useState<'Field states' | 'Composition' | 'Validation'>(
    'Field states',
  );
  const [state, setState] = useState<
    'Normal' | 'Disabled' | 'Read only' | 'Loading' | 'Success' | 'Error'
  >('Normal');
  const [value, setValue] = useState('Sample value');
  const [amount, setAmount] = useState('12.50');
  const [note, setNote] = useState('A multiline sample note.\nTry a second line.');
  const [password, setPassword] = useState('preview-only-123');
  const [query, setQuery] = useState('');
  const [timing, setTiming] = useState<'On blur' | 'On submit' | 'Live'>('On blur');
  const [values, setValues] = useState<BUIFormPreview>({ name: '', code: '', note: '' });
  const [touched, setTouched] = useState<Partial<Record<keyof BUIFormPreview, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('Local samples only. Nothing is saved or sent.');
  const code = useRef<TextInput>(null);
  const formNote = useRef<TextInput>(null);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) Keyboard.dismiss();
  }, [focused]);
  const errors = validateBUIFormPreview(values);
  const errorFor = (key: keyof BUIFormPreview) =>
    timing === 'Live' || submitted || (timing === 'On blur' && touched[key])
      ? errors[key]
      : undefined;
  const edit = (key: keyof BUIFormPreview, text: string) =>
    setValues((previous) => ({ ...previous, [key]: text }));
  return (
    <BUIPage
      title="BUI / Inputs & forms"
      status={notice}
      controls={
        <BUIChoices
          values={['Field states', 'Composition', 'Validation'] as const}
          value={category}
          onChange={(next) => {
            Keyboard.dismiss();
            setCategory(next);
          }}
        />
      }
    >
      {category === 'Field states' && (
        <>
          <BUISection
            name="Floating-label input"
            measurement="Minimum64 / R20 / border1.5 / padding16 × 12. Body16/24; hint scales to75% with gap4 over150 ms. Expanded label space is reserved even when collapsed; the field grows with content."
          >
            <YStack px={16}>
              <BUIChoices
                values={['Normal', 'Disabled', 'Read only', 'Loading', 'Success', 'Error'] as const}
                value={state}
                onChange={setState}
              />
            </YStack>
            <BUIInput
              label="Wallet label"
              value={value}
              onChangeText={setValue}
              disabled={state === 'Disabled'}
              readOnly={state === 'Read only'}
              loading={state === 'Loading'}
              success={state === 'Success'}
              error={state === 'Error' ? 'Sample validation error.' : undefined}
              helper={
                state === 'Success'
                  ? 'Success suppresses Clear; it adds no green border or checkmark.'
                  : 'Focus to float the label. Filled, focused fields expose Clear.'
              }
            />
            <XStack px={16} gap={12}>
              <BUIButton
                appearance={appearance}
                variant="Secondary"
                size="small"
                onPress={() => setValue('')}
              >
                Empty
              </BUIButton>
              <BUIButton
                appearance={appearance}
                variant="Secondary"
                size="small"
                onPress={() => setValue('Sample value')}
              >
                Filled
              </BUIButton>
            </XStack>
          </BUISection>
          <BUISection
            name="Trailing action"
            measurement="Clear/loading glyph16; trailing gaps8. Custom actions remain visible when clear is disabled or the value is empty."
          >
            <BUIInput
              label="Sample destination"
              value={amount}
              onChangeText={setAmount}
              disableClear
              trailing={
                <AppPressable
                  accessibilityLabel="Sample scanner action"
                  width={16}
                  minHeight={16}
                  hitSlop={16}
                  onPress={() => setNotice('Sample action pressed. No scanner opened.')}
                >
                  <ScanLine size={16} color={c.iconSecondary} />
                </AppPressable>
              }
            />
          </BUISection>
        </>
      )}
      {category === 'Composition' && (
        <>
          <BUISection
            name="Suffix & multiline"
            measurement="Suffix follows the measured text end with a4-point gap and yields space to the trailing slot. Multiline defaults to four visible lines and scrolls beyond them."
          >
            <BUIInput
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              suffix="sats"
              keyboardType="decimal-pad"
              disableClear
            />
            <BUITextArea
              label="Note"
              value={note}
              onChangeText={setNote}
              helper="A local note only."
            />
          </BUISection>
          <BUISection
            name="Search"
            measurement="H48 / R20 / border1.5; leading16 glyph, horizontal16 icon padding; edit padding2 × 6. Clear and Cancel are separate accessible actions."
          >
            <BUISearchInput
              label="Search samples"
              value={query}
              onChangeText={setQuery}
              onCancel={() => {
                setQuery('');
                Keyboard.dismiss();
                setNotice('Sample search cancelled.');
              }}
            />
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                {query ? `Searching local sample: ${query}` : 'No external search runs.'}
              </BUIText>
            </YStack>
          </BUISection>
          <BUISection
            name="Password & read-only"
            measurement="Password visibility uses native secure entry and resets on field blur/background. This composition uses an invented value, not wallet authentication."
          >
            {focused && (
              <BUIPasswordInput
                label="Sample password"
                value={password}
                onChangeText={setPassword}
                helper="Use invented text only."
              />
            )}
            <BUIInput
              label="Read-only reference"
              value="BUI sample"
              onChangeText={() => {}}
              readOnly
              disableClear
            />
          </BUISection>
        </>
      )}
      {category === 'Validation' && (
        <BUISection
          name="Validation & keyboard flow"
          measurement="Demo rules: name3–40 trimmed characters, code BUI-1234, note≤120. Keyboard Next advances focus. These are UI examples, not payment/address validation."
        >
          <YStack px={16}>
            <BUIChoices
              values={['On blur', 'On submit', 'Live'] as const}
              value={timing}
              onChange={setTiming}
            />
          </YStack>
          <BUIInput
            label="Sample name"
            value={values.name}
            onChangeText={(text) => edit('name', text)}
            onBlur={() => setTouched((previous) => ({ ...previous, name: true }))}
            error={errorFor('name')}
            returnKeyType="next"
            onSubmitEditing={() => code.current?.focus()}
          />
          <BUIInput
            ref={code}
            label="Sample code"
            value={values.code}
            onChangeText={(text) => edit('code', text)}
            onBlur={() => setTouched((previous) => ({ ...previous, code: true }))}
            error={errorFor('code')}
            helper="Use BUI-1234"
            autoCorrect={false}
            autoCapitalize="characters"
            returnKeyType="next"
            onSubmitEditing={() => formNote.current?.focus()}
          />
          <BUITextArea
            ref={formNote}
            label="Sample note"
            value={values.note}
            onChangeText={(text) => edit('note', text)}
            onBlur={() => setTouched((previous) => ({ ...previous, note: true }))}
            error={errorFor('note')}
            helper={`${values.note.length}/120 sample characters`}
          />
          <YStack px={16} gap={12}>
            <BUIButton
              appearance={appearance}
              size="large"
              fullWidth
              onPress={() => {
                Keyboard.dismiss();
                setSubmitted(true);
                setNotice(
                  Object.keys(errors).length
                    ? 'Review the sample validation messages.'
                    : 'Sample form validated. Nothing was saved.',
                );
              }}
            >
              Validate sample
            </BUIButton>
            <BUIButton
              appearance={appearance}
              size="medium"
              variant="Secondary"
              onPress={() => {
                setValues({ name: 'Demo wallet', code: 'BUI-1234', note: 'Sample only' });
                setTouched({});
                setSubmitted(false);
              }}
            >
              Fill valid sample
            </BUIButton>
          </YStack>
        </BUISection>
      )}
    </BUIPage>
  );
}
