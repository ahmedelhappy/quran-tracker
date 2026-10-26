// What Express should make of X-Forwarded-For, i.e. which address req.ip — and
// so every rate limiter's key — reports.
//
// Behind exactly one proxy that appends the client's address (Render's router),
// trusting ONE hop makes req.ip the real visitor. Trust too few and every visitor
// shares the proxy's address (one bucket for everyone); trust too many and a
// client can prepend any address it likes to X-Forwarded-For and rotate it to
// dodge the limits. The right value depends on the hosting chain, which only the
// owner can confirm in production, so it is configurable:
//
//   TRUST_PROXY unset   → today's behaviour: 1 hop in production, off elsewhere
//   TRUST_PROXY=false   → off (req.ip is the socket peer)
//   TRUST_PROXY=2       → a hop count (e.g. a CDN in front of Render)
//   TRUST_PROXY=loopback, 10.0.0.0/8 → anything else Express accepts: addresses,
//                         subnets or its named ranges, passed through as-is
//   TRUST_PROXY=true    → trust every hop. Accepted, but it lets any client spoof
//                         its address; express-rate-limit warns about it too.
const parseTrustProxy = (raw, nodeEnv) => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return nodeEnv === 'production' ? 1 : false;
  const lower = value.toLowerCase();
  if (lower === 'false') return false;
  if (lower === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

module.exports = { parseTrustProxy };
