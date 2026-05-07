const client = require('prom-client');

// Initialize the default registry
const register = new client.Registry();

// Add default metrics (CPU, Memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const txTotal = new client.Counter({
  name: 'rollup_transactions_total',
  help: 'Total number of transactions received'
});

const txFailed = new client.Counter({
  name: 'rollup_transactions_failed_total',
  help: 'Total number of failed transactions'
});

const blocksCreated = new client.Counter({
  name: 'rollup_blocks_created_total',
  help: 'Total number of blocks created by the sequencer'
});

const ethSuccess = new client.Counter({
  name: 'ethereum_submission_success_total',
  help: 'Total number of successful block submissions to Layer 1'
});

const ethFailed = new client.Counter({
  name: 'ethereum_submission_failed_total',
  help: 'Total number of failed block submissions to Layer 1'
});

const queueSize = new client.Gauge({
  name: 'redis_queue_size',
  help: 'Current number of transactions in the Redis queue'
});

const apiDuration = new client.Histogram({
  name: 'api_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000] // bins for latency
});

// Register custom metrics
const isLeaderGauge = new client.Gauge({
  name: 'sequencer_is_leader',
  help: '1 if this node is the active sequencer leader, 0 otherwise'
});

const electionCount = new client.Counter({
  name: 'sequencer_elections_total',
  help: 'Total number of times this node participated in an election and won'
});

const failoverCount = new client.Counter({
  name: 'sequencer_failovers_total',
  help: 'Total number of times a failover occurred and this node took over'
});

const heartbeatFailures = new client.Counter({
  name: 'sequencer_heartbeat_failures_total',
  help: 'Total number of failed heartbeats to Redis during leader election'
});

const electionDuration = new client.Histogram({
  name: 'sequencer_election_duration_ms',
  help: 'Time taken to run the leader election check in ms',
  buckets: [5, 10, 25, 50, 100, 250, 500]
});

const daUploadLatency = new client.Histogram({
  name: 'da_upload_latency_ms',
  help: 'Latency of publishing compressed batches to the DA layer',
  buckets: [10, 50, 100, 250, 500, 1000]
});

const daCompressionRatio = new client.Gauge({
  name: 'da_compression_ratio',
  help: 'Ratio of uncompressed size to compressed size of DA batches'
});

const daRetrievalFailures = new client.Counter({
  name: 'da_retrieval_failures_total',
  help: 'Number of failed attempts to retrieve data from the DA layer'
});

const activeStake = new client.Gauge({
  name: 'sequencer_active_stake_eth',
  help: 'Amount of ETH currently staked by this sequencer'
});

const slashingCount = new client.Counter({
  name: 'sequencer_slashing_total',
  help: 'Number of times this sequencer has been slashed'
});

const validatorHealth = new client.Gauge({
  name: 'sequencer_validator_health',
  help: '1 if sequencer is staked and active, 0 otherwise'
});

register.registerMetric(txTotal);
register.registerMetric(txFailed);
register.registerMetric(blocksCreated);
register.registerMetric(ethSuccess);
register.registerMetric(ethFailed);
register.registerMetric(queueSize);
register.registerMetric(apiDuration);

module.exports = {
  register,
  txTotal,
  txFailed,
  blocksCreated,
  ethSuccess,
  ethFailed,
  queueSize,
  apiDuration,
  isLeaderGauge,
  electionCount,
  failoverCount,
  heartbeatFailures,
  electionDuration,
  daUploadLatency,
  daCompressionRatio,
  daRetrievalFailures,
  activeStake,
  slashingCount,
  validatorHealth
};
