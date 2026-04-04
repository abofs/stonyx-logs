/*
 * Fully custom system logging configuration
 * instantiate log with custom system logs
 */

import Log from '../src/index.js';

const log = new Log({
  systemLogs: {
    blue: '#007cae',
    yellow: '#ae8f00', // bright orange
    red: 'red',
  },
});

log.blue('Info: using custom method blue, sample application has started');
log.yellow('Warning: using custom method yellow, this is just a sample');
log.red('Error: using custom method red, no application logic detected', false);
