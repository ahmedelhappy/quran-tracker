// One-off cleanup for H-01: before account deletion covered every collection,
// deleted users left Bookmark and Annotation documents behind. This finds every
// document in a user-keyed collection whose userId no longer has a User, and —
// only when asked twice over — deletes them.
//
//   node scripts/cleanupOrphans.js --uri <mongodb-uri>           # dry run: counts only
//   node scripts/cleanupOrphans.js --uri <mongodb-uri> --apply   # deletes the orphans
//
// The database is never taken from .env or MONGODB_URI (see scripts/lib/target.js);
// the masked host is printed before anything connects. Take a backup first.

const mongoose = require('mongoose');
const { userKeyedModels } = require('../utils/userData');
const { parseTargetArgs } = require('./lib/target');

// Per user-keyed collection: the userIds that have no User behind them and how
// many documents they hold. Documents with no userId at all are orphans too.
const findOrphans = async () => {
  const User = mongoose.model('User');
  const report = [];
  for (const model of userKeyedModels()) {
    const ownerIds = (await model.distinct('userId')).filter((id) => id != null);
    const existing = await User.find({ _id: { $in: ownerIds } }, { _id: 1 }).lean();
    const alive = new Set(existing.map((u) => String(u._id)));
    const orphanUserIds = ownerIds.filter((id) => !alive.has(String(id)));
    const filter = { $or: [{ userId: { $in: orphanUserIds } }, { userId: null }] };
    const count = await model.countDocuments(filter);
    report.push({ model: model.modelName, orphanUserIds, count, filter });
  }
  return report;
};

// Deletes exactly what findOrphans reported, collection by collection.
const deleteOrphans = async (report) => {
  const deleted = {};
  for (const { model, filter, count } of report) {
    if (!count) { deleted[model] = 0; continue; }
    const res = await mongoose.model(model).deleteMany(filter);
    deleted[model] = res.deletedCount;
  }
  return deleted;
};

const USAGE = 'Usage: node scripts/cleanupOrphans.js --uri <mongodb-uri> [--apply]';

const main = async (argv, log = console.log) => {
  const args = parseTargetArgs(argv, { allowApply: true });
  if (args.help) { log(USAGE); return 0; }
  if (args.error) { log(args.error); log(USAGE); return 1; }

  log(`Target: ${args.masked}`);
  log(args.apply ? 'Mode: APPLY — orphaned documents will be deleted' : 'Mode: dry run — nothing will be changed');

  await mongoose.connect(args.uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const report = await findOrphans();
    for (const r of report) log(`  ${r.model}: ${r.count} orphaned document(s) from ${r.orphanUserIds.length} missing user(s)`);
    const total = report.reduce((n, r) => n + r.count, 0);
    log(`Total orphaned documents: ${total}`);

    if (args.apply && total > 0) {
      const deleted = await deleteOrphans(report);
      for (const [model, n] of Object.entries(deleted)) log(`  deleted ${n} from ${model}`);
    } else if (total > 0) {
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
    .catch((err) => { console.error('cleanupOrphans failed:', err.message); process.exit(1); });
}

module.exports = { findOrphans, deleteOrphans, main };
