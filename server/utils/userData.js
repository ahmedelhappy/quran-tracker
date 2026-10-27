// Everything stored about one user, found by walking the model registry rather
// than a hand-kept list. Account deletion used to name its collections one by one
// and quietly missed Bookmark and Annotation when they were added (H-01) — a
// user's private notes and drawings outlived the account. Iterating the models
// means a future collection keyed by userId is covered the day it is created.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// A model only joins mongoose's registry once its file has been required, and a
// route that happens not to load one would make it invisible here. Loading the
// whole models/ folder up front closes that gap.
const MODELS_DIR = path.join(__dirname, '..', 'models');
for (const file of fs.readdirSync(MODELS_DIR)) {
  if (file.endsWith('.js')) require(path.join(MODELS_DIR, file));
}

// Every registered model whose schema has a top-level userId path — the
// collections that hold a user's own documents. The User model itself is keyed
// by _id, so it is never in this list.
const userKeyedModels = () => mongoose.modelNames()
  .map((name) => mongoose.model(name))
  .filter((model) => model.schema.path('userId'));

// Deletes every document that belongs to the user, then the user. The owned
// documents go first so a failure part-way leaves an account that can still sign
// in and retry, never orphans with no account behind them. Returns the number of
// documents removed per collection.
const deleteUserData = async (userId) => {
  const models = userKeyedModels();
  const results = await Promise.all(models.map((model) => model.deleteMany({ userId })));
  const deleted = {};
  models.forEach((model, i) => { deleted[model.modelName] = results[i].deletedCount; });

  const User = mongoose.model('User');
  const userResult = await User.deleteOne({ _id: userId });
  deleted.User = userResult.deletedCount;
  return deleted;
};

module.exports = { userKeyedModels, deleteUserData };
