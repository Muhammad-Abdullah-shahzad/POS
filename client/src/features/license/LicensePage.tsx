/**
 * Licence page.
 *
 * Modelled on Windows activation screens: the brand blue fills the screen,
 * the licence is stated plainly, and a new key goes into a single field. It doubles as the lock screen. Once the licence lapses the route guard
 * sends every page here, and the only ways forward are entering a key,
 * checking for a renewal, or signing out.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader } from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { isLicenseBlocking, useLicenseStore } from '../../store/licenseStore';
import type { LicenseStatus } from '../../store/licenseStore';
import { activateLicense, fetchLicenseStatus, refreshLicenseStatus } from '../../services/licenseService';
import { signOutEverywhere } from '../../services/sessionService';
import classes from './LicensePage.module.css';
import { LICENSE_KEY_PREFIX, inspectLicenseKey, maskLicenseKey } from './licenseKeyFormat';

type NoticeTone = 'error' | 'success' | 'info';

interface Notice {
  tone: NoticeTone;
  text: string;
}

/** A licence ending within this many days is shown as a warning. */
const WARNING_DAYS = 7;

const EXAMPLE_KEY = `${LICENSE_KEY_PREFIX}.XXXXXXXX…XXXXXXXX`;

const KIND_LABEL = { paid: 'Full licence', trial: 'Free trial' } as const;

const NOTICE_ICON = {
  error: <IconAlertCircle size={20} />,
  success: <IconCircleCheck size={20} />,
  info: <IconInfoCircle size={20} />,
} as const;

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const endsSoon = (status: LicenseStatus): boolean =>
  status.state === 'active' && (status.daysLeft ?? Number.POSITIVE_INFINITY) <= WARNING_DAYS;

function title(status: LicenseStatus): string {
  switch (status.state) {
    case 'active':
      if (!endsSoon(status)) return 'Activated';
      return (status.daysLeft ?? 0) <= 0 ? 'Licence ends today' : `Licence ends in ${plural(status.daysLeft ?? 0, 'day')}`;
    case 'expired':
      return 'Licence expired';
    case 'missing':
      return 'Enter a licence key';
    case 'invalid':
      return "This licence can't be used";
    default:
      return 'Checking licence…';
  }
}

/** One sentence that matters more than the details below it, or nothing. */
function lead(status: LicenseStatus): string | null {
  const until = status.expiresAt ? formatDate(status.expiresAt) : null;

  if (status.state === 'expired' && until) return `Your licence ended on ${until}. Enter a new licence key to keep using the app.`;
  if (status.state === 'invalid') return status.message;
  if (endsSoon(status) && until) return `Renew before ${until} to keep using the app without interruption.`;
  return null;
}

function statusLabel(status: LicenseStatus): string {
  const state = {
    active: 'Active',
    expired: 'Expired',
    missing: 'Not activated',
    invalid: 'Invalid',
    unknown: 'Checking…',
  }[status.state];

  return status.kind ? `${state} · ${KIND_LABEL[status.kind]}` : state;
}

function validity(status: LicenseStatus): string | null {
  if (!status.expiresAt) return null;

  const date = formatDate(status.expiresAt);
  if (status.daysLeft === null) return date;
  if (status.state === 'expired' || status.daysLeft < 0) return `Ended ${date}`;
  return `${date} (${status.daysLeft === 0 ? 'ends today' : `${plural(status.daysLeft, 'day')} left`})`;
}

const LicensePage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const status = useLicenseStore((state) => state.status);

  const [key, setKey] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<'activate' | 'refresh' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (user) fetchLicenseStatus().catch(() => undefined);
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  const locked = isLicenseBlocking(status);
  const inspection = inspectLicenseKey(key);
  const maskedKey = maskLicenseKey(status.keyHint);
  const validUntil = validity(status);
  const leadText = lead(status);

  // An action's result wins over the live format check.
  const message: Notice | null =
    notice ?? (touched && inspection.verdict === 'invalid' ? { tone: 'error', text: inspection.problem ?? '' } : null);

  const activate = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (inspection.verdict !== 'plausible' || busy) return;

    setBusy('activate');
    setNotice(null);
    try {
      const result = await activateLicense(inspection.key);
      if (result.success) {
        setKey('');
        setTouched(false);
        setNotice({
          tone: 'success',
          text: result.status.expiresAt
            ? `Licence activated. It is valid until ${formatDate(result.status.expiresAt)}.`
            : 'Licence activated.',
        });
      } else {
        setNotice({ tone: 'error', text: result.message });
      }
    } catch {
      setNotice({ tone: 'error', text: 'The key could not be activated right now. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  };

  const checkForRenewal = async () => {
    setBusy('refresh');
    setNotice(null);
    try {
      const refreshed = await refreshLicenseStatus();
      if (refreshed.offline) {
        setNotice({ tone: 'info', text: 'Could not reach the server. Enter the key you were sent to activate offline.' });
      } else if (refreshed.state === 'active') {
        setNotice({ tone: 'success', text: 'Your licence is up to date.' });
      } else {
        setNotice({ tone: 'info', text: 'No renewal has been recorded yet. Enter the key you were sent, or try again later.' });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Could not check for a renewal right now. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await signOutEverywhere();
    navigate('/login', { replace: true });
  };

  return (
    <main className={classes.page}>
      <form className={classes.content} onSubmit={activate} noValidate>
        <h1 className={classes.title}>{title(status)}</h1>
        {leadText && <p className={classes.lead}>{leadText}</p>}

        <dl className={classes.facts}>
          <dt>Company</dt>
          <dd>{user.tenantName}</dd>
          <dt>Status</dt>
          <dd>{statusLabel(status)}</dd>
          {validUntil && (
            <>
              <dt>Valid until</dt>
              <dd>{validUntil}</dd>
            </>
          )}
          {maskedKey && (
            <>
              <dt>Licence key</dt>
              <dd className={classes.mono}>{maskedKey}</dd>
            </>
          )}
        </dl>

        <hr className={classes.rule} />

        <p className={classes.text}>Your licence key is in the email Deviction Technologies sent you after payment.</p>
        <p className={classes.example}>
          The licence key looks similar to this:
          <br />
          LICENCE KEY: <span className={classes.mono}>{EXAMPLE_KEY}</span>
        </p>

        <label className={classes.label} htmlFor="licence-key">
          Licence key
        </label>
        <div className={classes.fieldRow}>
          <input
            id="licence-key"
            className={classes.input}
            value={key}
            onChange={(event) => {
              setKey(event.currentTarget.value);
              setNotice(null);
            }}
            onBlur={() => setTouched(true)}
            placeholder={`${LICENSE_KEY_PREFIX}.…`}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoFocus={locked}
            aria-invalid={touched && inspection.verdict === 'invalid'}
            aria-describedby="licence-message"
          />
          <span className={classes.spinner} aria-hidden={!busy}>
            {busy && <Loader size={24} color="white" />}
          </span>
        </div>

        <div id="licence-message" className={classes.message} data-tone={message?.tone} role="status" aria-live="polite">
          {message && (
            <>
              {NOTICE_ICON[message.tone]}
              <span>{message.text}</span>
            </>
          )}
        </div>

        <div className={classes.actions}>
          <button type="button" className={`${classes.button} ${classes.secondary}`} onClick={checkForRenewal} disabled={busy !== null}>
            Check for renewal
          </button>
          <button type="submit" className={`${classes.button} ${classes.primary}`} disabled={busy !== null || inspection.verdict !== 'plausible'}>
            Activate
          </button>
        </div>
      </form>

      <footer className={classes.footer}>
        <span>
          Signed in as {user.name}
          {status.checkedAt ? ` · checked ${formatTime(status.checkedAt)}` : ''}
          {status.offline ? ' · offline' : ''}
        </span>
        <span className={classes.links}>
          {!locked && (
            <button type="button" className={classes.link} onClick={() => navigate(isAdmin() ? '/admin' : '/')}>
              Back to the app
            </button>
          )}
          <button type="button" className={classes.link} onClick={signOut}>
            Sign out
          </button>
        </span>
      </footer>
    </main>
  );
};

export default LicensePage;
