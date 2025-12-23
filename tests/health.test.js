const request = require('supertest');
const app = require('../src/server');

describe('Health Check', () => {
  it('should return 200 and status ok', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});

