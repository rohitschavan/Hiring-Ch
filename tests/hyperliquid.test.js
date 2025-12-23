const request = require('supertest');
const app = require('../src/server');

describe('HyperLiquid PnL API', () => {
  describe('GET /api/hyperliquid/:wallet/pnl', () => {
    it('should return PnL data for valid wallet and date range', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const start = '2025-01-01';
      const end = '2025-01-03';

      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ start, end })
        .expect(200);

      expect(response.body).toHaveProperty('wallet');
      expect(response.body).toHaveProperty('start', start);
      expect(response.body).toHaveProperty('end', end);
      expect(response.body).toHaveProperty('daily');
      expect(Array.isArray(response.body.daily)).toBe(true);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('diagnostics');

      // Check daily structure
      if (response.body.daily.length > 0) {
        const day = response.body.daily[0];
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('realized_pnl_usd');
        expect(day).toHaveProperty('unrealized_pnl_usd');
        expect(day).toHaveProperty('fees_usd');
        expect(day).toHaveProperty('funding_usd');
        expect(day).toHaveProperty('net_pnl_usd');
        expect(day).toHaveProperty('equity_usd');
      }

      // Check summary structure
      expect(response.body.summary).toHaveProperty('total_realized_usd');
      expect(response.body.summary).toHaveProperty('total_unrealized_usd');
      expect(response.body.summary).toHaveProperty('total_fees_usd');
      expect(response.body.summary).toHaveProperty('total_funding_usd');
      expect(response.body.summary).toHaveProperty('net_pnl_usd');
    });

    it('should return 400 for missing start date', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ end: '2025-01-03' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for missing end date', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ start: '2025-01-01' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for invalid date format', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ start: '01-01-2025', end: '01-03-2025' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when start date is after end date', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ start: '2025-01-03', end: '2025-01-01' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for date range exceeding 90 days', async () => {
      const wallet = '0x1234567890123456789012345678901234567890';
      const response = await request(app)
        .get(`/api/hyperliquid/${wallet}/pnl`)
        .query({ start: '2025-01-01', end: '2025-04-15' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

