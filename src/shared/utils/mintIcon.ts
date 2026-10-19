export function deriveFavicon(mintUrl: string): string {
  try {
    return `${new URL(mintUrl).origin}/favicon.ico`;
  } catch {
    return '';
  }
}
