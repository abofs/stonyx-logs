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

log.info('Info: sample application has started');
log.warn('Warning: this is just a sample');
log.error('Error: no application logic detected');
