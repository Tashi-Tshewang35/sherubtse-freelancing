// Run in MongoDB Compass mongosh, or with:
// mongosh mongodb://127.0.0.1:27017 database/mongodb_setup.js

db = db.getSiblingDB('sherubtse_freelance_feedback');

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

db.ratings.createIndex({ employeeId: 1 });
db.ratings.createIndex({ applicationId: 1, employerId: 1 }, { unique: true });

print('MongoDB ratings collection is ready.');
