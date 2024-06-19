// app.js
// Main entry point for the GitHub webhook dispatcher

// Create an express API server to consume GitHub webhook payload events and route them to the appropriate downstream service
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const app = express();
const config = require('./config');
const lib = require('./lib');
const RateLimit = require('express-rate-limit');
const console = require('console');

// Configure rate limiter
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
});

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

// Create a route to get a list of all the configured routes
app.get('/routes', (req, res) => {
  lib.listRouteHandler(req, res);
});

// Create a route to serve the openapi spec
// Apply rate limiting to this route
app.use('/openapi.json', limiter);
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
