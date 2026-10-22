const db = require('../config/db');
exports.list = userId => db.any('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId]);
exports.read = (userId, id) => db.none('UPDATE notifications SET is_read=true WHERE user_id=$1 AND ($2::int IS NULL OR id=$2)', [userId, id || null]);
exports.add = (userId, category, message, href = '/dashboard') => db.none('INSERT INTO notifications(user_id,category,message,href) VALUES($1,$2,$3,$4)', [userId, category, message, href]);
