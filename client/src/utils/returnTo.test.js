import { describe, it, expect } from 'vitest';
import { safeReturnTo, loginPathFor } from './returnTo';

describe('safeReturnTo', () => {
  it('keeps a path inside the app, with its query and hash', () => {
    expect(safeReturnTo('/dashboard')).toBe('/dashboard');
    expect(safeReturnTo('/library?page=50#v-2-255')).toBe('/library?page=50#v-2-255');
    expect(safeReturnTo('/')).toBe('/');
  });

  it('refuses anything that is not a string path', () => {
    for (const raw of [null, undefined, 42, {}, ['/dashboard'], '', 'dashboard', ' /dashboard']) {
      expect(safeReturnTo(raw), String(raw)).toBeNull();
    }
  });

  it('refuses other origins and protocol-relative URLs', () => {
    for (const raw of ['https://evil.com', 'javascript:alert(1)', '//evil.com', '//evil.com/dashboard', '///evil.com']) {
      expect(safeReturnTo(raw), raw).toBeNull();
    }
  });

  it('refuses a backslash anywhere, which browsers read as a slash', () => {
    for (const raw of ['/\\evil.com', '/\\/evil.com', '/library\\..\\..\\evil.com']) {
      expect(safeReturnTo(raw), raw).toBeNull();
    }
  });

  // L-04: these look like local paths going in, but dot-segment normalisation
  // turns each into "//evil.com" — which a plain href would follow off-site.
  it('refuses input that only NORMALISES to a protocol-relative URL', () => {
    for (const raw of ['/.//evil.com', '/%2e//evil.com', '/%2E//evil.com', '/a/..//evil.com', '/a/%2e%2e//evil.com', '/././/evil.com']) {
      expect(safeReturnTo(raw), raw).toBeNull();
    }
  });

  it('refuses tab and newline tricks the URL parser strips out', () => {
    for (const raw of ['/\t/evil.com', '/\n/evil.com', '/\r\n/evil.com']) {
      expect(safeReturnTo(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it('never returns a value starting with //, whatever goes in', () => {
    const tricky = ['/%2F%2Fevil.com', '/%5C%5Cevil.com', '/..//..//evil.com', '/library/..//evil.com?x=1', '/%09/evil.com'];
    for (const raw of tricky) {
      const out = safeReturnTo(raw);
      if (out !== null) expect(out.startsWith('//'), `${raw} -> ${out}`).toBe(false);
    }
    // Encoded slashes stay encoded: a harmless in-app path, not a hop to evil.com.
    expect(safeReturnTo('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });

  it('refuses the auth pages, so signing in cannot loop back to itself', () => {
    for (const raw of ['/login', '/login/', '/login?returnTo=/x', '/register', '/register/step', '/a/../login', '/%2e%2e/login']) {
      expect(safeReturnTo(raw), raw).toBeNull();
    }
    // Only those exact pages: a path that merely starts with the word is fine.
    expect(safeReturnTo('/loginhelp')).toBe('/loginhelp');
  });
});

describe('loginPathFor', () => {
  it('encodes the current page so it survives the query string, and round-trips', () => {
    const path = loginPathFor({ pathname: '/library', search: '?page=50&view=spread' });
    expect(path).toBe('/login?returnTo=%2Flibrary%3Fpage%3D50%26view%3Dspread');
    const back = new URLSearchParams(path.split('?')[1]).get('returnTo');
    expect(safeReturnTo(back)).toBe('/library?page=50&view=spread');
  });
});
