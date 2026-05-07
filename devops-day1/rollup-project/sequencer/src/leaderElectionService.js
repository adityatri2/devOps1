const redisClient = require("@rollup/shared").redis;
const { v4: uuidv4 } = require('uuid');
const { isLeaderGauge, electionCount, failoverCount, heartbeatFailures, electionDuration } = require("@rollup/shared").metrics;

class LeaderElectionService {
  constructor() {
    // In Kubernetes, HOSTNAME environment variable defaults to the pod name (e.g., sequencer-0)
    this.nodeId = process.env.HOSTNAME || uuidv4();
    this.isLeader = false;
    this.electionInterval = null;
    this.lockKey = 'sequencer:leader_lock';
    this.lockTTL = 5; // seconds
  }

  start() {
    console.log(`📡 Starting Leader Election service on node: ${this.nodeId}`);
    // Run election heartbeat every 2 seconds
    this.electionInterval = setInterval(() => this.runElection(), 2000);
  }

  stop() {
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
    }
  }

  async runElection() {
    const endDuration = electionDuration.startTimer();
    try {
      // Attempt to acquire or renew the lock
      // NX ensures we only set it if it doesn't exist. EX sets the TTL.
      const acquired = await redisClient.set(this.lockKey, this.nodeId, {
        NX: true,
        EX: this.lockTTL
      });

      if (acquired) {
        // We successfully acquired an empty lock
        if (!this.isLeader) {
          console.log(`👑 Node [${this.nodeId}] has been elected as the active LEADER!`);
          this.isLeader = true;
          isLeaderGauge.set(1);
          electionCount.inc();
          
          // If we weren't the leader, this is a failover/new election
          failoverCount.inc();
        }
      } else {
        // The lock is already held. Are we the ones holding it?
        const currentLeader = await redisClient.get(this.lockKey);
        
        if (currentLeader === this.nodeId) {
          // We are already the leader, send a heartbeat to extend the TTL
          await redisClient.expire(this.lockKey, this.lockTTL);
          this.isLeader = true;
          isLeaderGauge.set(1);
        } else {
          // Another node is the leader
          if (this.isLeader) {
            console.log(`📉 Node [${this.nodeId}] lost leader status. Demoted to FOLLOWER.`);
            this.isLeader = false;
            isLeaderGauge.set(0);
          }
        }
      }
    } catch (error) {
      console.error(`Election error on [${this.nodeId}]:`, error.message);
      // In case of Redis partition/failure, step down to prevent split-brain
      heartbeatFailures.inc();
      this.isLeader = false;
      isLeaderGauge.set(0);
    } finally {
      endDuration();
    }
  }

  amILeader() {
    return this.isLeader;
  }
}

module.exports = new LeaderElectionService();
