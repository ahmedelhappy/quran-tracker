import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ToastProvider } from './ToastContext';
import { useToast } from '../hooks/useToast';

// Translation keys stand in for the text, so the test needs no locale files.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

function Raiser() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast('Saved', 'success')}>ok</button>
      <button onClick={() => showToast('Could not save', 'error')}>fail</button>
      <button onClick={() => showToast('Heads up', 'info')}>info</button>
    </>
  );
}

describe('ToastProvider (M-12)', () => {
  afterEach(cleanup);

  it('says failures assertively and everything else politely, in one stack', () => {
    render(<ToastProvider><Raiser /></ToastProvider>);
    // Both regions exist before any message, so the first one is announced.
    const alert = screen.getByRole('alert');
    const status = screen.getByRole('status');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(alert.parentElement).toBe(status.parentElement);
    expect(alert.parentElement.hasAttribute('data-dialog-keep')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    fireEvent.click(screen.getByRole('button', { name: 'info' }));
    expect(within(alert).getByText('Could not save')).toBeTruthy();
    expect(within(alert).queryByText('Saved')).toBeNull();
    expect(within(status).getByText('Saved')).toBeTruthy();
    expect(within(status).getByText('Heads up')).toBeTruthy();
    expect(within(status).queryByText('Could not save')).toBeNull();
  });
});
