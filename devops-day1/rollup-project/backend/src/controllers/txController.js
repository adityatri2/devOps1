const TxService = require('../services/txService');
const { txTotal, txFailed } = require("@rollup/shared").metrics;

class TxController {
  static async createTransaction(req, res, next) {
    try {
      const { from, to, amount } = req.body;
      const transaction = await TxService.processNewTransaction({ from, to, amount });
      
      txTotal.inc(); // Increment successful transactions

      res.status(201).json({
        success: true,
        message: 'Transaction successfully created and queued',
        data: transaction,
      });
    } catch (error) {
      txFailed.inc(); // Increment failed transactions
      next(error);
    }
  }

  static async getTransaction(req, res, next) {
    try {
      const { id } = req.params;
      const transaction = await TxService.getTransaction(id);
      
      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TxController;
