// The rules a NEW password must meet — at sign-up, on a change, and on any
// future reset. Login deliberately does not apply them: accounts created under
// the old 6-character minimum must keep signing in with the password they have.
//
// The upper bound is in BYTES, not characters, because bcrypt only ever reads
// the first 72 bytes of its input: anything after that was silently ignored, so
// two passwords sharing their first 72 bytes were the same password. In UTF-8 an
// Arabic letter takes 2 bytes and many emoji 4, so the character limit a person
// meets is lower than 72 for those scripts — the client explains it that way.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

// A message describing what is wrong with the password, or null when it is fine.
// Length counts code points, so an emoji is one character, not two.
const newPasswordProblem = (password) => {
  if (typeof password !== 'string' || [...password].length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return 'Password is too long (at most 72 bytes: 72 Latin letters, fewer in Arabic or with emoji)';
  }
  return null;
};

module.exports = { PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES, newPasswordProblem };
