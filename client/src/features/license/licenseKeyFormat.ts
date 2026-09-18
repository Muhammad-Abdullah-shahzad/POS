/**
 * A quick format check for a pasted licence key, run as the user types.
 *
 * It only catches obvious mistakes such as a partial copy or the wrong text.
 * Whether a key is genuine is decided by its signature, on the server or in the
 * desktop app, never here.
 */
export const LICENSE_KEY_PREFIX = 'POS1';

export type KeyVerdict = 'empty' | 'invalid' | 'plausible';

export interface KeyInspection {
  /** The key with the line breaks and spaces email clients add removed. */
  key: string;
  verdict: KeyVerdict;
  /** Why the key cannot be right, when the verdict is `invalid`. */
  problem?: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** Comfortably shorter than any key the server issues. */
const MIN_KEY_LENGTH = 80;

export function inspectLicenseKey(raw: string): KeyInspection {
  const key = raw.replace(/\s+/g, '');
  if (!key) return { key, verdict: 'empty' };

  const [prefix, payload, signature, ...rest] = key.split('.');

  if (prefix !== LICENSE_KEY_PREFIX) {
    return {
      key,
      verdict: 'invalid',
      problem: `Licence keys start with ${LICENSE_KEY_PREFIX}. Check that you copied the right text.`,
    };
  }

  const complete =
    payload && signature && rest.length === 0 && BASE64URL.test(payload) && BASE64URL.test(signature) && key.length >= MIN_KEY_LENGTH;

  if (!complete) {
    return { key, verdict: 'invalid', problem: 'This key looks incomplete. Copy the whole key from the email again.' };
  }

  return { key, verdict: 'plausible' };
}

/** "POS1 ••••• ••••• aB3xY", like the last digits of a card number. */
export const maskLicenseKey = (hint: string | null | undefined): string | null =>
  hint ? `${LICENSE_KEY_PREFIX} ••••• ••••• ${hint}` : null;
