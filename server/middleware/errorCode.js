// Every error the API sends carries a stable machine `code` next to its English
// `message`, so the client can show it in the reader's language instead of the
// English text (L-08). The errors a person can act on set their own code
// (INVALID_CREDENTIALS, BOOKMARK_LIMIT, PASSWORD_TOO_SHORT …); this gives every
// other one — mostly request-shape refusals a well-behaved client never
// triggers — a code from its status, so a client can rely on `code` being there.
// `message` stays, unchanged, for older clients and for logs.
const BY_STATUS = {
  400: 'INVALID_REQUEST',
  401: 'NOT_AUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

const codeForStatus = (status) => BY_STATUS[status] ?? (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED');

// Mounted before the body parser, so even the parser's errors (which skip every
// later middleware on their way to the error handler) pass through it.
const ensureErrorCode = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    const isErrorBody = body && typeof body === 'object' && !Array.isArray(body);
    if (res.statusCode >= 400 && isErrorBody && body.code == null) {
      return json({ ...body, code: codeForStatus(res.statusCode) });
    }
    return json(body);
  };
  next();
};

module.exports = { ensureErrorCode, codeForStatus };
