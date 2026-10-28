import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
// Translation keys stand in for the text, so the test needs no locale files.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

const renderAt = (auth) => {
  useAuth.mockReturnValue({ retrySession: vi.fn(), logout: vi.fn(), ...auth });
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/dashboard" element={<ProtectedRoute><p>dashboard</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ProtectedRoute', () => {
  beforeEach(cleanup);

  it('shows the page to a signed-in reader', () => {
    renderAt({ isAuthenticated: true, loading: false, sessionError: null });
    expect(screen.getByText('dashboard')).toBeTruthy();
  });

  it('sends a signed-out reader to the login page', () => {
    renderAt({ isAuthenticated: false, loading: false, sessionError: null });
    expect(screen.getByText('login page')).toBeTruthy();
    expect(screen.queryByText('dashboard')).toBeNull();
  });

  it('waits while the session is being checked, showing neither page', () => {
    renderAt({ isAuthenticated: false, loading: true, sessionError: null });
    expect(screen.getByText('common.loading')).toBeTruthy();
    expect(screen.queryByText('login page')).toBeNull();
    expect(screen.queryByText('dashboard')).toBeNull();
  });

  // M-03: a session that could not be CHECKED is not a signed-out one.
  it('offers a retry, not the login page, when the session could not be checked', () => {
    renderAt({ isAuthenticated: false, loading: false, sessionError: 'offline' });
    expect(screen.getByRole('alert').textContent).toContain('session.offlineTitle');
    expect(screen.queryByText('login page')).toBeNull();
  });
});
