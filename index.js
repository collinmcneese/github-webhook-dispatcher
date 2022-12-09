// index.js

// Create an express API server to consume GitHub webhook payload events and route them to the appropriate downstream service
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.GH_WEBHOOK_PORT || 3000;
const crypto = require('crypto');
const toml = require('toml');
const request = require('request');

const routeFile = process.env.ROUTE_FILE;

// Check if DEBUG environment variable is set
const debug = !!process.env.DEBUG;
console.log(`Debug mode: ${debug}`);

// Get the webhook secret from the environment or use a default value
const webhookSecret = process.env.WEBHOOK_SECRET;

// Parse the request body as JSON
app.use(bodyParser.json());

// Set options for Express
app.disable('x-powered-by');
app.use(helmet());

// Function to parse the repository full_name field and see if there is a matching entry in targetRoutes and return the target URL
function getTargetUrl(owner, repo) {
  // Load routes from the routeFile and parse TOML to JSON
  const targetRoutes = toml.parse(require('fs').readFileSync(routeFile, 'utf-8'));

  console.log(`Looking for route for ${owner}/${repo}...`);

  if (targetRoutes[owner] && targetRoutes[owner][repo]) {
    let route = targetRoutes[owner][repo];
    console.log(`Routing ${owner}/${repo} to ${route['target']}`);
    return route.target;
  } else {
    console.log(`No route found for ${owner}/${repo}`);
  }
  return null;
}

// Function to send a POST request to the target URL with the passed payload
function sendPayload(targetUrl, payload, debug) {
  // Set the request options
  const options = {
    url: targetUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  };

  // Send the request
  if (debug) {
    console.log(`Sending payload to ${targetUrl}`);
  } else {
    request(options, (error, response, body) => {
      if (error) {
        console.log(`Error sending payload to ${targetUrl}: ${error}`);
      } else {
        console.log(`Payload sent to ${targetUrl}`);
      }
    });
  }
}

// Create a route for the GitHub webhook
app.post('/', (req, res) => {
  try {
    if (webhookSecret) {
      // Verify that x-hub-signature-256 header is present
      if (!req.get('x-hub-signature-256')) {
        console.log('x-hub-signature-256 header missing');
        return res.status(401).send('Unauthorized');
      }

      // Process the x-hub-signature-256 header to verify the request is from GitHub
      // Hashed value should match webhookSecret
      const signature = req.get('x-hub-signature-256');
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = Buffer.from('sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex'), 'utf8');
      const checksum = Buffer.from(signature, 'utf8');

      if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
        console.log('x-hub-signature-256 mismatch');
        return res.status(401).send('Unauthorized');
      }
    }

    // Get the payload from the request body
    const payload = req.body;

    // Process commit webhook events
    if (payload.ref && payload.commits) {
      console.log(`${payload.repository.full_name}: Commit event received for ref ${payload.ref}`);
      let targetUrl = getTargetUrl(payload.repository.owner.login, payload.repository.name);
      if (targetUrl) {
        sendPayload(targetUrl, JSON.stringify(payload), debug);
      }
    }

    // Process pull request webhook events
    if (payload.pull_request) {
      console.log(`${payload.repository.full_name}: Pull request event received for pull request #${payload.pull_request.number}`);
      let targetUrl = getTargetUrl(payload.repository.owner.login, payload.repository.name);
      if (targetUrl) {
        sendPayload(targetUrl, JSON.stringify(payload), debug);
      }
    }

    // Send a response to the webhook
    res.statusCode = 200;
    res.send('OK');
  } catch (err) {
    console.log(err);
    res.statusCode = 500;
    res.send('Internal Server Error');
  }
});

// Create a dummy route for health checks
app.post('/health', (req, res) => {
  res.statusCode = 200;
  res.send('alive');
});

// Start the server
app.listen(port, () => console.log(`GitHub webhook dispatcher listening on port ${port}!`));
