const config = require('./config');
const toml = require('toml');
const request = require('request');
const fs = require('fs');
const crypto = require('crypto');

// Function to parse the repository full_name field and see if there is a matching entry in targetRoutes and return the target URL
async function getTargetUrl(owner, repo) {
  // Load routes from the routeFile and parse TOML to JSON
  const targetRoutes = toml.parse(fs.readFileSync(config.routeFile, 'utf-8'));

  console.log(`Looking for route for ${owner}/${repo}...`);

  // Find a target match based on owner/repo or fallback to owner based route
  if (targetRoutes[owner] && targetRoutes[owner][repo]) {
    let route = targetRoutes[owner][repo];
    console.log(`Routing ${owner}/${repo} to ${route['target']}`);
    return route.target;
  } else if (targetRoutes[owner]) {
    let route = targetRoutes[owner];
    console.log(`Org target match, routing ${owner}/${repo} to ${route['target']}`);
    return route.target;
  } else {
    console.log(`No route found for ${owner}/${repo}`);
  }
  return null;
}

// Function to send a POST request to the target URL with the passed payload
async function sendPayload(targetUrl, payload, debug) {
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

async function webhookHandler(req, res) {
  try {
    if (config.webhookSecret) {
      // Verify that x-hub-signature-256 header is present
      if (!req.get('x-hub-signature-256')) {
        console.log('x-hub-signature-256 header missing');
        return res.status(401).send('Unauthorized');
      }

      // Process the x-hub-signature-256 header to verify the secret
      // Hashed value should match webhookSecret
      const signature = req.get('x-hub-signature-256');
      const hmac = crypto.createHmac('sha256', config.webhookSecret);
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
      let targetUrl = await getTargetUrl(payload.repository.owner.login, payload.repository.name);
      if (targetUrl) {
        await sendPayload(targetUrl, JSON.stringify(payload), config.debug);
      }
    }

    // Process pull request webhook events
    if (payload.pull_request) {
      console.log(`${payload.repository.full_name}: Pull request event received for pull request #${payload.pull_request.number}`);
      let targetUrl = await getTargetUrl(payload.repository.owner.login, payload.repository.name);
      if (targetUrl) {
        await sendPayload(targetUrl, JSON.stringify(payload), config.debug);
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
}

module.exports = {
  webhookHandler,
};
