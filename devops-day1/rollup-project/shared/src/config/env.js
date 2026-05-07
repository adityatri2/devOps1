const requiredEnvs = {
  shared: ['DATABASE_URL', 'REDIS_URL'],
  backend: ['PORT'],
  sequencer: ['ETH_RPC_URL', 'ETH_PRIVATE_KEY', 'ROLLUP_CONTRACT_ADDRESS'],
  daService: ['DA_PORT']
};

function validateEnv(service) {
  const missing = [];
  
  // Always check shared envs
  for (const env of requiredEnvs.shared) {
    if (!process.env[env]) missing.push(env);
  }

  // Check service-specific envs
  if (requiredEnvs[service]) {
    for (const env of requiredEnvs[service]) {
      if (!process.env[env]) missing.push(env);
    }
  }

  if (missing.length > 0) {
    console.error(`🚨 FATAL: Missing required environment variables for ${service}: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = { validateEnv };
