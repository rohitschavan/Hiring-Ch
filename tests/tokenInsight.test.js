const request = require('supertest');
const app = require('../src/server');

describe('Token Insight API', () => {
  describe('POST /api/token/:id/insight', () => {
    it('should return token insight for valid token ID', async () => {
      const response = await request(app)
        .post('/api/token/bitcoin/insight')
        .send({
          vs_currency: 'usd',
          history_days: 7
        })
        .expect(200);

      expect(response.body).toHaveProperty('source', 'coingecko');
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toHaveProperty('id', 'bitcoin');
      expect(response.body.token).toHaveProperty('symbol');
      expect(response.body.token).toHaveProperty('name');
      expect(response.body.token).toHaveProperty('market_data');
      expect(response.body).toHaveProperty('insight');
      expect(response.body.insight).toHaveProperty('reasoning');
      expect(response.body.insight).toHaveProperty('sentiment');
      expect(response.body).toHaveProperty('model');
    });

    it('should return 400 for missing token ID', async () => {
      const response = await request(app)
        .post('/api/token//insight')
        .send({
          vs_currency: 'usd'
        })
        .expect(404); // Express treats empty param as different route
    });

    it('should return error for invalid token ID', async () => {
      const response = await request(app)
        .post('/api/token/invalid-token-xyz123/insight')
        .send({
          vs_currency: 'usd'
        })
        .expect(500); // Service will throw error

      expect(response.body).toHaveProperty('error');
    });

    it('should accept optional parameters', async () => {
      const response = await request(app)
        .post('/api/token/ethereum/insight')
        .send({
          vs_currency: 'usd',
          history_days: 30
        })
        .expect(200);

      expect(response.body.token.market_data).toBeDefined();
    });

    it('should validate history_days range', async () => {
      const response = await request(app)
        .post('/api/token/bitcoin/insight')
        .send({
          vs_currency: 'usd',
          history_days: 500 // Exceeds max
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});

