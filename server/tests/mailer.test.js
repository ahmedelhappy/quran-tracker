// The email seam (H-06): which transport EMAIL_TRANSPORT picks, the promise
// that the console transport never prints a reset link in production, and the
// reset message in each language.
const { test, afterEach, describe, mock } = require('node:test');
const assert = require('node:assert/strict');

const mailer = require('../utils/mailer');

const LINK = `https://app.example.com/reset-password#token=${'T'.repeat(43)}`;

describe('email transports (H-06)', () => {
  afterEach(() => mock.restoreAll());

  test('EMAIL_TRANSPORT chooses the transport; unknown names and console in production fall back to none', () => {
    assert.equal(mailer.resolveTransport({}).name, 'none');
    assert.equal(mailer.resolveTransport({ EMAIL_TRANSPORT: ' Console ' }).name, 'console');
    const prod = mailer.resolveTransport({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'console' });
    assert.equal(prod.name, 'none');
    assert.match(prod.problem, /development only/);
    const unknown = mailer.resolveTransport({ EMAIL_TRANSPORT: '__proto__' });
    assert.equal(unknown.name, 'none');
    assert.match(unknown.problem, /not a known transport/);
    assert.equal(mailer.TRANSPORTS.none.delivers, false);
  });

  test('an unknown EMAIL_TRANSPORT is described by its length, never echoed (it may be a pasted key)', () => {
    const pasted = 're_live_9f8e7d6c5b4a3f2e1d0c';
    const { name, problem } = mailer.resolveTransport({ EMAIL_TRANSPORT: pasted });
    assert.equal(name, 'none');
    assert.ok(!problem.includes(pasted), problem);
    assert.ok(!problem.toLowerCase().includes('re_live'), 'not even a prefix');
    assert.match(problem, new RegExp(`${pasted.length} characters`));
    assert.match(problem, /known: none, console/);
  });

  test('the console transport prints the link in development and NEVER in production', async () => {
    const saved = process.env.NODE_ENV;
    const printed = [];
    mock.method(console, 'log', (...args) => printed.push(args.join(' ')));
    mock.method(console, 'error', (...args) => printed.push(args.join(' ')));
    const link = LINK;
    try {
      process.env.NODE_ENV = 'development';
      await mailer.TRANSPORTS.console.send({ to: 'a@example.com', subject: 's', text: link });
      assert.ok(printed.join('\n').includes(link));

      printed.length = 0;
      process.env.NODE_ENV = 'production';
      await mailer.TRANSPORTS.console.send({ to: 'a@example.com', subject: 's', text: link });
      assert.ok(!printed.join('\n').includes('T'.repeat(43)), 'the token is not printed in production');
      assert.match(printed.join('\n'), /refused to run in production/);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });

  test('sendPasswordReset in production with EMAIL_TRANSPORT=console prints nothing', async () => {
    const saved = { NODE_ENV: process.env.NODE_ENV, EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT };
    const printed = [];
    mock.method(console, 'log', (...args) => printed.push(args.join(' ')));
    try {
      process.env.NODE_ENV = 'production';
      process.env.EMAIL_TRANSPORT = 'console';
      await mailer.sendPasswordReset({ to: 'a@example.com', link: LINK, language: 'en', minutes: 30 });
      assert.equal(printed.length, 0);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  test('the message is in the account language, with the link on its own line', () => {
    const link = LINK;
    const en = mailer.passwordResetMessage({ link, language: 'en', minutes: 30 });
    const ar = mailer.passwordResetMessage({ link, language: 'ar', minutes: 30 });
    assert.match(en.subject, /Reset your Quran Tracker password/);
    assert.match(ar.subject, /إعادة تعيين كلمة المرور/);
    for (const m of [en, ar]) {
      assert.ok(m.text.split('\n').includes(link));
      assert.match(m.text, /30/);
    }
    assert.deepEqual(mailer.passwordResetMessage({ link, language: 'fr', minutes: 30 }), en, 'an unknown language falls back to English');
  });
});
