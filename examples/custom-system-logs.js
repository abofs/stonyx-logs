/*
 * Fully custom system logging configuration
 * instantiate chronicle with custom system logs
 */

import Chronicle from '../src/index.js';

const chronicle = new Chronicle({
  systemLogs: {
    blue: '#007cae',
    yellow: '#ae8f00', // bright orange
    red: 'red',
  },
});

chronicle.blue('Info: using custom method blue, sample application has started');
chronicle.yellow('Warning: using custom method yellow, this is just a sample');
chronicle.red('Error: using custom method red, no application logic detected', false);
