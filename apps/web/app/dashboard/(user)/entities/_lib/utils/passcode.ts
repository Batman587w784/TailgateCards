/**
 * Generate a random 4-character alphanumeric uppercase passcode.
 * Characters: A-Z, 0-9 (36 possible characters)
 * Total combinations: 36^4 = 1,679,616
 */
export function generatePasscode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let passcode = '';
  for (let i = 0; i < 4; i++) {
    passcode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return passcode;
}
