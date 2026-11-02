import { useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import { reportLoadFailure } from '../utils/reportError';

// Whether the server offers password reset (H-06): true, false, or null while
// it is not known yet. It is off until an email provider is configured, and a
// "Forgot password?" link that leads to "not available" is worse than none, so
// the link shows only on a definite true.
//
// The answer only changes with a redeploy, so a successful one is kept for the
// visit. A failed check is not (nothing that failed is cached, M-14): it is
// reported, once however many screens were waiting on it, and leaves the value
// null, the link hidden, and the next screen asks again.
let known = null;
let pending = null;

const check = () => {
  pending ??= authAPI.getConfig()
    .then((res) => { known = res.data?.data?.passwordReset === true; return known; })
    .catch((err) => { reportLoadFailure(err, 'the auth config'); throw err; })
    .finally(() => { pending = null; });
  return pending;
};

export const usePasswordResetAvailable = () => {
  const [available, setAvailable] = useState(known);
  useEffect(() => {
    if (known !== null) return undefined;
    let live = true;
    // The failure was reported in check(); this screen just stays at null.
    check().then((value) => { if (live) setAvailable(value); }, () => {});
    return () => { live = false; };
  }, []);
  return available;
};
