import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// The full-screen fallback reads its text from i18n; the defaults stand in.
vi.mock('../i18n', () => ({ default: { t: (key, { defaultValue }) => defaultValue, dir: () => 'ltr' } }));

const Boom = () => { throw new Error('render failed'); };

describe('ErrorBoundary', () => {
  beforeEach(cleanup);

  it('replaces the whole app with the recovery screen when it has no fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('with a fallback, puts it in place of the failed part and leaves the rest standing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A lazy component whose chunk cannot be fetched, as on the Progress page.
    const Chart = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    render(
      <div>
        <h1>Progress</h1>
        <ErrorBoundary fallback={<p>chart unavailable</p>}>
          <Suspense fallback={<p>loading chart</p>}><Chart /></Suspense>
        </ErrorBoundary>
      </div>,
    );
    expect(await screen.findByText('chart unavailable')).toBeTruthy();
    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'Reported error (error-boundary):',
      expect.any(TypeError),
      expect.objectContaining({ source: 'error-boundary', region: 'part of the page' }),
    );
  });

  it('a function fallback gets reset, which draws the part again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let broken = true;
    const Flaky = () => { if (broken) throw new Error('first render failed'); return <p>tafsir text</p>; };
    const onReset = vi.fn();
    render(
      <div>
        <p>reader</p>
        <ErrorBoundary name="tafsir" onReset={onReset} fallback={({ error, reset }) => (
          <button type="button" onClick={reset}>retry after {error.message}</button>
        )}>
          <Flaky />
        </ErrorBoundary>
      </div>,
    );
    const retry = screen.getByRole('button', { name: 'retry after first render failed' });
    expect(screen.getByText('reader')).toBeTruthy();
    broken = false;
    fireEvent.click(retry);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('tafsir text')).toBeTruthy();
  });

  it('reports a crash under the name of the region it happened in', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary name="audio player" fallback={<p>x</p>}><Boom /></ErrorBoundary>);
    expect(consoleError).toHaveBeenCalledWith(
      'Reported error (error-boundary):',
      expect.any(Error),
      expect.objectContaining({ region: 'audio player', componentStack: expect.any(String) }),
    );
  });

  // A page's own JSX (a list mapped inline) is worked out in the PAGE's render,
  // above a boundary written inside it; passed as a function, it runs inside.
  describe('a region written inline in the page', () => {
    const Page = ({ bookmarks, asFunction }) => {
      const list = () => (
        <ul>{bookmarks.map((b) => <li key={b.id}>{b.label.trim()}</li>)}</ul>
      );
      return (
        <div>
          <p>mushaf</p>
          <ErrorBoundary name="sidebar" fallback={<p>sidebar failed</p>}>
            {asFunction ? list : list()}
          </ErrorBoundary>
        </div>
      );
    };
    // A bad entry from the server: label missing, so .trim() throws.
    const bad = [{ id: 1, label: 'Juz 1' }, { id: 2 }];

    it('as plain children, a throw in it escapes to the boundary above the page', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<ErrorBoundary fallback={<p>whole app failed</p>}><Page bookmarks={bad} /></ErrorBoundary>);
      expect(screen.getByText('whole app failed')).toBeTruthy();
      expect(screen.queryByText('mushaf')).toBeNull();
    });

    it('as a function, the throw stays in the region and the page carries on', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<ErrorBoundary fallback={<p>whole app failed</p>}><Page bookmarks={bad} asFunction /></ErrorBoundary>);
      expect(screen.getByText('sidebar failed')).toBeTruthy();
      expect(screen.getByText('mushaf')).toBeTruthy();
      expect(screen.queryByText('whole app failed')).toBeNull();
    });

    it('as a function, it renders as before when nothing throws', () => {
      render(<Page bookmarks={[{ id: 1, label: ' Juz 1 ' }]} asFunction />);
      expect(screen.getByText('Juz 1')).toBeTruthy();
      expect(screen.getByText('mushaf')).toBeTruthy();
    });
  });
});
