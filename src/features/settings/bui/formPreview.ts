export type BUIFormPreview = { name: string; code: string; note: string };
export function validateBUIFormPreview(
  values: BUIFormPreview,
): Partial<Record<keyof BUIFormPreview, string>> {
  const errors: Partial<Record<keyof BUIFormPreview, string>> = {};
  if (values.name.trim().length < 3 || values.name.trim().length > 40)
    errors.name = 'Use 3–40 characters for the sample name.';
  if (values.code !== 'BUI-1234') errors.code = 'Use the sample code BUI-1234.';
  if (values.note.length > 120) errors.note = 'Keep the sample note within 120 characters.';
  return errors;
}
