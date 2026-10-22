const session = require('express-session');
const { getMongoDb } = require('./mongo');

class MongoSessionStore extends session.Store {
  collection() { return getMongoDb().collection('sessions'); }

  get(id, callback) {
    this.collection().findOne({ _id: id, expiresAt: { $gt: new Date() } })
      .then(row => callback(null, row ? row.session : null), callback);
  }

  set(id, data, callback = () => {}) {
    const expiresAt = data.cookie?.expires ? new Date(data.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    this.collection().updateOne({ _id: id }, { $set: { session: data, expiresAt } }, { upsert: true })
      .then(() => callback(null), callback);
  }

  touch(id, data, callback = () => {}) {
    const expiresAt = data.cookie?.expires ? new Date(data.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    this.collection().updateOne({ _id: id }, { $set: { expiresAt } })
      .then(() => callback(null), callback);
  }

  destroy(id, callback = () => {}) {
    this.collection().deleteOne({ _id: id }).then(() => callback(null), callback);
  }
}
module.exports = MongoSessionStore;
