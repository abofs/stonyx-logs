/*
 * Fully custom system logging configuration
 * instantiate log with additional logs, and advanced color setting
 */

import Log from '../src/index.js';

const log = new Log({ additionalLogs: { question: 'green' }});

// create additional log with advanced direct chalk configuration
log.defineType('query', log.chalk().black.bgGreen);

log.question('What will a fully custom chalk color function look like?');
log.query('This is what a custom chalk color setting looks like');
