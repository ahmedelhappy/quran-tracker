import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';
import { authAPI, progressAPI } from '../services/api';
import { switchLanguage } from '../i18n';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { useDialog } from '../hooks/useDialog';
import HowToMemorizeModal from '../components/HowToMemorizeModal';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import { FiBook, FiEdit2, FiUser, FiSave, FiX, FiMonitor, FiSun, FiMoon, FiZap, FiLock, FiEye, FiEyeOff, FiRotateCcw, FiMapPin, FiList, FiRefreshCw, FiChevronDown, FiChevronUp, FiPause, FiHelpCircle, FiPlay, FiAward } from 'react-icons/fi';
import { SURAH_PAGES } from '../data/surahPages';
import { JUZ_RANGES } from '../data/juzRanges';
import {
  mergeOrdRanges, subtractOrdRanges, fullyCoveredPages, splitCoverageForSave, coverageFromProgress, toVerseKeyRanges,
} from '../utils/unitRanges';
import MemorizedUnitPicker from '../components/MemorizedUnitPicker';
import { newPasswordProblem } from '../utils/passwordRules';
import { reportLoadFailure } from '../utils/reportError';
import { apiErrorMessage } from '../utils/apiError';
import { singleKeyShortcutsOn, setSingleKeyShortcuts } from '../utils/shortcutKeys';

const DAY_LABEL_KEYS = ['settings.dayMon', 'settings.dayTue', 'settings.dayWed', 'settings.dayThu', 'settings.dayFri', 'settings.daySat', 'settings.daySun'];
const DAY_JS_INDICES = [1, 2, 3, 4, 5, 6, 0];

const INTENSITY_OPTIONS = [
  { value: 'light',    labelKey: 'settings.intensityLight',    descKey: 'settings.intensityLightDesc',     divisor: 14 },
  { value: 'standard', labelKey: 'settings.intensityStandard', descKey: 'settings.intensityStandardDesc',  divisor: 10 },
  { value: 'strong',   labelKey: 'settings.intensityIntensive', descKey: 'settings.intensityIntensiveDesc', divisor: 7 },
];

// Approximate daily review pages for a preset given memorized page count.
const estimateReviewPages = (memorized, divisor) =>
  memorized > 0 ? Math.max(1, Math.round(memorized / divisor)) : null;

const DAILY_OPTIONS = [0.5, 1, 2, 5];

// The recent-review count the server computes when the user hasn't set one — used
// as the input's default so it shows the number actually in effect on any preset.
const autoRecentPages = (dailyNewPages) => Math.max(3, Math.min(Math.ceil((dailyNewPages || 1) * 3), 6));

// ── Edit Progress Modal ──────────────────────────────────
// Exported for its tests (Settings.test.jsx).
export function EditProgressModal({ isOpen, onClose, onSave, onRetryLoad, progressLoad, memorizedPageNums, partialPages }) {
  // A modal dialog for the keyboard and screen readers too (M-12): focus lands
  // on the dialog itself (so its title is read first, and the next Tab is its
  // close button), Tab stays inside, Escape closes, the settings page behind is
  // inert, and focus returns to "Edit progress".
  const { dialogProps, titleId } = useDialog({ open: isOpen, onClose });
  // Single source of truth: the selection as VERSE ranges (global ayah numbers).
  //
  // It used to be a set of whole page numbers, which is fine for Juz / Surah /
  // Range — those units start at the top of a page — but wrong for Hizb and
  // quarter-Hizb, whose boundaries fall mid-page. Adjacent hizbs SHARE the page
  // they meet on (rub 126 = pages 315-317, rub 127 = 317-319), so rounding a
  // selection up to whole pages spilled it into both neighbours.
  //
  // Verses are the honest unit, and the page-shaped tabs read a derived view of
  // them (`selectedPages` = the pages every verse of which is covered).
  const [coverage, setCoverage] = useState([]);
  const selectedPages = useMemo(() => fullyCoveredPages(coverage), [coverage]);
  // The picker's own state (tab, search, range rows) starts over with a new key:
  // on every opening and on Restore. It says when its range rows stop being valid.
  const [pickerKey, setPickerKey] = useState(0);
  const [hasRangeErrors, setHasRangeErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();

  // What was memorized when the modal opened — lets the picker flag (in red)
  // anything the user removes.
  const original = useMemo(() => ({
    pages: new Set(memorizedPageNums),
    coverage: coverageFromProgress(memorizedPageNums, partialPages),
  }), [memorizedPageNums, partialPages]);
  const restoreOriginal = () => {
    setCoverage(coverageFromProgress(memorizedPageNums, partialPages));
    setPickerKey((k) => k + 1);
    setHasRangeErrors(false);
  };
  useEffect(() => {
    if (isOpen) {
      setCoverage(coverageFromProgress(memorizedPageNums, partialPages));
      setPickerKey((k) => k + 1);
      setHasRangeErrors(false);
    }
  }, [isOpen, memorizedPageNums, partialPages]);

  const selectedCount = selectedPages.size;
  const handleSave = async () => {
    setSaving(true);
    let landed = false; // whether any request of this save went through
    try {
      // Save only what the user CHANGED, worked out in verses against what the
      // editor loaded: the verses added and the verses removed. It used to save
      // the whole selection as a replace, which deleted every page the editor
      // did not show — a page marked elsewhere since it loaded, or everything
      // when the load had failed (H-02). Anything the user did not touch is now
      // never sent, so it keeps its dates, reviews and verse segments.
      //
      // Whole pages go through the page delta in one request (a page entirely
      // added was empty before; one entirely removed is empty now); the
      // mid-page remainders — a Hizb boundary, a half page — go through the
      // units endpoint as verse ranges, removals first. Ranges are merged, so a
      // whole hizb of quarters costs one request, not four.
      const loaded = coverageFromProgress(memorizedPageNums, partialPages);
      const added = splitCoverageForSave(mergeOrdRanges(subtractOrdRanges(coverage, loaded)));
      const removed = splitCoverageForSave(mergeOrdRanges(subtractOrdRanges(loaded, coverage)));
      if (added.fullPages.length || removed.fullPages.length) {
        await progressAPI.changeMemorized({ add: added.fullPages, remove: removed.fullPages });
        landed = true;
      }
      for (const ref of toVerseKeyRanges(removed.leftovers)) {
        await progressAPI.updateUnits({ action: 'remove', unit: 'verses', ref });
        landed = true;
      }
      for (const ref of toVerseKeyRanges(added.leftovers)) {
        await progressAPI.updateUnits({ action: 'add', unit: 'verses', ref });
        landed = true;
      }
      showToast(t('settings.progressUpdated'), 'success');
      onSave();
      onClose();
    } catch (err) {
      console.error('Settings: saving the memorization editor failed', landed ? '(partly saved)' : '', err.response?.status ?? err.code ?? err);
      if (landed) {
        // Part of it went through. Re-seeding the open editor from the reload
        // would silently replace the user's remaining edits with what is
        // stored, so close it and say what happened: the next save is a delta
        // of what is really there.
        showToast(t('settings.progressPartlySaved'), 'error');
        onSave();
        onClose();
      } else {
        // Nothing landed: the selection stays as it is, to try again.
        showToast(t('settings.progressUpdateFailed'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div data-dialog-keep className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div {...dialogProps} className="relative bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 id={titleId} className="text-lg font-semibold text-[#003527] dark:text-gray-100">{t('settings.editProgressTitle')}</h3>
          <Tooltip label={t('tooltips.close')}>
            <button onClick={onClose} className="text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors">
              <FiX className="w-5 h-5" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <div className="p-6 space-y-6">
          <MemorizedUnitPicker
            key={pickerKey}
            variant="editor"
            coverage={coverage}
            setCoverage={setCoverage}
            original={original}
            onRangeErrorsChange={setHasRangeErrors}
            tabsExtra={(
              <button
                onClick={restoreOriginal}
                className="ms-auto text-xs text-[#003527] dark:text-emerald-400 hover:underline transition-colors font-medium"
              >
                {t('settings.restore')}
              </button>
            )}
          />

          {selectedCount > 0 && (
            <div className="bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-lg px-4 py-2 border border-green-100 dark:border-emerald-800/30">
              <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">
                {t('settings.pagesSelected', { count: selectedCount })}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl">
          {/* The editor saves a delta of what it loaded, so it cannot save while
              that is being reloaded or the reload failed. */}
          {progressLoad !== 'ready' && (
            <p role={progressLoad === 'error' ? 'alert' : 'status'} className={`me-auto text-xs ${progressLoad === 'error' ? 'text-red-700 dark:text-red-300' : 'text-[#707974] dark:text-gray-400'}`}>
              {progressLoad === 'error' ? t('settings.progressLoadFailed') : t('settings.progressReloading')}
              {progressLoad === 'error' && (
                <button type="button" onClick={onRetryLoad} className="ms-2 font-semibold underline underline-offset-2">
                  {t('common.retry')}
                </button>
              )}
            </p>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#404944] dark:text-gray-300 border border-[#bfc9c3] dark:border-gray-600 rounded-lg hover:bg-[#f9f9ff] dark:hover:bg-gray-700 transition-colors">
            {t('settings.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || hasRangeErrors || progressLoad !== 'ready'}
            className="px-5 py-2 text-sm font-medium bg-[#003527] text-white rounded-lg hover:bg-[#064e3b] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? t('settings.saving') : <><FiSave className="w-4 h-4" /> {t('settings.saveProgress')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change Password Card ─────────────────────────────────
// The field each of the server's password refusals is about (server/
// controllers/authController.js changePassword, utils/passwordPolicy.js).
const PW_ERROR_FIELD = {
  PASSWORD_FIELDS_REQUIRED: 'current',
  WRONG_PASSWORD: 'current',
  PASSWORD_TOO_SHORT: 'newPw',
  PASSWORD_TOO_LONG: 'newPw',
  PASSWORD_UNCHANGED: 'newPw',
};

// Exported for its tests (Settings.test.jsx).
export function ChangePasswordCard() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwShow, setPwShow] = useState({ current: false, newPw: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  // A problem is said next to the field it is about (aria-invalid +
  // aria-describedby) and that field takes focus, so a screen-reader user
  // hears what to fix where they fix it; the toast stays, as the summary
  // everyone else sees (M-12). That goes for the server's refusals too — a
  // wrong current password is the common one; one that is about no field (the
  // network) is said under the button instead, and focus stays put.
  const [pwError, setPwError] = useState(null); // { field, message } | null
  // Rendered before the focus moves (flushSync), so the field already carries
  // aria-invalid and its error when a screen reader lands on it.
  const fail = (field, message) => {
    flushSync(() => setPwError({ field, message }));
    if (field !== 'form') document.getElementById(`settings-pw-${field}`)?.focus();
    showToast(message, 'error');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPwError(null);
    const { current, newPw, confirm } = pwForm;
    if (!current || !newPw || !confirm) {
      return fail(!current ? 'current' : !newPw ? 'newPw' : 'confirm', t('settings.password.allRequired'));
    }
    const pwProblem = newPasswordProblem(newPw);
    if (pwProblem === 'tooShort') return fail('newPw', t('settings.password.tooShort'));
    if (pwProblem === 'tooLong') return fail('newPw', t('settings.password.tooLong'));
    if (newPw !== confirm) return fail('confirm', t('settings.password.mismatch'));
    if (newPw === current) return fail('newPw', t('settings.password.mustDiffer'));

    setPwLoading(true);
    try {
      // Keeps this session signed in (it stores the fresh token); other devices
      // are signed out, which the success message says. Without a fresh token
      // this session is signed out too, and the message says that instead.
      const { signedOut } = await changePassword(current, newPw);
      showToast(t(signedOut ? 'settings.password.successSignIn' : 'settings.password.success'), 'success');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (error) {
      fail(PW_ERROR_FIELD[error?.response?.data?.code] ?? 'form', apiErrorMessage(error, t, 'settings.password.failed'));
    } finally {
      setPwLoading(false);
    }
  };

  const fields = [
    { key: 'current', label: t('settings.password.current') },
    { key: 'newPw',   label: t('settings.password.new') },
    { key: 'confirm', label: t('settings.password.confirm') },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-6 sacred-shadow">
      <div className="flex items-center gap-3 mb-5">
        <FiLock className="w-5 h-5 text-[#003527] dark:text-emerald-400" />
        <h3 className="text-lg font-semibold text-[#003527] dark:text-gray-100">{t('settings.password.title')}</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`settings-pw-${key}`} className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
              {label}
            </label>
            <div className="relative">
              <input
                id={`settings-pw-${key}`}
                type={pwShow[key] ? 'text' : 'password'}
                autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                aria-invalid={pwError?.field === key}
                aria-describedby={pwError?.field === key ? `settings-pw-${key}-error` : undefined}
                value={pwForm[key]}
                onChange={e => { setPwForm(prev => ({ ...prev, [key]: e.target.value })); if (pwError?.field === key) setPwError(null); }}
                className="w-full border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 pe-10 text-sm bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent dark:placeholder:text-gray-500"
              />
              <Tooltip label={pwShow[key] ? t('tooltips.hidePassword') : t('tooltips.showPassword')} className="absolute inset-y-0 end-0">
                <button
                  type="button"
                  onClick={() => setPwShow(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="h-full px-3 flex items-center text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200"
                >
                  {pwShow[key] ? <FiEyeOff className="w-4 h-4" aria-hidden="true" /> : <FiEye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </Tooltip>
            </div>
            {pwError?.field === key && (
              <p id={`settings-pw-${key}-error`} className="text-xs text-[#ba1a1a] dark:text-red-400 mt-1">{pwError.message}</p>
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={pwLoading}
          className="bg-[#003527] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#064e3b] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
        >
          {pwLoading ? t('settings.password.saving') : <><FiSave className="w-4 h-4" /> {t('settings.password.update')}</>}
        </button>
        {pwError?.field === 'form' && (
          <p className="text-xs text-[#ba1a1a] dark:text-red-400">{pwError.message}</p>
        )}
      </form>
    </div>
  );
}

// ── Single-key shortcuts (WCAG 2.1.4) ────────────────────
// A setting of this device, saved the moment it is flipped (no Save bar): the
// reader reads it on every keypress, so it applies at once.
function SingleKeyShortcutsRow() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [on, setOn] = useState(singleKeyShortcutsOn);
  // With storage blocked the choice still holds in this tab (shortcutKeys.js),
  // but not past it — which the reader is told, rather than finding the
  // shortcuts back on in the next tab.
  const flip = () => {
    if (!setSingleKeyShortcuts(!on)) showToast(t('settings.singleKeysTabOnly'), 'info');
    setOn(!on);
  };
  return (
    <div className="flex items-center justify-between gap-4 mt-6 pt-6 border-t border-[#dce2f3] dark:border-gray-700">
      <div className="min-w-0">
        <p id="settings-single-keys-label" className="text-lg font-medium text-[#151c27] dark:text-gray-200">{t('settings.singleKeys')}</p>
        <p id="settings-single-keys-hint" className="text-sm text-[#404944] dark:text-gray-400">{t('settings.singleKeysDesc')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="settings-single-keys-label"
        aria-describedby="settings-single-keys-hint"
        onClick={flip}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#1B4332]' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'ltr:translate-x-6 rtl:-translate-x-6' : 'ltr:translate-x-1 rtl:-translate-x-1'}`} />
      </button>
    </div>
  );
}

// ── Community / Leaderboard Card ─────────────────────────
// Self-contained (its own state + immediate save) so it doesn't touch the
// profile section's dirty/Save-bar machinery — mirrors ChangePasswordCard and
// the pause-memorization toggle.
// Exported for its tests (Settings.test.jsx).
export function CommunityCard() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [optIn, setOptIn] = useState(!!user?.leaderboardOptIn);
  const [saving, setSaving] = useState(false);
  // A name the card — or the server — refuses is said under the field, which
  // takes focus (M-12). Any other failure (the network) is about no field: the
  // toast says it.
  const [nameError, setNameError] = useState(null); // message | null
  const refuseName = (message) => {
    flushSync(() => setNameError(message)); // rendered before the focus moves, as above
    document.getElementById('settings-public-name')?.focus();
    showToast(message, 'error');
  };

  const persist = async (payload, rollback) => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(payload);
      updateUser(res.data.data);
      showToast(t('settings.community.saved'), 'success');
    } catch (error) {
      const message = apiErrorMessage(error, t, 'settings.community.failed');
      if (/^DISPLAY_NAME_/.test(error?.response?.data?.code ?? '')) refuseName(message);
      else showToast(message, 'error');
      if (rollback) rollback();
    } finally {
      setSaving(false);
    }
  };

  const toggleOptIn = async () => {
    const next = !optIn;
    if (next && displayName.trim().length < 3) {
      refuseName(t('settings.community.nameRequired'));
      return;
    }
    setOptIn(next); // optimistic
    await persist(
      next ? { leaderboardOptIn: true, displayName: displayName.trim() } : { leaderboardOptIn: false },
      () => setOptIn(!next)
    );
  };

  const saveName = async () => {
    const trimmed = displayName.trim();
    if (trimmed.length > 0 && trimmed.length < 3) {
      refuseName(t('settings.community.nameTooShort'));
      return;
    }
    await persist({ displayName: trimmed || null });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-6 sacred-shadow">
      <div className="flex items-center gap-3 mb-2">
        <FiAward className="w-5 h-5 text-[#003527] dark:text-emerald-400" />
        <h3 className="text-lg font-semibold text-[#003527] dark:text-gray-100">{t('settings.community.title')}</h3>
      </div>
      <p className="text-sm text-[#404944] dark:text-gray-400 mb-5">{t('settings.community.desc')}</p>

      <div className="mb-5 max-w-sm">
        <label htmlFor="settings-public-name" className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
          {t('settings.community.displayName')}
        </label>
        <div className="flex gap-2">
          <input
            id="settings-public-name"
            type="text"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'settings-public-name-error settings-public-name-hint' : 'settings-public-name-hint'}
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setNameError(null); }}
            maxLength={30}
            placeholder={t('settings.community.displayNamePlaceholder')}
            className="flex-1 border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={saving}
            className="bg-[#003527] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#064e3b] transition-colors disabled:opacity-60 flex items-center gap-2 shrink-0"
          >
            <FiSave className="w-4 h-4" /> {t('settings.community.save')}
          </button>
        </div>
        {nameError && (
          <p id="settings-public-name-error" className="text-xs text-[#ba1a1a] dark:text-red-400 mt-1.5">{nameError}</p>
        )}
        <p id="settings-public-name-hint" className="text-xs text-[#707974] dark:text-gray-500 mt-1.5">{t('settings.community.displayNameHint')}</p>
      </div>

      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#dce2f3] dark:border-gray-700">
        <div>
          <p id="settings-optin-label" className="font-medium text-[#151c27] dark:text-gray-200">{t('settings.community.optInLabel')}</p>
          <p id="settings-optin-hint" className="text-sm text-[#404944] dark:text-gray-400">{t('settings.community.optInHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={optIn}
          aria-labelledby="settings-optin-label"
          aria-describedby="settings-optin-hint"
          onClick={toggleOptIn}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${optIn ? 'bg-[#1B4332]' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${optIn ? 'ltr:translate-x-6 rtl:-translate-x-6' : 'ltr:translate-x-1 rtl:-translate-x-1'}`} />
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSection = searchParams.get('tab') || 'profile';
  const setActiveSection = (tab) => setSearchParams({ tab }, { replace: true });

  const [memorizedJuz, setMemorizedJuz] = useState([]);
  const [memorizedPageNums, setMemorizedPageNums] = useState([]);
  // The verse ranges behind any page that is only partly memorized — the editor
  // needs them to seed itself exactly, or saving would round them up to whole pages.
  const [partialPages, setPartialPages] = useState([]);
  // Whether the three above hold the account's real progress: 'loading' |
  // 'ready' | 'error'. The editor seeds itself from them, so it only opens once
  // they are ready — a failed read used to leave them empty and open an editor
  // that showed (and could save) "nothing memorized" (H-02).
  const [progressLoad, setProgressLoad] = useState('loading');
  const [editProgressOpen, setEditProgressOpen] = useState(false);
  // Arrived with ?edit=1 (the Progress page's CTA): open once the read is in.
  const [editRequested, setEditRequested] = useState(false);

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [dailyPages, setDailyPages]   = useState(user?.dailyNewPages ?? 1);
  const [dailyMode, setDailyMode]     = useState(DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? 'fixed' : 'custom');
  const [customDailyValue, setCustomDailyValue] = useState(
    DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? 1.5 : (user?.dailyNewPages ?? 1.5)
  );
  const [customInputText, setCustomInputText] = useState(
    DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? '' : String(user?.dailyNewPages ?? 1.5)
  );
  const [intensity, setIntensity]     = useState(user?.reviewIntensity ?? 'standard');
  const [offDays, setOffDays]         = useState(user?.offDays ?? []);
  const [planDirty, setPlanDirty]     = useState(false);
  const [planSaving, setPlanSaving]   = useState(false);

  const [todayStats, setTodayStats]   = useState(null);

  const [reviewMode, setReviewMode] = useState(
    user?.cycleReviewCount != null ? 'fixed' : 'intensity'
  );
  const [recentReviewValue, setRecentReviewValue] = useState(user?.recentReviewCount ?? autoRecentPages(user?.dailyNewPages));
  const [cycleReviewValue, setCycleReviewValue] = useState(user?.cycleReviewCount ?? 5);
  const customPagesInputRef = useRef(null);

  const [isPaused, setIsPaused]       = useState(user?.pauseNewMemorization ?? false);
  const [pauseSaving, setPauseSaving] = useState(false);

  // Memorization direction: memDirChoice is the selected card ('fromStart' |
  // 'fromEnd' | 'custom'); custom keeps direction fromStart and anchors the walk
  // at memStartPage. Saved with the rest of the plan via the sticky save bar.
  const [memDirection, setMemDirection] = useState(user?.memorizationDirection ?? 'fromStart');
  const [memStartPage, setMemStartPage] = useState(user?.newMemorizationStartPage ?? null);
  const [memDirChoice, setMemDirChoice] = useState(
    user?.newMemorizationStartPage != null ? 'custom' : (user?.memorizationDirection ?? 'fromStart')
  );
  const [memStartMode, setMemStartMode] = useState('juz');

  const [showAdvanced, setShowAdvanced]       = useState(false);
  const [cycleStartMode, setCycleStartMode]   = useState('juz');
  const [cycleStartPage, setCycleStartPage]   = useState(user?.cycleReviewStartPage ?? null);
  const [cycleStartInput, setCycleStartInput] = useState('');
  const [cycleStartSaving, setCycleStartSaving] = useState(false);

  const [resetModal, setResetModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [howToOpen, setHowToOpen]     = useState(false);

  const sidebarItems = [
    { id: 'profile',      label: t('settings.profile'),      icon: <FiUser className="w-5 h-5" /> },
    { id: 'memorization', label: t('settings.memorization'), icon: <FiBook className="w-5 h-5" /> },
    { id: 'appearance',   label: t('settings.theme'),        icon: <FiMonitor className="w-5 h-5" /> },
    { id: 'help',         label: t('settings.help'),         icon: <FiHelpCircle className="w-5 h-5" /> },
  ];

  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? '');
      setDailyPages(user.dailyNewPages ?? 1);
      setDailyMode(DAILY_OPTIONS.includes(user.dailyNewPages ?? 1) ? 'fixed' : 'custom');
      setCustomDailyValue(DAILY_OPTIONS.includes(user.dailyNewPages ?? 1) ? 1.5 : (user.dailyNewPages ?? 1.5));
      setCustomInputText(DAILY_OPTIONS.includes(user.dailyNewPages ?? 1) ? '' : String(user.dailyNewPages ?? 1.5));
      setIntensity(user.reviewIntensity ?? 'standard');
      setOffDays(user.offDays ?? []);
      setReviewMode(user.cycleReviewCount != null ? 'fixed' : 'intensity');
      setRecentReviewValue(user.recentReviewCount ?? autoRecentPages(user.dailyNewPages));
      setCycleReviewValue(user.cycleReviewCount ?? 5);
      setIsPaused(user.pauseNewMemorization ?? false);
      setCycleStartPage(user.cycleReviewStartPage ?? null);
      setMemDirection(user.memorizationDirection ?? 'fromStart');
      setMemStartPage(user.newMemorizationStartPage ?? null);
      setMemDirChoice(user.newMemorizationStartPage != null ? 'custom' : (user.memorizationDirection ?? 'fromStart'));
    }
  }, [user]);

  // Load (or reload, after a save or a reset) the memorized pages. The editor
  // seeds itself from memorizedPageNums AND partialPages, so they always come
  // in together — stale partials would re-seed the half pages wrongly.
  const progressReqRef = useRef(0);
  const loadProgress = useCallback(() => {
    const req = ++progressReqRef.current;
    setProgressLoad('loading');
    return Promise.all([
      progressAPI.getJuzProgress(),
      progressAPI.getAllProgress(),
    ]).then(([juzRes, allRes]) => {
      if (req !== progressReqRef.current) return;
      setMemorizedJuz(juzRes.data.data);
      setMemorizedPageNums(allRes.data.data.memorizedPages ?? []);
      setPartialPages(allRes.data.data.partialPages ?? []);
      setProgressLoad('ready');
    }).catch((err) => {
      console.error('Settings: loading memorized pages failed', err.response?.status ?? err.code ?? err);
      if (req === progressReqRef.current) setProgressLoad('error');
    });
  }, []);

  useEffect(() => {
    loadProgress();
    // Only for the review-mode estimates: without it they are left out (and the
    // fixed count is not pre-filled), so a failure is logged, not shown.
    progressAPI.getTodayTasks().then(res => {
      setTodayStats(res.data.data.stats);
      progressAPI.checkIn(); // this read used to tick the streak itself
    }).catch((err) => reportLoadFailure(err, "today's review stats"));
  }, [loadProgress]);

  // Auto-open the Edit Progress modal when arriving from the Progress page CTA —
  // once the progress has loaded (see the effect below), never over an empty set.
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setEditRequested(true);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (editRequested && progressLoad === 'ready') {
      setEditRequested(false);
      setEditProgressOpen(true);
    }
  }, [editRequested, progressLoad]);

  useEffect(() => {
    setProfileDirty((user?.name ?? '') !== profileName && profileName.trim().length > 0);
  }, [profileName, user]);

  useEffect(() => {
    if (!user) return;
    const userReviewMode = user.cycleReviewCount != null ? 'fixed' : 'intensity';
    const changed =
      dailyPages !== (user.dailyNewPages ?? 1) ||
      JSON.stringify([...offDays].sort()) !== JSON.stringify([...(user.offDays ?? [])].sort()) ||
      reviewMode !== userReviewMode ||
      recentReviewValue !== (user.recentReviewCount ?? autoRecentPages(user.dailyNewPages)) ||
      (reviewMode === 'intensity' && intensity !== (user.reviewIntensity ?? 'standard')) ||
      (reviewMode === 'fixed' && cycleReviewValue !== (user.cycleReviewCount ?? 5)) ||
      memDirection !== (user.memorizationDirection ?? 'fromStart') ||
      (memStartPage ?? null) !== (user.newMemorizationStartPage ?? null);
    setPlanDirty(changed);
  }, [dailyPages, offDays, reviewMode, intensity, recentReviewValue, cycleReviewValue, memDirection, memStartPage, user]);

  const isDirty = (activeSection === 'profile' && profileDirty) ||
                  (activeSection === 'memorization' && planDirty);

  const toggleOffDay = (jsDay) =>
    setOffDays(prev => {
      if (!prev.includes(jsDay) && prev.length === 6) return prev;
      return prev.includes(jsDay) ? prev.filter(x => x !== jsDay) : [...prev, jsDay];
    });

  const selectMemDirection = (choice) => {
    setMemDirChoice(choice);
    if (choice === 'custom') {
      setMemDirection('fromStart');
    } else {
      setMemDirection(choice);
      setMemStartPage(null);
    }
  };

  const togglePause = async () => {
    const next = !isPaused;
    setIsPaused(next);
    setPauseSaving(true);
    try {
      await authAPI.updateProfile({ pauseNewMemorization: next });
      updateUser({ pauseNewMemorization: next });
      showToast(next ? t('settings.pauseMemToastOn') : t('settings.pauseMemToastOff'), 'success');
    } catch {
      setIsPaused(!next);
      showToast(t('settings.planUpdateFailed'), 'error');
    } finally {
      setPauseSaving(false);
    }
  };

  const saveCycleStart = async (page) => {
    setCycleStartSaving(true);
    try {
      await authAPI.updateProfile({ cycleReviewStartPage: page });
      updateUser({ cycleReviewStartPage: page });
      setCycleStartPage(page);
      showToast(t('settings.cycleStartSaved'), 'success');
    } catch {
      showToast(t('settings.planUpdateFailed'), 'error');
    } finally {
      setCycleStartSaving(false);
    }
  };

  const clearCycleStart = async () => {
    setCycleStartSaving(true);
    try {
      await authAPI.updateProfile({ cycleReviewStartPage: null });
      updateUser({ cycleReviewStartPage: null });
      setCycleStartPage(null);
      setCycleStartInput('');
      showToast(t('settings.cycleStartSaved'), 'success');
    } catch {
      showToast(t('settings.planUpdateFailed'), 'error');
    } finally {
      setCycleStartSaving(false);
    }
  };

  // Saved to the account only once the language's strings have loaded (see
  // switchLanguage); otherwise the screen stays as it was and a toast says so.
  const changeLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    if (!(await switchLanguage(newLang))) return;
    authAPI.updateProfile({ language: newLang }).catch(() => {});
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await authAPI.updateProfile({ name: profileName.trim() });
      updateUser({ name: profileName.trim() });
      setProfileDirty(false);
      showToast(t('settings.profileUpdated'), 'success');
    } catch {
      showToast(t('settings.profileUpdateFailed'), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      await authAPI.updateProfile({
        dailyNewPages: dailyPages,
        offDays,
        recentReviewCount: recentReviewValue,
        memorizationDirection: memDirection,
        newMemorizationStartPage: memStartPage ?? null,
        ...(reviewMode === 'intensity'
          ? { reviewIntensity: intensity, cycleReviewCount: null }
          : { cycleReviewCount: cycleReviewValue }
        ),
      });
      await refreshUser();
      setPlanDirty(false);
      showToast(t('settings.planUpdated'), 'success');
    } catch {
      showToast(t('settings.planUpdateFailed'), 'error');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleSave = () => {
    if (activeSection === 'profile') saveProfile();
    else if (activeSection === 'memorization') savePlan();
  };

  const handleDiscard = () => {
    if (activeSection === 'profile') setProfileName(user?.name ?? '');
    else if (activeSection === 'memorization') {
      setDailyPages(user?.dailyNewPages ?? 1);
      setDailyMode(DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? 'fixed' : 'custom');
      setCustomDailyValue(DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? 1.5 : (user?.dailyNewPages ?? 1.5));
      setCustomInputText(DAILY_OPTIONS.includes(user?.dailyNewPages ?? 1) ? '' : String(user?.dailyNewPages ?? 1.5));
      setIntensity(user?.reviewIntensity ?? 'standard');
      setOffDays(user?.offDays ?? []);
      setReviewMode(user?.cycleReviewCount != null ? 'fixed' : 'intensity');
      setRecentReviewValue(user?.recentReviewCount ?? autoRecentPages(user?.dailyNewPages));
      setCycleReviewValue(user?.cycleReviewCount ?? 5);
      setMemDirection(user?.memorizationDirection ?? 'fromStart');
      setMemStartPage(user?.newMemorizationStartPage ?? null);
      setMemDirChoice(user?.newMemorizationStartPage != null ? 'custom' : (user?.memorizationDirection ?? 'fromStart'));
    }
  };

  const handleResetProgress = async () => {
    try {
      await progressAPI.resetProgress();
      // What the page holds is now gone on the server: reload it, or the editor
      // would open on the pages that were just deleted.
      loadProgress();
      await refreshUser();
      showToast(t('settings.progressReset'), 'success');
    } catch {
      showToast(t('settings.progressResetFailed'), 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/');
    } catch {
      showToast(t('settings.deleteFailed'), 'error');
    }
  };

  const saving = profileSaving || planSaving;
  const isCustomInvalid = dailyMode === 'custom' && customInputText !== '' &&
    (isNaN(parseFloat(customInputText)) || parseFloat(customInputText) < 0.5 || parseFloat(customInputText) > 10);

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main id="main-content" className={`flex-grow pt-[100px] ${isDirty ? 'pb-36' : 'pb-24'} px-6 max-w-[1280px] w-full mx-auto`}>
        <div className="mb-12">
          <h1 className="text-3xl font-semibold text-[#003527] dark:text-gray-100 mb-2">{t('settings.title')}</h1>
          <p className="text-lg text-[#404944] dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            {/* Named, so it isn't a second unnamed navigation next to the
                navbar's; the section on screen is the current one (M-12). */}
            <nav aria-label={t('settings.title')} className="flex flex-col gap-2 sticky top-[120px]">
              {sidebarItems.map(({ id, label, icon }) => (
                <button
                  key={id}
                  aria-current={activeSection === id ? 'true' : undefined}
                  onClick={() => setActiveSection(id)}
                  className={`px-4 py-3 rounded-lg font-medium flex items-center gap-3 text-left rtl:text-right transition-colors ${
                    activeSection === id
                      ? 'bg-[#e2e8f8] dark:bg-gray-700 text-[#003527] dark:text-gray-100'
                      : 'text-[#404944] dark:text-gray-400 hover:bg-[#e7eefe] dark:hover:bg-gray-800 hover:text-[#003527] dark:hover:text-gray-200'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Mobile tab row */}
          <nav aria-label={t('settings.title')} className="lg:hidden flex gap-1 bg-[#f0f3ff] dark:bg-gray-800 p-1 rounded-xl border border-[#dce2f3] dark:border-gray-700">
            {sidebarItems.map(({ id, label }) => (
              <button
                key={id}
                aria-current={activeSection === id ? 'true' : undefined}
                onClick={() => setActiveSection(id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === id
                    ? 'bg-white dark:bg-gray-700 text-[#003527] dark:text-gray-100 shadow-sm'
                    : 'text-[#404944] dark:text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="col-span-1 lg:col-span-9 flex flex-col gap-8">

            {/* ── Profile ──────────────────────────────────── */}
            {activeSection === 'profile' && (
              <>
                <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                  <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                    <FiUser className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                    <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{t('settings.profile')}</h2>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0 border-2 border-amber-400">
                      {user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{user?.name}</p>
                      <p className="text-xs text-[#707974] dark:text-gray-400">{user?.email}</p>
                      <p className="text-xs text-[#bfc9c3] dark:text-gray-500 mt-1">{t('settings.avatarHint')}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="settings-display-name" className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      {t('settings.displayName')}
                    </label>
                    <input
                      id="settings-display-name"
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder={t('settings.namePlaceholder')}
                      className="w-full max-w-sm border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent dark:placeholder:text-gray-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label htmlFor="settings-email" className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      {t('auth.email')}
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      aria-describedby="settings-email-hint"
                      className="w-full max-w-sm border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-[#e7eefe] dark:bg-gray-700/50 text-[#707974] dark:text-gray-500 cursor-not-allowed"
                    />
                    <p id="settings-email-hint" className="text-xs text-[#707974] dark:text-gray-500 mt-1">{t('settings.emailHint')}</p>
                  </div>

                  {/* Language row */}
                  <div>
                    <label className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      {t('settings.languageLabel')}
                    </label>
                    <button
                      onClick={changeLanguage}
                      className="px-5 py-2.5 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-sm font-medium text-[#003527] dark:text-gray-200 bg-[#f0f3ff] dark:bg-gray-700 hover:bg-[#e7eefe] dark:hover:bg-gray-600 transition-colors"
                    >
                      {i18n.language === 'en' ? t('settings.arabic') : t('settings.english')}
                    </button>
                  </div>
                </section>

                <CommunityCard />

                <ChangePasswordCard />

                <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow border-2 border-red-100 dark:border-red-900/30">
                  <h2 className="text-xl font-semibold text-[#ba1a1a] mb-4">{t('settings.danger')}</h2>
                  <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-3 border-b border-[#dce2f3] dark:border-gray-700">
                    <div>
                      <p className="font-medium text-[#151c27] dark:text-gray-200">{t('settings.resetProgress')}</p>
                      <p className="text-sm text-[#404944] dark:text-gray-400">{t('settings.resetProgressDesc')}</p>
                    </div>
                    <button onClick={() => setResetModal(true)} className="flex-shrink-0 border-2 border-[#ba1a1a] text-[#ba1a1a] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      {t('settings.resetData')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-3">
                    <div>
                      <p className="font-medium text-[#151c27] dark:text-gray-200">{t('settings.deleteAccount')}</p>
                      <p className="text-sm text-[#404944] dark:text-gray-400">{t('settings.deleteAccountDesc')}</p>
                    </div>
                    <button onClick={() => setDeleteModal(true)} className="flex-shrink-0 bg-[#ba1a1a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-800 transition-colors">
                      {t('settings.deleteAccount')}
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* ── Memorization Plan ────────────────────────── */}
            {activeSection === 'memorization' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow divide-y divide-[#dce2f3] dark:divide-gray-700 overflow-hidden">

                {/* ── Group: Prior Memorization ─────────────────── */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-[#003527]/10 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <FiList className="w-3.5 h-3.5 text-[#003527] dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.priorMem')}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <p className="text-sm text-[#404944] dark:text-gray-400">{t('settings.priorMemDesc')}</p>
                    <button
                      onClick={() => setEditProgressOpen(true)}
                      disabled={progressLoad !== 'ready'}
                      className="px-4 py-2 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-[#003527] dark:text-gray-200 font-medium hover:bg-[#e7eefe] dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      {progressLoad === 'loading'
                        ? <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" aria-hidden="true" />
                        : <FiEdit2 className="w-4 h-4" />}
                      {t('settings.editProgress')}
                    </button>
                  </div>
                  {progressLoad === 'error' && (
                    <div role="alert" className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-4 py-3">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('settings.progressLoadFailed')}</p>
                      <button
                        onClick={loadProgress}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors"
                      >
                        <FiRefreshCw className="w-4 h-4" aria-hidden="true" /> {t('common.retry')}
                      </button>
                    </div>
                  )}
                  <div className="bg-[#f9f9ff] dark:bg-gray-700/50 rounded-xl p-4 border border-[#bfc9c3] dark:border-gray-600">
                    <p className="text-xs text-[#707974] dark:text-gray-400 mb-2 uppercase tracking-wide font-medium">{t('settings.currentlyTracking')}</p>
                    <div className="flex flex-wrap gap-2">
                      {memorizedJuz.filter(j => j.isComplete).length > 0 ? (
                        memorizedJuz.filter(j => j.isComplete).map(j => (
                          <span key={j.juzNumber} className="px-3 py-1 bg-[#003527]/10 dark:bg-emerald-900/30 text-[#003527] dark:text-emerald-400 rounded-lg text-sm font-medium">
                            {t('progress.juz')} {j.juzNumber}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[#707974] dark:text-gray-500 italic">{t('settings.noJuzYet')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Group: New Memorization ───────────────────── */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-[#003527]/10 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <FiBook className="w-3.5 h-3.5 text-[#003527] dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.dailyTarget')}</p>
                  </div>

                  <div className="mb-5">
                    <p className="text-sm text-[#404944] dark:text-gray-400 mb-3">{t('settings.dailyTargetDesc')}</p>
                    <div className="flex flex-wrap gap-3">
                      {DAILY_OPTIONS.map(v => (
                        <button
                          key={v}
                          onClick={() => { setDailyMode('fixed'); setDailyPages(v); }}
                          aria-pressed={dailyMode === 'fixed' && dailyPages === v}
                          className={`px-6 py-3 rounded-xl border font-medium transition-colors ${
                            dailyMode === 'fixed' && dailyPages === v
                              ? 'border-2 border-[#003527] bg-[#003527] text-white shadow-sm'
                              : 'border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:text-emerald-400 dark:hover:border-emerald-500 bg-[#f9f9ff] dark:bg-gray-700/50'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                      <div
                        onClick={() => {
                          const seedValue = dailyMode === 'fixed' ? dailyPages : customDailyValue;
                          setCustomInputText(String(seedValue));
                          setCustomDailyValue(seedValue);
                          setDailyMode('custom');
                          setDailyPages(seedValue);
                          customPagesInputRef.current?.focus();
                        }}
                        className={`px-4 py-3 rounded-xl border font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                          dailyMode === 'custom'
                            ? 'border-2 border-[#003527] bg-[#003527] text-white shadow-sm'
                            : 'border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:text-emerald-400 dark:hover:border-emerald-500 bg-[#f9f9ff] dark:bg-gray-700/50'
                        }`}
                      >
                        <span className="text-sm">{t('settings.customPages')}</span>
                        <input
                          ref={customPagesInputRef}
                          aria-label={t('settings.customPages')}
                          type="number" min="0.5" max="10"
                          value={dailyMode === 'custom' ? customInputText : ''}
                          placeholder="—"
                          onClick={e => e.stopPropagation()}
                          onFocus={e => {
                            if (dailyMode !== 'custom') {
                              const seedValue = dailyMode === 'fixed' ? dailyPages : customDailyValue;
                              setCustomInputText(String(seedValue));
                              setCustomDailyValue(seedValue);
                              setDailyMode('custom');
                              setDailyPages(seedValue);
                            }
                            setTimeout(() => e.target.select(), 0);
                          }}
                          onChange={e => {
                            setCustomInputText(e.target.value);
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0.5 && val <= 10) {
                              const rounded = Math.round(val * 2) / 2;
                              setCustomDailyValue(rounded);
                              setDailyPages(rounded);
                            }
                          }}
                          onBlur={() => { if (dailyMode === 'custom') setCustomInputText(String(customDailyValue)); }}
                          className={`w-12 bg-transparent text-center text-sm focus:outline-none rounded ${
                            dailyMode === 'custom' ? 'text-white placeholder-white/60' : ''
                          } ${isCustomInvalid ? 'ring-2 ring-red-400' : ''}`}
                        />
                      </div>
                    </div>
                    {isCustomInvalid && (
                      <p className="text-xs text-red-500 mt-2">{t('settings.dailyTargetRangeError')}</p>
                    )}
                  </div>

                  {/* Where new memorization starts */}
                  <div>
                    <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-1">{t('settings.memDirectionTitle')}</p>
                    <p className="text-sm text-[#404944] dark:text-gray-400 mb-3">{t('settings.memDirectionDesc')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: 'fromStart', labelKey: 'settings.memDirectionFromStart', descKey: 'settings.memDirectionFromStartDesc' },
                        { value: 'fromEnd',   labelKey: 'settings.memDirectionFromEnd',   descKey: 'settings.memDirectionFromEndDesc' },
                        { value: 'custom',    labelKey: 'settings.memDirectionCustom',    descKey: 'settings.memDirectionCustomDesc' },
                      ].map(({ value, labelKey, descKey }) => {
                        const selected = memDirChoice === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => selectMemDirection(value)}
                            className={`p-4 rounded-xl border-2 text-start transition-all h-full ${
                              selected
                                ? 'border-[#003527] bg-[#f0fdf4] dark:bg-emerald-900/20 shadow-sm'
                                : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30 hover:border-[#003527] dark:hover:border-emerald-500'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-medium ${selected ? 'text-[#003527] dark:text-emerald-300' : 'text-[#151c27] dark:text-gray-200'}`}>{t(labelKey)}</span>
                              <span className={selected ? 'text-[#003527] dark:text-emerald-400' : 'text-[#bfc9c3] dark:text-gray-500'}>{selected ? '●' : '○'}</span>
                            </div>
                            <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t(descKey)}</p>
                          </button>
                        );
                      })}
                    </div>

                    {memDirChoice === 'fromEnd' && (
                      <p className="text-xs text-[#904d00] dark:text-amber-400 mt-2">💡 {t('settings.memDirectionEndHint')}</p>
                    )}

                    {memDirChoice === 'custom' && (
                      <div className="mt-3 p-4 bg-[#f9f9ff] dark:bg-gray-700/30 rounded-xl border border-[#bfc9c3] dark:border-gray-600 flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FiMapPin className="w-4 h-4 text-[#003527] dark:text-emerald-400 shrink-0" />
                          <p className="text-xs text-[#003527] dark:text-emerald-300 font-medium">
                            {memStartPage
                              ? `${t('settings.memStartCurrent')}: ${(() => {
                                  const juzInfo = JUZ_RANGES.find(j => memStartPage >= j.start && memStartPage <= j.end);
                                  return juzInfo
                                    ? t('settings.cycleStartJuz', { juz: juzInfo.juz }) + ` · ${t('settings.cycleStartPage', { page: memStartPage })}`
                                    : t('settings.cycleStartPage', { page: memStartPage });
                                })()}`
                              : t('settings.memStartNone')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {[
                            { mode: 'juz',   labelKey: 'settings.cycleStartByJuz' },
                            { mode: 'surah', labelKey: 'settings.cycleStartBySurah' },
                          ].map(({ mode, labelKey }) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setMemStartMode(mode)}
                              aria-pressed={memStartMode === mode}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                memStartMode === mode
                                  ? 'bg-[#003527] text-white border-[#003527]'
                                  : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                              }`}
                            >
                              {t(labelKey)}
                            </button>
                          ))}
                        </div>

                        {memStartMode === 'juz' && (
                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                            {JUZ_RANGES.map(({ juz, start, end }) => {
                              const isSelected = memStartPage !== null && memStartPage >= start && memStartPage <= end;
                              return (
                                <button
                                  key={juz}
                                  type="button"
                                  onClick={() => setMemStartPage(start)}
                                  aria-pressed={isSelected}
                                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors border ${
                                    isSelected
                                      ? 'bg-[#003527] text-white border-[#003527]'
                                      : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                                  }`}
                                >
                                  {juz}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {memStartMode === 'surah' && (
                          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#dce2f3] dark:border-gray-700 divide-y divide-[#dce2f3] dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {SURAH_PAGES.map(s => {
                              const isSelected = memStartPage === s.start;
                              return (
                                <button
                                  key={s.number}
                                  type="button"
                                  onClick={() => setMemStartPage(s.start)}
                                  aria-pressed={isSelected}
                                  className={`w-full flex items-center justify-between px-4 py-2.5 text-start transition-colors ${
                                    isSelected ? 'bg-[#003527] text-white' : 'hover:bg-[#f0fdf4] dark:hover:bg-emerald-900/20 text-[#151c27] dark:text-gray-200'
                                  }`}
                                >
                                  <span className="text-sm font-medium">{s.number}. {isArabic ? s.arabic : s.name}</span>
                                  <span className={`text-xs shrink-0 ${isSelected ? 'text-white/70' : 'text-[#707974] dark:text-gray-400'}`}>
                                    {t('settings.cycleStartPage', { page: s.start })}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <p className="text-xs text-[#707974] dark:text-gray-400">{t('settings.memStartWrapHint')}</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* ── Group: Review ─────────────────────────────── */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-[#fe932c]/15 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <FiRefreshCw className="w-3.5 h-3.5 text-[#904d00] dark:text-amber-400" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.reviewSettings')}</p>
                    <InfoHint text={t('hints.review')} label={t('dashboard.review')} size="xs" />
                  </div>

                  <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">{t('settings.reviewSettingsDesc')}</p>

                  {/* One unified selector: three presets + Fixed number, side by side */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {INTENSITY_OPTIONS.map(({ value, labelKey, descKey, divisor }) => {
                      const estimate = estimateReviewPages(todayStats?.totalMemorized, divisor);
                      const selected = reviewMode === 'intensity' && intensity === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { setReviewMode('intensity'); setIntensity(value); }}
                          aria-pressed={selected}
                          className={`p-4 rounded-xl border-2 text-start transition-all h-full ${
                            selected
                              ? 'border-[#fe932c] bg-[#f9f9ff] dark:bg-gray-700/50 shadow-sm'
                              : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30 hover:border-[#003527] dark:hover:border-emerald-500'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-medium ${selected ? 'text-[#904d00]' : 'text-[#151c27] dark:text-gray-200'}`}>{t(labelKey)}</span>
                            <span aria-hidden="true" className={selected ? 'text-[#fe932c]' : 'text-[#bfc9c3] dark:text-gray-500'}>{selected ? '●' : '○'}</span>
                          </div>
                          {estimate != null && (
                            <p className="text-xs font-semibold text-[#904d00] dark:text-amber-400 mb-1">{t('settings.intensityEstimate', { count: estimate })}</p>
                          )}
                          <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t(descKey)}</p>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        // Start the fixed count at what the intensity gives today.
                        // Unknown (today's stats did not load): leave the count as
                        // it is — a made-up 5 could be far from the reader's load.
                        if (reviewMode === 'intensity' && todayStats?.dailyReviewTarget != null) {
                          setCycleReviewValue(todayStats.dailyReviewTarget);
                        }
                        setReviewMode('fixed');
                      }}
                      aria-pressed={reviewMode === 'fixed'}
                      className={`p-4 rounded-xl border-2 text-start transition-all h-full ${
                        reviewMode === 'fixed'
                          ? 'border-[#fe932c] bg-[#f9f9ff] dark:bg-gray-700/50 shadow-sm'
                          : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30 hover:border-[#003527] dark:hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-medium ${reviewMode === 'fixed' ? 'text-[#904d00]' : 'text-[#151c27] dark:text-gray-200'}`}>{t('settings.modeFixed')}</span>
                        <span aria-hidden="true" className={reviewMode === 'fixed' ? 'text-[#fe932c]' : 'text-[#bfc9c3] dark:text-gray-500'}>{reviewMode === 'fixed' ? '●' : '○'}</span>
                      </div>
                      <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t('settings.modeFixedDesc')}</p>
                    </button>
                  </div>

                  <p className="text-xs text-[#707974] dark:text-gray-400 mb-5 leading-relaxed">{t('settings.modeIntensityDesc')}</p>

                  {/* Fixed number reveals a single page-count input; recent-pages lives in Advanced */}
                  {reviewMode === 'fixed' && (
                    <div className="flex items-center justify-between gap-4 p-4 mb-6 bg-[#f9f9ff] dark:bg-gray-700/30 rounded-xl border border-[#bfc9c3] dark:border-gray-600">
                      <div className="min-w-0">
                        <p id="settings-cycle-review-label" className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('settings.cycleReviewLabel')}</p>
                        <p id="settings-cycle-review-hint" className="text-xs text-[#707974] dark:text-gray-400">{t('settings.cycleReviewHint')}</p>
                      </div>
                      <input type="number" min="0" max="40" value={cycleReviewValue}
                        aria-labelledby="settings-cycle-review-label" aria-describedby="settings-cycle-review-hint"
                        onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0 && n <= 40) setCycleReviewValue(n); }}
                        className="w-16 shrink-0 border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527]" />
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-1">{t('settings.restDays')}</p>
                    <p className="text-sm text-[#404944] dark:text-gray-400 mb-3">{t('settings.restDaysDesc')}</p>
                    <div className="flex flex-wrap gap-5">
                      {DAY_LABEL_KEYS.map((labelKey, idx) => {
                        const jsDay = DAY_JS_INDICES[idx];
                        return (
                          <label key={labelKey} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!offDays.includes(jsDay)} onChange={() => toggleOffDay(jsDay)}
                              className="w-5 h-5 rounded border-[#707974] accent-[#003527] cursor-pointer" />
                            <span className="font-medium text-[#151c27] dark:text-gray-200">{t(labelKey)}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#707974] dark:text-gray-400 mt-2">
                      {t('onboarding.availableDaysHint', { count: 7 - offDays.length })}
                    </p>
                  </div>
                </div>

                {/* ── Group: Advanced (Review Cycle Start) ──────── */}
                <div className="p-6">
                  <button
                    onClick={() => setShowAdvanced(v => !v)}
                    aria-expanded={showAdvanced}
                    className="flex items-center justify-between w-full gap-2 text-start"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[#003527]/10 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <FiMapPin className="w-3.5 h-3.5 text-[#003527] dark:text-emerald-400" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.advanced')}</span>
                    </span>
                    {showAdvanced
                      ? <FiChevronUp className="w-4 h-4 text-[#707974] dark:text-gray-500 shrink-0" />
                      : <FiChevronDown className="w-4 h-4 text-[#707974] dark:text-gray-500 shrink-0" />}
                  </button>

                  {showAdvanced && (
                  <div className="mt-5 space-y-8">

                  {/* Review-only mode (moved into Advanced) */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-[#003527]/10 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <FiPause className="w-3.5 h-3.5 text-[#003527] dark:text-emerald-400" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.pauseMemTitle')}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4 bg-[#f9f9ff] dark:bg-gray-700/30 rounded-xl border border-[#bfc9c3] dark:border-gray-600">
                      <div className="min-w-0">
                        <p className="text-xs text-[#707974] dark:text-gray-400 leading-relaxed">
                          {isPaused ? t('settings.pauseMemActive', { count: dailyPages }) : t('settings.pauseMemDesc')}
                        </p>
                        <p className="text-xs text-[#003527] dark:text-emerald-400 mt-1">{t('settings.pauseMemSwitchBack')}</p>
                      </div>
                      <Tooltip label={t('tooltips.pauseToggle')}>
                        <button
                          onClick={togglePause}
                          disabled={pauseSaving}
                          aria-label={t('settings.pauseMemTitle')}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                            isPaused ? 'bg-[#003527]' : 'bg-[#bfc9c3] dark:bg-gray-500'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                            isPaused ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Recent review pages per day — applies to every review mode */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-[#fe932c]/15 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <FiRefreshCw className="w-3.5 h-3.5 text-[#904d00] dark:text-amber-400" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.recentReviewLabel')}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4 bg-[#f9f9ff] dark:bg-gray-700/30 rounded-xl border border-[#bfc9c3] dark:border-gray-600">
                      <div className="min-w-0">
                        <p id="settings-recent-review-label" className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('settings.recentReviewLabel')}</p>
                        <p id="settings-recent-review-hint" className="text-xs text-[#707974] dark:text-gray-400">{t('settings.recentReviewHint')}</p>
                      </div>
                      <input type="number" min="0" max="20" value={recentReviewValue}
                        aria-labelledby="settings-recent-review-label" aria-describedby="settings-recent-review-hint"
                        onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0 && n <= 20) setRecentReviewValue(n); }}
                        className="w-16 shrink-0 border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527]" />
                    </div>
                  </div>

                  {/* Review Cycle Start Point */}
                  <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-md bg-[#003527]/10 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <FiMapPin className="w-3.5 h-3.5 text-[#003527] dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#707974] dark:text-gray-400">{t('settings.cycleStartTitle')}</p>
                  </div>
                  <p className="text-sm text-[#404944] dark:text-gray-400 mb-4 mt-1">{t('settings.cycleStartDesc')}</p>

                  {/* Current start indicator */}
                  <div className="flex items-center gap-3 mb-4 p-3 bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-xl border border-green-100 dark:border-emerald-800/30">
                    <FiMapPin className="w-4 h-4 text-[#003527] dark:text-emerald-400 shrink-0" />
                    <p className="text-xs text-[#003527] dark:text-emerald-300 font-medium flex-1">
                      {cycleStartPage
                        ? `${t('settings.cycleStartCurrent')}: ${(() => {
                            const juzInfo = JUZ_RANGES.find(j => cycleStartPage >= j.start && cycleStartPage <= j.end);
                            return juzInfo
                              ? t('settings.cycleStartJuz', { juz: juzInfo.juz }) + ` · ${t('settings.cycleStartPage', { page: cycleStartPage })}`
                              : t('settings.cycleStartPage', { page: cycleStartPage });
                          })()}`
                        : t('settings.cycleStartNone')}
                    </p>
                    {cycleStartPage && (
                      <button onClick={clearCycleStart} disabled={cycleStartSaving}
                        className="text-xs text-[#ba1a1a] hover:text-red-800 dark:hover:text-red-300 font-medium flex items-center gap-1 shrink-0 disabled:opacity-50">
                        <FiRotateCcw className="w-3 h-3" /> {t('settings.cycleStartClear')}
                      </button>
                    )}
                  </div>

                  {/* Picker sub-tabs */}
                  <div className="flex gap-2 mb-3">
                    {[
                      { mode: 'juz',   labelKey: 'settings.cycleStartByJuz' },
                      { mode: 'surah', labelKey: 'settings.cycleStartBySurah' },
                      { mode: 'page',  labelKey: 'settings.cycleStartByPage' },
                    ].map(({ mode, labelKey }) => (
                      <button key={mode} onClick={() => setCycleStartMode(mode)}
                        aria-pressed={cycleStartMode === mode}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          cycleStartMode === mode
                            ? 'bg-[#003527] text-white border-[#003527]'
                            : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                        }`}>
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>

                  {cycleStartMode === 'juz' && (
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {(() => {
                        const memSet = new Set(memorizedPageNums);
                        return memorizedJuz.filter(j => j.memorizedPages > 0).map(juz => {
                          let firstMemPage = juz.startPage;
                          for (let p = juz.startPage; p <= juz.endPage; p++) {
                            if (memSet.has(p)) { firstMemPage = p; break; }
                          }
                          return { ...juz, firstMemPage };
                        });
                      })().map(juz => {
                        const isSelected = cycleStartPage !== null
                          && cycleStartPage >= juz.startPage && cycleStartPage <= juz.endPage;
                        return (
                          <button key={juz.juzNumber}
                            onClick={() => saveCycleStart(juz.firstMemPage)}
                            aria-pressed={isSelected}
                            aria-label={t('common.juzN', { n: juz.juzNumber })}
                            disabled={cycleStartSaving}
                            className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors border ${
                              isSelected
                                ? 'bg-[#003527] text-white border-[#003527]'
                                : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                            } disabled:opacity-60`}
                          >
                            <span>{juz.juzNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {cycleStartMode === 'surah' && (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-[#dce2f3] dark:border-gray-700 divide-y divide-[#dce2f3] dark:divide-gray-700">
                      {(() => {
                        const memSet = new Set(memorizedPageNums);
                        return SURAH_PAGES
                          .filter(s => { for (let p = s.start; p <= s.end; p++) if (memSet.has(p)) return true; return false; })
                          .map(s => {
                            let firstMemPage = s.start;
                            for (let p = s.start; p <= s.end; p++) { if (memSet.has(p)) { firstMemPage = p; break; } }
                            return { ...s, firstMemPage };
                          });
                      })().map(s => {
                        const isSelected = cycleStartPage === s.firstMemPage;
                        return (
                          <button key={s.number} onClick={() => saveCycleStart(s.firstMemPage)}
                            aria-pressed={isSelected}
                            disabled={cycleStartSaving}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-start transition-colors disabled:opacity-60 ${
                              isSelected ? 'bg-[#003527] text-white' : 'hover:bg-[#f0fdf4] dark:hover:bg-emerald-900/20 text-[#151c27] dark:text-gray-200'
                            }`}
                          >
                            <span className="text-sm font-medium">{s.number}. {isArabic ? s.arabic : s.name}</span>
                            <span className={`text-xs shrink-0 ${isSelected ? 'text-white/70' : 'text-[#707974] dark:text-gray-400'}`}>
                              {t('settings.cycleStartPage', { page: s.firstMemPage })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {cycleStartMode === 'page' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <input type="number" min="1" max="604" value={cycleStartInput}
                        aria-label={t('settings.cycleStartPageHint')}
                        onChange={e => setCycleStartInput(e.target.value)} placeholder="1–604"
                        className="w-28 border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527]" />
                      <button
                        onClick={() => {
                          const n = parseInt(cycleStartInput, 10);
                          const memSet = new Set(memorizedPageNums);
                          if (isNaN(n) || n < 1 || n > 604 || !memSet.has(n)) {
                            showToast(t('settings.cycleStartPageInvalid'), 'error'); return;
                          }
                          saveCycleStart(n);
                        }}
                        disabled={cycleStartSaving || !cycleStartInput}
                        className="bg-[#003527] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#064e3b] transition-colors disabled:opacity-60">
                        {t('settings.cycleStartSet')}
                      </button>
                      <p className="text-xs text-[#707974] dark:text-gray-400">{t('settings.cycleStartPageHint')}</p>
                    </div>
                  )}
                  </div>
                  </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Appearance ──────────────────────────────── */}
            {activeSection === 'appearance' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                  <FiMonitor className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                  <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{t('settings.theme')}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-3">{t('settings.theme')}</p>
                    <div className="bg-[#f9f9ff] dark:bg-gray-700/50 rounded-xl p-2 flex gap-1 border border-[#bfc9c3] dark:border-gray-600">
                      {[
                        { id: 'light', labelKey: 'settings.lightTheme', icon: <FiSun className="w-4 h-4" /> },
                        { id: 'dark',  labelKey: 'settings.darkTheme',  icon: <FiMoon className="w-4 h-4" /> },
                        { id: 'auto',  labelKey: 'settings.autoTheme',  icon: <FiZap className="w-4 h-4" /> },
                      ].map(({ id, labelKey, icon }) => (
                        <button
                          key={id}
                          onClick={() => setTheme(id)}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            theme === id
                              ? 'bg-white dark:bg-gray-600 shadow-sm border border-[#bfc9c3] dark:border-gray-500 text-[#003527] dark:text-gray-100'
                              : 'text-[#404944] dark:text-gray-400 hover:bg-[#e7eefe] dark:hover:bg-gray-700'
                          }`}
                        >
                          {icon} {t(labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-3">{t('settings.language')}</p>
                    <button
                      onClick={changeLanguage}
                      className="w-full py-3 px-4 rounded-xl border border-[#bfc9c3] dark:border-gray-600 text-[#151c27] dark:text-gray-200 bg-[#f9f9ff] dark:bg-gray-700 font-medium hover:bg-[#e7eefe] dark:hover:bg-gray-600 transition-colors text-start"
                    >
                      {i18n.language === 'en' ? t('settings.arabic') : t('settings.english')}
                    </button>
                  </div>
                </div>

                <SingleKeyShortcutsRow />
              </section>
            )}

            {/* ── Help & Guides ───────────────────────────── */}
            {activeSection === 'help' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-2 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                  <FiHelpCircle className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                  <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{t('settings.helpTitle')}</h2>
                </div>
                <p className="text-sm text-[#404944] dark:text-gray-400 mb-6 mt-4">{t('settings.helpDesc')}</p>

                <div className="flex flex-col gap-3">
                  {/* How to memorize a page */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 rounded-xl border border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('settings.showGuide')}</p>
                      <p className="text-xs text-[#707974] dark:text-gray-400 mt-0.5">{t('settings.showGuideDesc')}</p>
                    </div>
                    <button
                      onClick={() => setHowToOpen(true)}
                      className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-[#003527] dark:text-gray-200 font-medium text-sm hover:bg-[#e7eefe] dark:hover:bg-gray-700 transition-colors"
                    >
                      <FiHelpCircle className="w-4 h-4" /> {t('settings.showGuide')}
                    </button>
                  </div>

                  {/* Replay the dashboard tour */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 rounded-xl border border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('settings.replayTour')}</p>
                      <p className="text-xs text-[#707974] dark:text-gray-400 mt-0.5">{t('settings.replayTourDesc')}</p>
                    </div>
                    <button
                      onClick={() => navigate('/dashboard?tour=1')}
                      className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-[#003527] dark:text-gray-200 font-medium text-sm hover:bg-[#e7eefe] dark:hover:bg-gray-700 transition-colors"
                    >
                      <FiPlay className="w-4 h-4" /> {t('settings.replayTour')}
                    </button>
                  </div>

                  {/* Replay the Library tour */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 rounded-xl border border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('settings.replayLibraryTour')}</p>
                      <p className="text-xs text-[#707974] dark:text-gray-400 mt-0.5">{t('settings.replayLibraryTourDesc')}</p>
                    </div>
                    <button
                      onClick={() => navigate('/library?tour=1')}
                      className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-[#003527] dark:text-gray-200 font-medium text-sm hover:bg-[#e7eefe] dark:hover:bg-gray-700 transition-colors"
                    >
                      <FiPlay className="w-4 h-4" /> {t('settings.replayLibraryTour')}
                    </button>
                  </div>
                </div>
              </section>
            )}

          </div>
        </div>
      </main>

      {/* ── Sticky save bar ───────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-[#dce2f3] dark:border-gray-700 shadow-lg px-6 pe-20 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#404944] dark:text-gray-400">{t('settings.unsavedChanges')}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="text-sm text-[#404944] dark:text-gray-400 border border-[#bfc9c3] dark:border-gray-600 px-4 py-2.5 rounded-xl hover:bg-[#f0f3ff] dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {t('settings.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#003527] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#064e3b] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? t('settings.saving') : <><FiSave className="w-4 h-4" /> {t('settings.save')}</>}
            </button>
          </div>
        </div>
      )}

      <Footer />

      <EditProgressModal
        isOpen={editProgressOpen}
        onClose={() => setEditProgressOpen(false)}
        onSave={loadProgress}
        onRetryLoad={loadProgress}
        progressLoad={progressLoad}
        memorizedPageNums={memorizedPageNums}
        partialPages={partialPages}
      />

      <ConfirmModal
        isOpen={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleResetProgress}
        title={t('settings.resetModal_title')}
        message={t('settings.resetModal_message', { count: user?.currentStreak ?? 0 })}
        confirmText={t('settings.resetConfirm')}
        isDanger
      />
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title={t('settings.deleteModal_title')}
        message={t('settings.deleteModal_message')}
        confirmText={t('settings.deleteConfirm')}
        isDanger
      />

      <HowToMemorizeModal isOpen={howToOpen} onClose={() => setHowToOpen(false)} />
    </div>
  );
}
