const mongoose = require('mongoose');

// A graceful stop for the HTTP server and its database connection (M-21).
//
// Render sends SIGTERM on every deploy and restart, and the old instance used
// to die on the spot: a write that was half-way through its database calls
// (a page marked memorized, a drawing being saved) was cut off there. Now the
// signal stops new connections, lets the requests already in flight finish,
// and only then closes the MongoDB connection and exits 0.
//
// A request that never finishes must not hold the deploy up for ever, so after
// `timeoutMs` every remaining connection is cut and the process exits 1 (the
// platform kills it soon after anyway; this way it says why). Render waits 30 s
// by default before a SIGKILL, so 10 s leaves room.
//
// Everything the process does is passed in (exit, the disconnect, the logger),
// so a test can drive a real server and database through it without the
// process actually exiting.
const DEFAULT_TIMEOUT_MS = 10_000;

// The two steps of a stop, named in every error log line so a failed deploy
// says which one went wrong: waiting for the requests in flight, or closing
// the database once they have.
const STEPS = {
  draining: 'finishing in-flight requests',
  disconnecting: 'closing the database',
};

const createShutdown = ({
  server,
  disconnect = () => mongoose.disconnect(),
  exit = (code) => process.exit(code),
  log = console,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  let pending = null;

  return (signal = 'shutdown') => {
    // A second signal (Ctrl+C pressed twice) joins the stop already under way.
    if (pending) return pending;
    log.log(`${signal} received: finishing in-flight requests, then closing the database`);

    pending = new Promise((resolve) => {
      let step = 'draining';
      let finished = false;
      const finish = (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        exit(code);
        resolve(code);
      };

      const timer = setTimeout(() => {
        log.error(`Shutdown took longer than ${timeoutMs} ms while ${STEPS[step]}: cutting the remaining connections`);
        server.closeAllConnections?.();
        finish(1);
      }, timeoutMs);
      // The timer alone must never keep a process alive that is otherwise done.
      timer.unref?.();

      // close() stops accepting connections at once and calls back when the last
      // one has ended; idle keep-alive sockets are closed straight away (Node 19+),
      // and one serving a request is closed as soon as its response is sent.
      server.close(async (closeErr) => {
        // Cut off by the timeout: the process is already on its way out.
        if (finished) return;
        try {
          if (closeErr && closeErr.code !== 'ERR_SERVER_NOT_RUNNING') throw closeErr;
          step = 'disconnecting';
          await disconnect();
          log.log('HTTP server and database closed');
          finish(0);
        } catch (err) {
          // The whole error, stack included: this is the last thing the process says.
          log.error(`Shutdown failed while ${STEPS[step]}:`, err);
          finish(1);
        }
      });
      server.closeIdleConnections?.();
    });
    return pending;
  };
};

// Wire SIGTERM (the platform) and SIGINT (Ctrl+C) to a graceful stop.
// Returns the shutdown function and a way to remove the listeners again.
const handleShutdownSignals = (options) => {
  const shutdown = createShutdown(options);
  const handlers = {
    SIGTERM: () => shutdown('SIGTERM'),
    SIGINT: () => shutdown('SIGINT'),
  };
  for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
  const remove = () => {
    for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler);
  };
  return { shutdown, remove };
};

module.exports = { createShutdown, handleShutdownSignals, DEFAULT_TIMEOUT_MS };
