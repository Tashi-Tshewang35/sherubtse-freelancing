// Run in MongoDB Compass mongosh, or with:
// mongosh mongodb://127.0.0.1:27017/sherubtse_freelance_feedback database/mongodb_setup.js

// Select the intended database in Compass before running. No forced database switch.
if (!['sherubtse_freelance_feedback', 'sherubtse_freelance_test_feedback'].includes(db.getName())) {
  throw new Error('Select the application feedback database or the separate test feedback database first.');
}

if (!db.getCollectionNames().includes('ratings')) {

db.createCollection('ratings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['jobId', 'applicationId', 'employerId', 'employeeId', 'score', 'createdAt'],
      properties: {
        jobId: { bsonType: ['int', 'long', 'double'] },
        applicationId: { bsonType: ['int', 'long', 'double'] },
        employerId: { bsonType: ['int', 'long', 'double'] },
        employeeId: { bsonType: ['int', 'long', 'double'] },
        score: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 5 },
        comment: { bsonType: 'string', maxLength: 500 },
        createdAt: { bsonType: 'date' },
      },
    },
  },
});

}
// Existing collections and documents are retained. A duplicate-key error needs review.
db.ratings.createIndex({ employeeId: 1 });
db.ratings.createIndex({ applicationId: 1, employerId: 1 }, { unique: true });

print('MongoDB ratings collection is ready.');
