export interface Nip05VerificationState {
  nip05?: string | null;
  nip05Verified?: boolean;
}

export function hasVerifiedNip05({ nip05, nip05Verified }: Nip05VerificationState): boolean {
  return Boolean(nip05?.trim()) && nip05Verified === true;
}
