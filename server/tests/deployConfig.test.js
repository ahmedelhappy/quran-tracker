// render.yaml is the deploy's source of truth for the API, so it is checked here
// against the code it deploys: a renamed health route, a Node bump in .nvmrc or a
// new required secret would otherwise only show up as a failed (or silently
// misconfigured) Render deploy (M-21).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

require('./helpers'); // the test env (NODE_ENV, JWT_SECRET) before the app loads
const app = require('../app');

const ROOT = path.join(__dirname, '..', '..');
const yaml = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
// Comments may mention any key; only the declarations count.
const lines = yaml.split(/\r?\n/).map((l) => l.replace(/\s+#.*$/, '')).filter((l) => !/^\s*#/.test(l));
const field = (name) => {
  const line = lines.find((l) => new RegExp(`^\\s*${name}:`).test(l));
  return line ? line.split(':').slice(1).join(':').trim() : undefined;
};

// envVars entries as { key, value?, sync? }: a "- key:" line opens one.
const envVars = [];
for (const l of lines) {
  const key = l.match(/^\s*-\s*key:\s*(\S+)/);
  if (key) { envVars.push({ key: key[1] }); continue; }
  const prop = l.match(/^\s+(value|sync):\s*(.+)$/);
  if (prop && envVars.length) envVars[envVars.length - 1][prop[1]] = prop[2].trim();
}
const envVar = (key) => envVars.find((v) => v.key === key);

describe('render.yaml describes the service the code expects (M-21)', () => {
  test('builds from the lockfile in server/ and starts server.js', () => {
    assert.equal(field('rootDir'), 'server');
    assert.equal(field('buildCommand'), 'npm ci');
    assert.equal(field('startCommand'), 'node server.js');
    assert.ok(fs.existsSync(path.join(ROOT, 'server', 'package-lock.json')), 'npm ci needs server/package-lock.json');
  });

  test('the health check path is a route the app answers without a database', async () => {
    const res = await request(app).get(field('healthCheckPath'));
    assert.equal(res.status, 200);
  });

  test('NODE_VERSION is the version in .nvmrc', () => {
    const nvmrc = fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
    assert.equal(envVar('NODE_VERSION')?.value, nvmrc);
  });

  test('every secret the server reads is declared, with no value committed', () => {
    // server.js refuses to boot without these; chat answers 503 without the key.
    const serverJs = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
    const required = JSON.parse(serverJs.match(/REQUIRED_ENV = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    for (const key of [...required, 'GROQ_API_KEY', 'CLIENT_URL']) {
      const v = envVar(key);
      assert.ok(v, `${key} is not declared in render.yaml`);
      assert.equal(v.sync, 'false', `${key} must be sync: false`);
      assert.equal(v.value, undefined, `${key} must not carry a value`);
    }
    assert.equal(envVar('NODE_ENV')?.value, 'production');
  });
});
