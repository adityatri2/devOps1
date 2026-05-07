const AccountModel = require('../models/accountModel');

class AccountController {
  static async getAccount(req, res, next) {
    try {
      const { address } = req.params;
      const account = await AccountModel.getAccountByAddress(address);
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      res.status(200).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AccountController;
