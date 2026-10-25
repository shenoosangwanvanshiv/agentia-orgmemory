#!/usr/bin/env node
// Local runner so you can test the plugin without linking it into the Agentia CLI:
//   ./bin/run.js orgmemory doctor
require('@oclif/core').execute({ dir: __dirname + '/..' });
