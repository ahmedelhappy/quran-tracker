// A tiny hand-rolled request validator (no schema library). Its one job is to
// gate the TYPE of each incoming field before it reaches a controller — most
// importantly to reject objects/arrays where a plain string or number is
// expected. That closes the NoSQL-operator injection surface: without it, a body
// like { "email": { "$gt": "" } } would flow straight into User.findOne({ email })
// and match an arbitrary user. It is a type gate only; the controllers keep their
// own range/enum/business checks and run after this passes.

// A "scalar" predicate deliberately rejects objects and arrays. Numbers may also
// arrive as numeric strings (form/query values), which we accept.
const isScalarString = (v) => typeof v === 'string';
const isScalarNumber = (v) =>
  typeof v === 'number'
    ? Number.isFinite(v)
    : typeof v === 'string'
      ? v.trim() !== '' && Number.isFinite(Number(v))
      : false;
const isScalarBoolean = (v) =>
  typeof v === 'boolean' || v === 'true' || v === 'false';
// An array whose every element is a finite number — e.g. offDays / memorizedPages.
// Crucially still an array, so a Mongo-operator object can never masquerade as one.
const isNumberArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));

const CHECKS = {
  string: isScalarString,
  number: isScalarNumber,
  boolean: isScalarBoolean,
  numberArray: isNumberArray,
};

// Builds a middleware that type-checks one request container (body or query)
// against a field→spec map. A spec is either a type name ('string' | 'number' |
// 'boolean' | 'numberArray') or { type, nullable }. Fields absent from the
// request are skipped — routes do partial updates — but any field that IS present
// must match its declared type (or be null when nullable). Returns 400 otherwise.
const validateContainer = (source, schema) => (req, res, next) => {
  const data = req[source];

  // The container itself must be a plain object, never an array or scalar —
  // express.json() will happily parse a top-level array/number/string.
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ success: false, message: `Invalid request ${source}` });
  }

  for (const [field, rawSpec] of Object.entries(schema)) {
    const spec = typeof rawSpec === 'string' ? { type: rawSpec } : rawSpec;
    const value = data[field];

    if (value === undefined) continue; // not sent — nothing to type-check
    if (value === null) {
      if (spec.nullable) continue;
      return res.status(400).json({ success: false, message: `${field} must be a ${spec.type}` });
    }

    const check = CHECKS[spec.type];
    if (!check || !check(value)) {
      return res.status(400).json({ success: false, message: `${field} must be a valid ${spec.type}` });
    }
  }

  next();
};

const validateBody = (schema) => validateContainer('body', schema);
const validateQuery = (schema) => validateContainer('query', schema);

module.exports = { validateBody, validateQuery };
