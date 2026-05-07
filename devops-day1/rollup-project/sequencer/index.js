require('dotenv').config();
const { db, redis, metrics } = require('@rollup/shared');
const sequencerService = require('./src/sequencerService');
const leaderElectionService = require('./src/leaderElectionService');

console.log('Starting Sequencer Node...');
setInterval(() => {
  sequencerService.processQueue().catch(console.error);
}, process.env.PROCESS_INTERVAL || 5000);

setInterval(() => {
  leaderElectionService.runElection().catch(console.error);
}, 2000);
