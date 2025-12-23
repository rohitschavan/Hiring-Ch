const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getTokenData } = require('../services/coingecko');
const { generateInsight } = require('../services/ai');

const router = express.Router();

router.post('/:id/insight', [
  param('id').notEmpty(),
  body('vs_currency').optional().isString(),
  body('history_days').optional().isInt({ min: 1, max: 365 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { vs_currency = 'usd', history_days = null } = req.body;

    const tokenData = await getTokenData(id, vs_currency, history_days);
    const insight = await generateInsight(tokenData);

    res.json({
      source: 'coingecko',
      token: {
        id: tokenData.id,
        symbol: tokenData.symbol,
        name: tokenData.name,
        market_data: tokenData.market_data
      },
      insight: {
        reasoning: insight.reasoning,
        sentiment: insight.sentiment
      },
      model: {
        provider: insight.provider || 'mock',
        model: insight.model || 'mock'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

