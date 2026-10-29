import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
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
    expect(consoleError).toHaveBeenCalledWith('Part of the page failed to render:', expect.any(TypeError), expect.anything());
  });
});
