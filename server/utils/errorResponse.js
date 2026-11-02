// Turns an error caught by a controller into the right JSON response. Every
// controller funnels its catch block through serverError, so the mapping below
// applies to every route at once:
//
//   - a Mongoose ValidationError (a model rule the controller did not pre-check,
//     e.g. a missing name) or CastError (a value of the wrong type) is the
//     CLIENT's mistake → 400, with the model's own message, which we wrote and
//     which carries nothing internal;
//   - a duplicate key (MongoDB E11000, usually a race past a findOne check) is a
//     conflict → 409 — but NOT from a multi-document write (bulkWrite,
//     insertMany): that error comes after some documents may already be
//     written, so it is our fault to report as a 500, never a "this item
//     already exists" that sounds like nothing happened;
//   - anything else is ours → 500. Its raw message is exposed only OUTSIDE
//     production, so developers can debug locally while production clients get a
//     generic message and never see stack or driver internals.
//
// The real error is still logged server-side by the caller via logError (below)
// before this runs. Returns the res object so callers can `return serverError(...)`.

// A CastError's own message echoes the rejected value back ("Cast to Number
// failed for value …"); name only the field instead.
const castMessage = (err) => (err.path ? `Invalid value for ${err.path}` : 'Invalid value');

// { status, code, message } for an error the client caused, or null for a server fault.
const classifyError = (error) => {
  if (!error) return null;
  if (error.name === 'ValidationError' && error.errors) {
    const first = Object.values(error.errors)[0];
    const message = !first
      ? 'Invalid request'
      : first.name === 'CastError' ? castMessage(first) : first.message;
    return { status: 400, code: 'INVALID_REQUEST', message };
  }
  if (error.name === 'CastError') return { status: 400, code: 'INVALID_REQUEST', message: castMessage(error) };
  const multiDocWrite = error.name === 'MongoBulkWriteError' || Array.isArray(error.writeErrors);
  if (error.code === 11000 && !multiDocWrite) {
    const field = Object.keys(error.keyValue || error.keyPattern || {})[0];
    return {
      status: 409,
      code: field === 'email' ? 'EMAIL_TAKEN' : 'DUPLICATE',
      message: field === 'email' ? 'An account with this email already exists' : 'This item already exists',
    };
  }
  return null;
};

const serverError = (res, message, error) => {
  const known = classifyError(error);
  if (known) return res.status(known.status).json({ success: false, code: known.code, message: known.message });

  const body = { success: false, code: 'SERVER_ERROR', message };
  if (process.env.NODE_ENV !== 'production' && error && error.message) {
    body.error = error.message;
  }
  return res.status(500).json(body);
};

// What a caught error leaves in the host's logs (H-05). Some errors quote the
// value that was refused: a duplicate key in its message ("dup key: { email: … }")
// and in keyValue — for the users collection, an email address — and a
// ValidationError or CastError in each field's `value` (a too-long name, say).
// Those are logged by class, code, the fields involved and the stack frames,
// which still say which write failed and where, but never the values. Every
// other error is a fault of ours and is logged whole, as before.
const isDuplicateKey = (error) => error?.code === 11000
  || (Array.isArray(error?.writeErrors) && error.writeErrors.some((w) => w?.code === 11000))
  || /\bE11000\b/.test(String(error?.message ?? ''));
const QUOTES_VALUES = new Set(['ValidationError', 'CastError']);

const logError = (label, error) => {
  const duplicate = isDuplicateKey(error);
  if (!duplicate && !QUOTES_VALUES.has(error?.name)) {
    console.error(label, error);
    return;
  }
  const name = error.constructor?.name || error.name || 'Error';
  const fields = duplicate
    ? Object.keys(error.keyPattern || error.keyValue || {})
    : error.errors ? Object.keys(error.errors) : [error.path].filter(Boolean);
  const what = duplicate ? `${error.code ?? 11000} duplicate key` : 'invalid value';
  const frames = typeof error.stack === 'string'
    ? error.stack.split('\n').filter((line) => /^\s+at /.test(line)).join('\n')
    : '';
  console.error(label, `${name} ${what}${fields.length ? ` (${fields.join(', ')})` : ''}; value not logged${frames ? `\n${frames}` : ''}`);
};

module.exports = { serverError, classifyError, logError };
