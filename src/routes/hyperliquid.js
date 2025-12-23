const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { getWalletPnL } = require('../services/hyperliquid');

const router = express.Router();

router.get('/:wallet/pnl', [
  param('wallet').notEmpty(),
  query('start').notEmpty(),
  query('end').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { wallet } = req.params;
    const { start, end } = req.query;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return res.status(400).json({ error: 'Date range cannot exceed 90 days' });
    }

    const pnlData = await getWalletPnL(wallet, start, end);
    res.json(pnlData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

