/*
 * Default settings (Out of the box)
 * Instantiate log with default settings
 */

import Log from '../src/index.js';

const log = new Log();

log.info('Info: sample application has started');
log.warn('Warning: this is just a sample');
log.error('Error: no application logic detected', true); // passes true in order to log to logs/error.log file
log.debug({
  foo: 'bar',
  x: 6,
}, true);
