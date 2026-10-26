// The rules for a NEW password, mirroring server/utils/passwordPolicy.js so the
// form can explain a problem in the reader's language before the request goes
// out. The server enforces them regardless.
//
// The cap is in BYTES because bcrypt only reads the first 72: in UTF-8 an Arabic
// letter is 2 bytes and many emoji are 4, so fewer than 72 of those fit.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

// 'tooShort' | 'tooLong' | null. Length counts code points, so an emoji is one
// character, matching the server.
export function newPasswordProblem(password) {
  if ([...password].length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'tooLong';
  return null;
}
