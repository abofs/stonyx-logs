/*
 * Default settings (Out of the box)
 * Instantiate log with default settings
 */

import Log from '../src/index.js';

const log = new Log();

log.info('Info: sample application has started');
log.warn('Warning: this is just a sample');

/*
 * The log.info and log.warn calls above are console-only, so they cannot reject. Calls that write to
 * a file do: the returned promise rejects when the write fails, that rejection is the only failure
 * signal, and leaving it unhandled terminates the process. A rejection is terminal, so disable file
 * logging on the first one rather than retrying.
 * See https://github.com/abofs/stonyx-logs#handling-write-failures
 */
async function runSample() {
  try {
    // passes true in order to log to logs/error.log file
    await log.error('Error: no application logic detected', true);

    await log.debug({
      foo: 'bar',
      x: 6,
    }, true);
  } catch (error) {
    console.error(`file logging disabled after ${error.code}`);
  }
}

runSample();
