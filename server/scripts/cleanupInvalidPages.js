// One-off cleanup for M-01: before page numbers were validated, UserProgress
// stored rows for pages like 0, -5, 1.5 and 99999. This finds every row whose
// pageNumber is not an integer from 1 to 604 and — only when asked — deletes it.
//
//   node scripts/cleanupInvalidPages.js --uri <mongodb-uri>           # dry run: counts only
//   node scripts/cleanupInvalidPages.js --uri <mongodb-uri> --apply   # deletes those rows
//
// The database is never taken from .env or MONGODB_URI (see scripts/lib/target.js);
// the masked host is printed before anything connects. Take a backup first.

const mongoose = require('mongoose');
const UserProgress = require('../models/UserProgress');
const { MIN_PAGE, MAX_PAGE } = require('../utils/pageNumbers');
const { parseTargetArgs } = require('./lib/target');

// Matches a row whose pageNumber is missing, not a number, out of range or not
// whole. The $cond keeps $trunc away from non-numbers (it would throw on a string).
const INVALID_PAGE_FILTER = {
  $expr: {
    $cond: [
      { $isNumber: '$pageNumber' },
      {
        $or: [
          { $lt: ['$pageNumber', MIN_PAGE] },
          { $gt: ['$pageNumber', MAX_PAGE] },
          { $ne: ['$pageNumber', { $trunc: '$pageNumber' }] },
        ],
      },
      true,
    ],
  },
};

// The count, how many users are affected, and a few sample values to eyeball.
const findInvalidPages = async () => {
  const [summary] = await UserProgress.aggregate([
    { $match: INVALID_PAGE_FILTER },
    { $group: { _id: null, count: { $sum: 1 }, users: { $addToSet: '$userId' }, samples: { $addToSet: '$pageNumber' } } },
    { $project: { _id: 0, count: 1, userCount: { $size: '$users' }, samples: { $slice: ['$samples', 10] } } },
  ]);
  return summary || { count: 0, userCount: 0, samples: [] };
};

const deleteInvalidPages = async () => (await UserProgress.deleteMany(INVALID_PAGE_FILTER)).deletedCount;

const USAGE = 'Usage: node scripts/cleanupInvalidPages.js --uri <mongodb-uri> [--apply]';

const main = async (argv, log = console.log) => {
  const args = parseTargetArgs(argv, { allowApply: true });
  if (args.help) { log(USAGE); return 0; }
  if (args.error) { log(args.error); log(USAGE); return 1; }

  log(`Target: ${args.masked}`);
  log(args.apply ? 'Mode: APPLY — invalid rows will be deleted' : 'Mode: dry run — nothing will be changed');

  await mongoose.connect(args.uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const { count, userCount, samples } = await findInvalidPages();
    log(`UserProgress rows with an invalid pageNumber: ${count} (across ${userCount} user(s))`);
    if (count) log(`  sample values: ${samples.map((s) => JSON.stringify(s)).join(', ')}`);

    if (args.apply && count > 0) {
      log(`  deleted ${await deleteInvalidPages()} row(s)`);
    } else if (count > 0) {
      log('Re-run with --apply to delete them.');
    }
    return 0;
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => { console.error('cleanupInvalidPages failed:', err.message); process.exit(1); });
}

module.exports = { INVALID_PAGE_FILTER, findInvalidPages, deleteInvalidPages, main };
