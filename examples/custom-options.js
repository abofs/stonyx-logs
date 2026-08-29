/*
 * Fully custom system logging configuration
 * instantiate log with custom options
 */

import Log from '../src/index.js';

const log = new Log({
  logToFileByDefault: true,
  logTimestamp: true,
  path: 'custom-logs', // purposely didn't include trailing "/" to test input sanitizer
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n',
});

/*
 * logToFileByDefault makes every call below a file write, so every call returns a promise that can
 * reject. The rejection is the only failure signal and is terminal, so the first one should disable
 * file logging rather than trigger another attempt.
 * See https://github.com/abofs/stonyx-logs#handling-write-failures
 */
async function runSample() {
  try {
    await log.info('Info: sample application has started');
    await log.warn('Warning: this is just a sample');
    await log.error('Error: no application logic detected');
  } catch (error) {
    console.error(`file logging disabled after ${error.code}`);
  }
}

runSample();
