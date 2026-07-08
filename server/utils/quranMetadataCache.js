const QuranMetadata = require('../models/QuranMetadata');

// QuranMetadata is a static 604-row lookup table that only ever changes via a
// reseed + server restart. Rather than query Mongo on every task computation, we
// load it once per process into an in-memory Map (pageNumber → lean record) on
// first use and serve every read from there.
let cache = null;   // Map<number, metadata> once loaded
let loading = null; // in-flight load promise, shared by concurrent first callers

// Loads (once) and returns the pageNumber→metadata Map. Concurrent first callers
// share the same in-flight promise so we never issue duplicate initial queries.
const getCache = async () => {
  if (cache) return cache;
  if (!loading) {
    loading = QuranMetadata.find({})
      .lean()
      .then((records) => {
        cache = new Map(records.map((r) => [r.pageNumber, r]));
        loading = null;
        return cache;
      })
      .catch((err) => {
        loading = null; // let the next call retry instead of caching the failure
        throw err;
      });
  }
  return loading;
};

// Returns a plain object { [pageNumber]: metadata } for the requested pages,
// served from the in-memory cache. Same shape the old getMetadataMap returned.
const getMetadataForPages = async (pageNumbers) => {
  if (!pageNumbers.length) return {};
  const map = await getCache();
  const out = {};
  for (const pg of pageNumbers) {
    const rec = map.get(pg);
    if (rec) out[pg] = rec;
  }
  return out;
};

// Test hook: drop the cache so the next read reloads from the (freshly seeded)
// database. The integration suite wipes and reseeds the in-memory Mongo between
// tests, so it calls this to keep the cache aligned with each test's data.
const resetMetadataCache = () => {
  cache = null;
  loading = null;
};

module.exports = { getMetadataForPages, resetMetadataCache };
