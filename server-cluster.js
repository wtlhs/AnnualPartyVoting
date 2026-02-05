const cluster = require('cluster');
const os = require('os');

// Configuration
const WORKERS = process.env.CLUSTER_WORKERS
  ? parseInt(process.env.CLUSTER_WORKERS, 10)
  : os.cpus().length; // Default to number of CPU cores

// Configuration for graceful shutdown
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

/**
 * Fork a new worker
 */
function forkWorker(workerId) {
  const worker = cluster.fork({
    WORKER_ID: workerId
  });

  console.log(`[Cluster] Worker ${worker.process.pid} started (ID: ${workerId})`);

  worker.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[Cluster] Worker ${worker.process.pid} was killed by signal: ${signal}`);
    } else if (code !== 0) {
      console.log(`[Cluster] Worker ${worker.process.pid} exited with error code: ${code}`);
    } else {
      console.log(`[Cluster] Worker ${worker.process.pid} exited successfully`);
    }

    // If the master is still running, fork a new worker
    if (!cluster.isShuttingDown) {
      console.log(`[Cluster] Restarting worker...`);
      forkWorker(workerId);
    }
  });

  worker.on('error', (err) => {
    console.error(`[Cluster] Worker ${worker.process.pid} error:`, err);
  });

  return worker;
}

/**
 * Gracefully shutdown all workers
 */
async function shutdownWorkers() {
  cluster.isShuttingDown = true;

  console.log(`\n[Cluster] Shutting down ${Object.keys(cluster.workers).length} workers...`);

  const workers = Object.values(cluster.workers);
  const shutdownPromises = [];

  for (const worker of workers) {
    shutdownPromises.push(
      new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`[Cluster] Worker ${worker.process.pid} shutdown timeout, killing...`);
          worker.kill('SIGKILL');
          resolve();
        }, SHUTDOWN_TIMEOUT);

        worker.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Send shutdown signal
        worker.send('shutdown');

        // Give it a moment, then force disconnect if needed
        setTimeout(() => {
          if (worker.isConnected()) {
            worker.disconnect();
          }
        }, 100);
      })
    );
  }

  await Promise.all(shutdownPromises);
  console.log('[Cluster] All workers shut down');
}

/**
 * Start the cluster master
 */
function startMaster() {
  console.log(`[Cluster] Master ${process.pid} is running`);
  console.log(`[Cluster] Starting ${WORKERS} workers...`);
  console.log(`[Cluster] CPU cores: ${os.cpus().length}`);
  console.log('');

  // Fork workers
  const workers = [];
  for (let i = 0; i < WORKERS; i++) {
    workers.push(forkWorker(i));
  }

  // Handle cluster events
  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });

  cluster.on('listening', (worker, address) => {
    console.log(`[Cluster] Worker ${worker.process.pid} listening on ${address.port}`);
  });

  cluster.on('disconnect', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} disconnected`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Cluster] SIGTERM received');
    shutdownWorkers().then(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('[Cluster] SIGINT received');
    shutdownWorkers().then(() => process.exit(0));
  });

  // Log cluster status every 60 seconds
  setInterval(() => {
    const workerCount = Object.keys(cluster.workers).length;
    console.log(`[Cluster] Status: ${workerCount}/${WORKERS} workers active`);
  }, 60000);
}

/**
 * Start a worker process
 */
function startWorker() {
  // Import and start the actual server
  require('./server-worker.js');
}

// Main entry point
if (cluster.isPrimary || cluster.isMaster) {
  // Master process
  startMaster();
} else {
  // Worker process
  startWorker();
}

module.exports = { cluster, startMaster, shutdownWorkers };
