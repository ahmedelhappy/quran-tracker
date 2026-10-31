// Outgoing email, behind one small seam (H-06). The app sends exactly one kind
// of message today — a password-reset link — and no email provider has been
// chosen yet, so nothing here talks to one. Which transport carries the message
// is chosen by EMAIL_TRANSPORT:
//
//   none     (the default) — delivers nothing. Password reset stays OFF with it
//            (utils/passwordReset.js), so no one is promised an email that never
//            comes.
//   console  — prints the message, link included, to the server log. For local
//            development only: in production it is refused at configuration
//            time AND again at send time, because a reset link in a hosted log
//            is a way into the account for anyone who can read that log.
//
// Adding a real provider (Resend, Postmark, SES, SMTP) means one more entry in
// TRANSPORTS below, `{ delivers: true, devOnly: false, send }`, whose send()
// makes the provider's API call with its own key and sender address from env
// (e.g. RESEND_API_KEY + EMAIL_FROM). Nothing else changes: the controller
// only ever calls sendPasswordReset(), and enablement already follows
// `delivers`. Use the provider's HTTP API through fetch (Node has it built in)
// rather than adding an SDK, and give the call a deadline — it runs after the
// response has gone (see forgotPassword), so a slow provider delays no one, but
// a hung one should not hold a socket for ever.

const isProduction = (env = process.env) => env.NODE_ENV === 'production';

const TRANSPORTS = {
  none: {
    delivers: false,
    devOnly: false,
    send: async () => {},
  },
  console: {
    delivers: true,
    devOnly: true,
    send: async ({ to, subject, text }) => {
      // The configuration check already turns this transport into `none` in
      // production; this is the second lock, for any path that reaches it anyway.
      if (isProduction()) {
        console.error('mailer: the console transport refused to run in production (the message was not printed)');
        return;
      }
      console.log(`\n--- email (console transport, development only) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- end of email ---\n`);
    },
  },
  // resend: { delivers: true, devOnly: false, send: async ({ to, subject, text }) => { … } },
};

// Which transport EMAIL_TRANSPORT names, and why another was used instead:
// { name, transport, problem }. `problem` is a sentence for the startup log
// (never a secret), or null. Unset means none; an unknown name, or console in
// production, falls back to none rather than stopping the server.
const resolveTransport = (env = process.env) => {
  const raw = typeof env.EMAIL_TRANSPORT === 'string' ? env.EMAIL_TRANSPORT.trim().toLowerCase() : '';
  const name = raw || 'none';
  const transport = Object.hasOwn(TRANSPORTS, name) ? TRANSPORTS[name] : null;
  if (!transport) {
    return { name: 'none', transport: TRANSPORTS.none, problem: `EMAIL_TRANSPORT "${name}" is not a known transport (known: ${Object.keys(TRANSPORTS).join(', ')})` };
  }
  if (transport.devOnly && isProduction(env)) {
    return { name: 'none', transport: TRANSPORTS.none, problem: `EMAIL_TRANSPORT "${name}" is for development only and is ignored in production` };
  }
  return { name, transport, problem: null };
};

// The message itself, in the account's language. Plain text: it reads the same
// in every mail client and nothing in it can be rendered as markup. The link is
// on a line of its own so clients make it clickable whole.
const PASSWORD_RESET_TEXT = {
  en: ({ link, minutes }) => ({
    subject: 'Reset your Quran Tracker password',
    text: [
      'Assalamu alaikum,',
      '',
      'Someone asked to reset the password for your Quran Tracker account. To choose a new password, open this link:',
      '',
      link,
      '',
      `The link works once, for the next ${minutes} minutes. Choosing a new password signs you out on every device.`,
      '',
      'If you did not ask for this, you can ignore this email: your password stays as it is.',
    ].join('\n'),
  }),
  ar: ({ link, minutes }) => ({
    subject: 'إعادة تعيين كلمة المرور في متتبع القرآن',
    text: [
      'السلام عليكم،',
      '',
      'طلب أحدهم إعادة تعيين كلمة المرور لحسابك في متتبع القرآن. لاختيار كلمة مرور جديدة افتح هذا الرابط:',
      '',
      link,
      '',
      `يعمل الرابط مرة واحدة خلال الدقائق الـ${minutes} القادمة. اختيار كلمة مرور جديدة يسجّل خروجك من جميع الأجهزة.`,
      '',
      'إن لم تطلب ذلك فتجاهل هذه الرسالة، وستبقى كلمة مرورك كما هي.',
    ].join('\n'),
  }),
};

const passwordResetMessage = ({ link, language, minutes }) =>
  (PASSWORD_RESET_TEXT[language] ?? PASSWORD_RESET_TEXT.en)({ link, minutes });

// Sends the reset link to `to` through the configured transport. Called through
// the module object (mailer.sendPasswordReset), never destructured, so a test
// can stand in for delivery with mock.method and read the link it was given.
const sendPasswordReset = async ({ to, link, language, minutes }) => {
  const { transport } = resolveTransport();
  const { subject, text } = passwordResetMessage({ link, language, minutes });
  await transport.send({ to, subject, text });
};

module.exports = { TRANSPORTS, resolveTransport, passwordResetMessage, sendPasswordReset };
