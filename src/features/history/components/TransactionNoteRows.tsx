import React from 'react';
import { YStack } from 'tamagui';
import { ListTableRow } from '~/shared/ui/ListTable';
import type { TransactionNote } from '../transactionNotes';

export function TransactionNoteRows({ notes }: { notes: TransactionNote[] }) {
  return (
    <YStack separator={<YStack height={2} bg="$background" />}>
      {notes.map((note, index) => (
        <ListTableRow
          key={`${note.label}:${index}`}
          label={note.label}
          value={note.value}
          multiline
          isCopyable
          copyValue={note.value}
        />
      ))}
    </YStack>
  );
}
