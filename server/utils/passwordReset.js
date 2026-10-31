// Password reset (H-06): whether it is switched on, and the reset token itself.
//
// The flow is built and tested but stays OFF until an email provider is set up.
// Three settings decide it, and all three must agree:
//
//   PASSWORD_RESET_ENABLED=true — the owner's switch. Off unless it is exactly
//       "true", so a deploy never starts offering resets by accident, and the
//       feature can be turned off again without removing a provider's keys.
//   EMAIL_TRANSPORT — what carries the email (utils/mailer.js). Only a
//       transport that delivers counts: `none` (the default) never does, and
//       `console` is refused in production. With no provider written yet,
//       production is therefore always OFF today, whatever the switch says.
//   CLIENT_URL — the deployed client's origin, already set for the CORS
//       allow-list. The reset link is built from it and NEVER from the
//       request's Host or Origin header: one forged header would otherwise mail
//       a genuine reset token to a link on the attacker's site. Production
//       requires an https origin; outside production it defaults to the Vite dev
//       server.
//
// When reset is off, both endpoints answer 404 RESET_DISABLED and the public
// config says so, so the client hides "Forgot password?". A missing or
// malformed setting never stops the server: it only keeps reset off, with the
// reason in the one startup line (describePasswordReset).
const crypto = require('crypto');
const { resolveTransport } = require('./mailer');

// 32 random bytes is 256 bits, written as 43 base64url characters (URL-safe,
// no padding). Only its SHA-256 is stored, so a leaked database row cannot be
// turned back into a working link.
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// Long enough to find the email and open it; short enough that a link left in
// an inbox is soon worthless.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_TOKEN_TTL_MINUTES = RESET_TOKEN_TTL_MS / 60000;

const DEV_CLIENT_ORIGIN = 'http://localhost:5173';

const hashResetToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const newResetToken = () => {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashResetToken(token) };
};

// The client origin the link points at, or null when there is no usable one.
const clientOrigin = (env) => {
  const production = env.NODE_ENV === 'production';
  const raw = typeof env.CLIENT_URL === 'string' ? env.CLIENT_URL.trim() : '';
  if (!raw) return production ? { origin: null, problem: 'CLIENT_URL is not set' } : { origin: DEV_CLIENT_ORIGIN, problem: null };
  let url;
  try { url = new URL(raw); } catch { return { origin: null, problem: 'CLIENT_URL is not a URL' }; }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !production)) {
    return { origin: null, problem: production ? 'CLIENT_URL must be an https origin in production' : 'CLIENT_URL must be an http(s) origin' };
  }
  return { origin: url.origin, problem: null };
};

// Read on every call (it is a few string checks), so a test can change the
// environment between requests and the startup line describes exactly what the
// endpoints will do.
const passwordResetConfig = (env = process.env) => {
  const problems = [];
  const switchedOn = typeof env.PASSWORD_RESET_ENABLED === 'string' && env.PASSWORD_RESET_ENABLED.trim().toLowerCase() === 'true';
  if (!switchedOn) problems.push('PASSWORD_RESET_ENABLED is not "true"');
  const { name: transport, transport: impl, problem: transportProblem } = resolveTransport(env);
  if (transportProblem) problems.push(transportProblem);
  if (!impl.delivers) problems.push(`email transport "${transport}" delivers nothing`);
  const { origin, problem: originProblem } = clientOrigin(env);
  if (originProblem) problems.push(originProblem);
  return { enabled: problems.length === 0, transport, origin, problems };
};

// The one startup line. Names the transport and the reasons, never a value
// that could be a secret (no keys, no CLIENT_URL).
const describePasswordReset = (config = passwordResetConfig()) => (config.enabled
  ? `Password reset: ON (email transport: ${config.transport})`
  : `Password reset: OFF (${config.problems.join('; ')})`);

// The token rides in the URL FRAGMENT, which browsers never send anywhere: not
// to the static host (so it is in no access log), and not in a Referer header.
// The reset page reads it and wipes it from the address bar and history.
const resetLink = (origin, token) => `${origin}/reset-password#token=${token}`;

module.exports = {
  RESET_TOKEN_PATTERN,
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MINUTES,
  hashResetToken,
  newResetToken,
  passwordResetConfig,
  describePasswordReset,
  resetLink,
};
