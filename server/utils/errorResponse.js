// Sends a uniform 500 JSON response. The raw error message is exposed only
// OUTSIDE production, so developers can debug locally while production clients
// receive a generic message and never see stack/driver internals. The real
// error is still logged server-side by the caller via console.error before
// this runs. Returns the res object so callers can `return serverError(...)`.
const serverError = (res, message, error) => {
  const body = { success: false, message };
  if (process.env.NODE_ENV !== 'production' && error && error.message) {
    body.error = error.message;
  }
  return res.status(500).json(body);
};

module.exports = { serverError };
