// The safety contract every maintenance script and seed shares: the database is
// named on the command line, never picked up from .env or MONGODB_URI. A local
// .env here points at production, and a script that silently connects to it is
// one typo away from rewriting real users' data (L-13). So:
//   - --uri <uri> (or --uri=<uri>) is required, even for a dry run;
//   - the host is printed, credentials masked, before anything connects;
//   - writes need a second, separate flag (--apply) on scripts that support it.

const MONGO_URI = /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]*@)?([^/?#]+)(\/[^?#]*)?/;

// "mongodb+srv://user:pass@cluster0.x.mongodb.net/app?retryWrites=true" →
// "mongodb+srv://cluster0.x.mongodb.net/app". Credentials and query options are
// dropped; null when the string is not a MongoDB URI at all.
const maskUri = (uri) => {
  const m = typeof uri === 'string' ? uri.match(MONGO_URI) : null;
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3] && m[3] !== '/' ? m[3] : ''}`;
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
  if (!masked) return { error: '--uri must be a mongodb:// or mongodb+srv:// connection string.' };
  return { uri, masked, apply };
};

module.exports = { maskUri, parseTargetArgs };
