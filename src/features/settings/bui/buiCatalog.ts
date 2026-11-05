/** Retained BUI foundations, core components and navigation previews. */
export const buiCatalog = [
  {
    title: 'Foundations',
    items: [
      {
        number: 1,
        title: 'Theme & colors',
        description:
          'Light/dark palettes, surfaces, text, borders, brand, semantic and interaction colors.',
      },
      {
        number: 2,
        title: 'Layout & spacing',
        description:
          'Spacing, radii, page edges, groups, separators, safe areas and bottom action layouts.',
      },
      {
        number: 3,
        title: 'Typography',
        description: 'Headings, body, labels, captions, wrapping, font weights and number styles.',
      },
      {
        number: 4,
        title: 'Icons & avatars',
        description:
          'Existing icon family, size/stroke rules, icon slots, mint/person avatars and placeholders.',
      },
      {
        number: 5,
        title: 'Badges',
        description: 'Status labels, counts, unread indicators, verification and corner overlays.',
      },
    ],
  },
  {
    title: 'Core components',
    items: [
      {
        number: 6,
        title: 'Buttons',
        description:
          'Primary, secondary, tertiary, destructive, text and icon buttons; sizes and all states.',
      },
      {
        number: 7,
        title: 'Inputs & forms',
        description:
          'Text fields, text areas, search, password fields, prefixes/suffixes, hints and validation.',
      },
      {
        number: 8,
        title: 'Selection controls',
        description: 'Switches, checkboxes, radio controls, selected states and disabled states.',
      },
      {
        number: 9,
        title: 'Tabs, chips & selectors',
        description:
          'Segments, filter chips, currency/mint selectors and selected-option presentation.',
      },
      {
        number: 10,
        title: 'Lists & rows',
        description:
          'Navigation, value, description, selection, read-only status, destructive and grouped rows.',
      },
      {
        number: 11,
        title: 'Cards',
        description:
          'Neutral cards, prompts, summaries, warnings, wallet cards and interactive states.',
      },
    ],
  },
  {
    title: 'Navigation & overlays',
    items: [
      {
        number: 12,
        title: 'Headers & navigation',
        description:
          'Back/close headers, titles, actions, tab bars, scrolling and nested screen navigation.',
      },
      {
        number: 13,
        title: 'Sheets & dialogs',
        description:
          'Bottom sheets, confirmations, selection sheets, handles, scrims and keyboard layouts.',
      },
      {
        number: 14,
        title: 'Menus & tooltips',
        description: 'Action menus, overflow menus, anchored tooltips, explanations and dismissal.',
      },
    ],
  },
] as const;
