const { classifyError } = require('../utils/errorResponse');

// The app's last word on any error that reaches Express itself rather than a
// controller's own catch block — above all the JSON body parser's, which runs
// before any route. Without this, Express answered with its default HTML page:
// a malformed body or an oversized one came back as text/html with the stack
// trace and the server's file paths in it. Every error here leaves as JSON in
// the same { success, message } shape the routes use.
//
// Express recognises an error handler by its four parameters, so `next` must
// stay in the signature even where it is unused.
const jsonErrorHandler = (err, req, res, next) => {
  // Too late to choose a status: let Express close the connection.
  if (res.headersSent) return next(err);

  // body-parser (express.json) tags its errors with a `type`.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }
  // Any other client error the parser raised (unsupported charset or encoding, an
  // aborted upload…) keeps its status, with a generic message: http-errors marks
  // these `expose`, meaning their status is safe to show.
  const status = err.status || err.statusCode;
  if (err.expose && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: 'Invalid request' });
  }

  // A model validation or duplicate-key error that escaped a controller.
  const known = classifyError(err);
  if (known) return res.status(known.status).json({ success: false, message: known.message });

  console.error('Unhandled error:', err);
  const body = { success: false, message: 'Server error' };
  // Never a stack; the raw message only outside production, as in serverError.
  if (process.env.NODE_ENV !== 'production' && err && err.message) body.error = err.message;
  return res.status(500).json(body);
};

module.exports = { jsonErrorHandler };
