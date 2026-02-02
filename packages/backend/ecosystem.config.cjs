module.exports = {
  apps: [
    {
      name: 'lilstar-api-testnet',
      script: 'bun run src/index.ts',
      cwd: '/root/chog/packages/backend',
      env: {
        PORT: 3001,
        NODE_ENV: 'development',

        // Signer config (update these!)
        SIGNER_PRIVATE_KEY: '0x...',
        MINT_SIGNER_PRIVATE_KEY: '0x...',

        // Admin config
        ADMIN_API_KEY: 'your-secret-admin-key',
        ADMIN_ADDRESSES: '',

        // Mint phase times (Unix timestamps, 0 = not set)
        STARLIST_START_TIME: 0,
        STARLIST_END_TIME: 0,
        FCFS_START_TIME: 0,
        FCFS_END_TIME: 0,
      },
      env_production: {
        PORT: 3001,
        NODE_ENV: 'production',

        // Production keys (update these!)
        SIGNER_PRIVATE_KEY: '0x...',
        MINT_SIGNER_PRIVATE_KEY: '0x...',
        ADMIN_API_KEY: 'your-production-admin-key',
        ADMIN_ADDRESSES: '',

        STARLIST_START_TIME: 0,
        STARLIST_END_TIME: 0,
        FCFS_START_TIME: 0,
        FCFS_END_TIME: 0,
      },

      // PM2 options
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // Logging
      error_file: '/root/chog/packages/backend/logs/error.log',
      out_file: '/root/chog/packages/backend/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
