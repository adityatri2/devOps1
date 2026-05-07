const express = require('express');
const TxController = require('../controllers/txController');
const BlockController = require('../controllers/blockController');
const AccountController = require('../controllers/accountController');

const router = express.Router();

router.post('/tx', TxController.createTransaction);
router.get('/tx/:id', TxController.getTransaction);
router.get('/blocks', BlockController.getBlocks);
router.post('/block/:id/challenge', BlockController.challengeBlock);
router.post('/block/:id/finalize', BlockController.finalizeBlock);
router.get('/block/:id/proof/:txId', BlockController.getProof);
router.get('/proof/:txId', BlockController.getProofByTxId);
router.get('/account/:address', AccountController.getAccount);

module.exports = router;
