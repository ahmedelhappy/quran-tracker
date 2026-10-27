// The safety contract every maintenance script and seed shares: the database is
// named on the command line, never picked up from .env or MONGODB_URI. A local
// .env here points at production, and a script that silently connects to it is
// one typo away from rewriting real users' data (L-13). So:
//   - --uri <uri> (or --uri=<uri>) is required, even for a dry run;
//   - the host is printed, credentials masked, before anything connects;
//   - writes need a second, separate flag (--apply) on scripts that support it.

const SCHEME = /^(mongodb(?:\+srv)?:\/\/)(.+)$/;
const HOSTS_AND_PATH = /^([^/?#]+)(\/[^?#]*)?/;
// One host of a seed list: a name or address, or a bracketed IPv6 address, and
// an optional numeric port. Anything else in the host part (a "user:pass" with
// no '@', say) is not printed.
const HOST = /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._%-]+)(?::\d+)?$/;

// "mongodb+srv://user:pass@cluster0.x.mongodb.net/app?retryWrites=true" →
// "mongodb+srv://cluster0.x.mongodb.net/app". Credentials and query options are
// dropped; null when the string is not a MongoDB URI whose hosts can be shown
// safely. The credentials end at the LAST '@': a password typed with a raw '@'
// or '/' in it ("user:p@ss@host") used to leave part of itself in the output.
// Nothing before the last '@' is ever printed, so whatever the password holds
// cannot reach the console.
const maskUri = (uri) => {
  const m = typeof uri === 'string' ? uri.match(SCHEME) : null;
  if (!m) return null;
  const afterCredentials = m[2].slice(m[2].lastIndexOf('@') + 1);
  const hp = afterCredentials.match(HOSTS_AND_PATH);
  if (!hp || !hp[1].split(',').every((h) => HOST.test(h))) return null;
  return `${m[1]}${hp[1]}${hp[2] && hp[2] !== '/' ? hp[2] : ''}`;
};

// The database a masked URI names, or null when it names none: the driver then
// quietly connects to "test", which for a cleanup script is the wrong database.
const databaseOf = (masked) => {
  const m = typeof masked === 'string' ? masked.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?#]+)/) : null;
  return m ? m[1] : null;
};

// Parses the flags these scripts accept. Reads argv only — process.env is never
// consulted, so an exported MONGODB_URI cannot stand in for --uri.
const parseTargetArgs = (argv, { allowApply = false } = {}) => {
  let uri = null;
  let apply = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--uri') { uri = argv[i + 1] ?? null; i++; }
    else if (arg.startsWith('--uri=')) uri = arg.slice('--uri='.length);
    else if (arg === '--apply' && allowApply) apply = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else return { error: `Unknown argument: ${arg}` };
  }
  if (help) return { help: true };
  if (!uri) return { error: 'Refusing to run without an explicit --uri <mongodb-uri> (MONGODB_URI and .env are never read).' };
  const masked = maskUri(uri);
  // The URI itself is never echoed back: it may be exactly the string that
  // could not be masked.
  if (!masked) return { error: '--uri must be a mongodb:// or mongodb+srv:// connection string (percent-encode any @ / : ? # in the password).' };
  return { uri, masked, apply };
};

module.exports = { maskUri, databaseOf, parseTargetArgs };
