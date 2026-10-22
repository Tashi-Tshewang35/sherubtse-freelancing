jest.mock('../../config/mongo', () => ({ connectMongo: jest.fn(), getMongoDb: jest.fn(), closeMongo: jest.fn() }));
const request = require('supertest');
const http = require('http');
test('importing app exports Express without listening or connecting MongoDB', async () => {
  // Arrange: watch the operations that must belong only to server.js.
  const listen = jest.spyOn(http.Server.prototype, 'listen');
  const { connectMongo } = require('../../config/mongo');
  // Act: import the application exactly as a route test does.
  const app = require('../../app');
  // Assert: no HTTP server or Mongo connection has started.
  expect(typeof app).toBe('function');
  expect(listen).not.toHaveBeenCalled();
  expect(connectMongo).not.toHaveBeenCalled();
  listen.mockRestore();
  const response = await request(app).get('/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok', application: 'Sherubtse Freelancing' });
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-frame-options']).toBe('DENY');
  expect(connectMongo).not.toHaveBeenCalled();
});
