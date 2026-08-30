export function toLocalDateTimeInput(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export function localDateTimeInputToIso(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error('Choose a valid date and time for the match.');
  }

  return date.toISOString();
}

export function resolvePlayedAtIso(
  inputValue: string,
  originalIso: string | null
): string {
  if (
    originalIso &&
    toLocalDateTimeInput(originalIso) === inputValue &&
    !Number.isNaN(new Date(originalIso).getTime())
  ) {
    return originalIso;
  }

  return localDateTimeInputToIso(inputValue);
}
