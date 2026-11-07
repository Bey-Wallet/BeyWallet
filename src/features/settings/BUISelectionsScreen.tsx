import React, { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { BUIPage, BUISection, BUIChoices, BUIText, useBUITheme } from '~/shared/ui/BUI';
import {
  BUISwitch,
  BUICheckbox,
  BUIRadio,
  BUISelectionRow,
} from '~/shared/ui/BUI/BUISelectionControl';

export function BUISelectionsScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<'Switches' | 'Checkboxes' | 'Radio controls' | 'Rows'>(
    'Switches',
  );
  const [disabled, setDisabled] = useState<'Enabled' | 'Disabled'>('Enabled');
  const [checked, setChecked] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [radio, setRadio] = useState('First');
  const [notice, setNotice] = useState('Local selection samples only. No preferences are saved.');
  const blocked = disabled === 'Disabled';
  return (
    <BUIPage
      title="BUI / Selection controls"
      status={notice}
      controls={
        <YStack gap={12}>
          <BUIChoices
            values={['Switches', 'Checkboxes', 'Radio controls', 'Rows'] as const}
            value={category}
            onChange={setCategory}
          />
          <BUIChoices
            values={['Enabled', 'Disabled'] as const}
            value={disabled}
            onChange={setDisabled}
          />
        </YStack>
      }
    >
      {category === 'Switches' && (
        <BUISection
          name="Switch"
          measurement="Track50 × 30 / thumb26 / vertical inset2 / horizontal positions2.5 and21.5. Active uses BUI primary with its contrasting thumb. Inactive track uses tertiary button fill. Touch target≥48; reduced motion snaps the state."
        >
          <XStack px={16} gap={24} items="center">
            <BUISwitch
              checked={checked}
              label="Interactive sample switch"
              disabled={blocked}
              onCheckedChange={setChecked}
            />
            <BUISwitch checked={false} label="Read-only off switch" />
            <BUISwitch checked label="Read-only on switch" />
          </XStack>
        </BUISection>
      )}
      {category === 'Checkboxes' && (
        <BUISection
          name="Checkbox"
          measurement="Visual22 / R6 / border2 / outer padding3 / check16. Disabled opacity48%. Checked fill and mark use blue primary/white foreground."
        >
          <XStack px={16} gap={24}>
            <BUICheckbox
              checked={accepted}
              label="Interactive sample checkbox"
              disabled={blocked}
              onCheckedChange={setAccepted}
            />
            <BUICheckbox checked label="Read-only checked checkbox" />
            <BUICheckbox checked={false} label="Read-only unchecked checkbox" />
          </XStack>
        </BUISection>
      )}
      {category === 'Radio controls' && (
        <BUISection
          name="Radio group"
          measurement="Material geometry: outer20 / stroke2 / drawn dot10 / padding2. Minimum interactive target48. Disabled color uses primary text at38% alpha; selecting an active option never clears the group."
        >
          <YStack mx={16} rounded={20} bg={c.surface} overflow="hidden">
            {['First', 'Second', 'Third'].map((option) => (
              <BUISelectionRow
                key={option}
                kind="radio"
                label={`${option} option`}
                checked={radio === option}
                disabled={blocked}
                onCheckedChange={() => setRadio(option)}
              />
            ))}
          </YStack>
          <XStack px={16} gap={24}>
            <BUIRadio checked label="Read-only selected radio" />
            <BUIRadio checked={false} label="Read-only unselected radio" />
          </XStack>
        </BUISection>
      )}
      {category === 'Rows' && (
        <BUISection
          name="Whole-row selection"
          measurement="Checkbox row padding16 × 12 / gap8 / Body16/24. Switch and radio compositions use row padding16 × 8. One accessible control owns the row; optional information actions have a separate target."
        >
          <YStack mx={16} rounded={20} bg={c.surface} overflow="hidden">
            <BUISelectionRow
              kind="switch"
              label="Sample preference"
              description="Local state only"
              checked={checked}
              disabled={blocked}
              onCheckedChange={setChecked}
            />
            <BUISelectionRow
              kind="checkbox"
              label="I understand the sample"
              checked={accepted}
              disabled={blocked}
              onCheckedChange={setAccepted}
              onInfo={() => setNotice('This is a sample description. No preference changed.')}
            />
            <BUISelectionRow
              kind="radio"
              label="First sample option"
              checked={radio === 'First'}
              disabled={blocked}
              onCheckedChange={() => setRadio('First')}
            />
          </YStack>
          <YStack px={16}>
            <BUIText kind="body2" color={c.muted}>
              Selection controls belong on dedicated preference/form screens; Settings navigation
              rows stay navigation-only.
            </BUIText>
          </YStack>
        </BUISection>
      )}
    </BUIPage>
  );
}
