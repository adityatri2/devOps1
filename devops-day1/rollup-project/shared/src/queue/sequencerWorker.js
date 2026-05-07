const SequencerService = require('../services/sequencerService');
const LeaderElectionService = require('../services/leaderElectionService');
const redisClient = require('../config/redis');
const { queueSize } = require('../utils/metrics');

class SequencerWorker {
  constructor() {
    this.intervalId = null;
  }

  start() {
    // Start distributed leader election heartbeat
    LeaderElectionService.start();

    const processInterval = parseInt(process.env.PROCESS_INTERVAL) || 5000;
    console.log(`Sequencer worker started. Processing every ${processInterval}ms.`);
    
    this.intervalId = setInterval(async () => {
      // Update the queue size metric before processing
      try {
        const size = await redisClient.lLen('tx_queue');
        queueSize.set(size);
      } catch (e) {
        console.error('Failed to update redis queue size metric', e);
      }

      // Check if we are the leader before processing the queue
      if (LeaderElectionService.amILeader()) {
        await SequencerService.processQueue();
      }
    }, processInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      LeaderElectionService.stop();
      console.log('Sequencer worker stopped.');
    }
  }
}

module.exports = new SequencerWorker();
