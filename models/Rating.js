const db = require('../config/db');
const { getMongoDb } = require('../config/mongo');

async function createRating({ jobId, applicationId, employerId, employeeId, score, comment }) {
  const collection = getMongoDb().collection('ratings');
  await collection.insertOne({
    jobId: Number(jobId), applicationId: Number(applicationId),
    employerId: Number(employerId), employeeId: Number(employeeId),
    score: Number(score), comment: (comment || '').trim(), createdAt: new Date(),
  });
  await refreshSummary(employeeId);
}

async function refreshSummary(employeeId) {
  const collection = getMongoDb().collection('ratings');
  const rows = await collection.aggregate([
    { $match: { employeeId: Number(employeeId), hidden: { $ne: true } } },
    { $group: { _id: '$employeeId', average: { $avg: '$score' }, count: { $sum: 1 } } },
  ]).toArray();
  const summary = rows[0] || { average: 0, count: 0 };
  await db.none(
    `INSERT INTO rating_summary (student_id, average_rating, rating_count, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (student_id) DO UPDATE SET
       average_rating = EXCLUDED.average_rating,
       rating_count = EXCLUDED.rating_count,
       updated_at = NOW()`,
    [employeeId, Number(summary.average.toFixed(2)), summary.count]
  );
}

async function getEmployeeRatings(employeeId) {
  return getMongoDb().collection('ratings')
    .find({ employeeId: Number(employeeId), hidden: { $ne: true } })
    .sort({ createdAt: -1 }).toArray();
}

module.exports = { createRating, getEmployeeRatings, refreshSummary };
