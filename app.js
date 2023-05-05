// app.js
// Main entry point for the GitHub webhook dispatcher

// Create an express API server to consume GitHub webhook payload events and route them to the appropriate downstream service
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config');
const lib = require('./lib');

// App Express configuration
// Parse the request body as JSON
app.use(bodyParser.json());

// Set options for Express
app.disable('x-powered-by');
app.use(helmet());

// Create a route for the GitHub webhook
app.post('/', (req, res) => {
  lib.webhookHandler(req, res);
});

// Create a route to get a list of all the configured repositories
app.get('/routes', (req, res) => {
  lib.listRouteHandler(req, res);
});

// Create a route to serve the openapi spec
app.get('/openapi.json', (req, res) => {
  lib.openapiHandler(req, res);
});

// Create a dummy route for health checks
app.post('/health', (req, res) => {
  res.statusCode = 200;
  res.send('alive');
});
app.post('/dummy1', (req, res) => {
  res.statusCode = 200;
  res.send('dummy1');
});
app.post('/dummy2', (req, res) => {
  res.statusCode = 200;
  res.send('dummy2');
});

// Start the server
app.listen(config.port, () => console.log(`GitHub webhook dispatcher listening on port ${config.port}!`));
console.log(`Debug mode: ${config.debug}`);
