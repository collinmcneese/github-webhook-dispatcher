const config = require('./config');
const toml = require('toml');
const yaml = require('js-yaml');
const fs = require('fs');
const crypto = require('crypto');
const console = require('console');

/**
 * Checks if an event type is allowed for a given route configuration
 * @param {string} eventType - The GitHub webhook event type from X-GitHub-Event header
 * @param {object} routeConfig - The route configuration object
 * @returns {boolean} True if the event should be forwarded, false otherwise
 */
function isEventAllowed(eventType, routeConfig) {
  // If no events filter is specified, allow all events (backward compatibility)
  if (!routeConfig.events || !Array.isArray(routeConfig.events)) {
    return true;
  }

  // Check if the event type is in the allowed events list
  return routeConfig.events.includes(eventType);
}

// Function to process provided route file
// Allowed formats are TOML, JSON, YAML
async function processRouteFile(routeFile) {
  // Determine the file content type
  // Allowed formats are TOML, JSON, YAML
  // If the content is not one of these formats, throw an error
  let routeFileContent = fs.readFileSync(routeFile, 'utf-8');

  const routeFileContentType = routeFile.split('.').pop().toLowerCase();

  if (routeFileContentType === 'toml') {
    routeFileContent = toml.parse(routeFileContent);
  } else if (routeFileContentType === 'json') {
    routeFileContent = JSON.parse(routeFileContent);
  } else if (routeFileContentType === 'yaml' || routeFileContentType === 'yml') {
    routeFileContent = yaml.safeLoad(routeFileContent);
  } else {
    throw new Error(`Route file ${routeFile} is not in TOML, JSON, or YAML format`);
  }

  return routeFileContent;
}

// Function to parse the repository full_name field and see if there is a matching entry in targetRoutes and return the target URL
async function getTargetUrl(owner, repo) {
  const targetRoutes = await processRouteFile(config.routeFile);

  console.log(`Looking for route for ${owner}/${repo}...`);

  // Find a target match based on owner/repo or fallback to owner based route
  if (targetRoutes[owner] && targetRoutes[owner][repo]) {
    const route = targetRoutes[owner][repo];
    console.log(`Routing ${owner}/${repo} to ${route['target']}`);
    return route;
  } else if (targetRoutes[owner]) {
    const route = targetRoutes[owner];
    console.log(`Org target match, routing ${owner}/${repo} to ${route['target']}`);
    return route;
  } else {
    console.log(`No route found for ${owner}/${repo}`);
  }
  return null;
}

// Function to output a listing of all routes in the routeFile
async function listRoutes() {
  const targetRoutes = await processRouteFile(config.routeFile);
  // process the targetRoutes object and output a list of all routes
  // Object structure is{owner: {target: 'url', repo: {target: 'url'}}}
  const routes = [];

  // Loop through the targetRoutes object and build the routes array
  // If the owner has a target, add it to the routes array
  // If the owner has repos, loop through them and add their targets to the routes array
  // Adds an object in format {owner: {target: 'url'}}
  for (const owner in targetRoutes) {
    if (targetRoutes[owner].target) {
      routes.push({
        owner: owner,
        target: targetRoutes[owner].target,
      });
    }
    // If the owner has other keys, loop through them and add their targets to the routes array
    // Adds an object in format {owner: {repo: {target: 'url'}}}
    if (Object.keys(targetRoutes[owner]).length > 1) {
      for (const repo in targetRoutes[owner]) {
        if (repo !== 'target') {
          routes.push({
            owner: owner,
            repo: repo,
            target: targetRoutes[owner][repo].target,
          });
        }
      }
    }
  }

  return routes;
}

async function listRouteHandler(req, res) {
  try {
    const routes = await listRoutes();

    if (req.query.format === 'json') {
      const response = JSON.stringify(routes);
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(response);
    } else {
      res.setHeader('Content-Type', 'text/plain');

      // Map the routes array to a string with one route per line
      const response = routes.map(route => {
        if (route.repo) {
          return `${route.owner}/${route.repo} -> ${route.target}`;
        } else {
          return `${route.owner} -> ${route.target}`;
        }
      }).join('\n');

      res.status(200).send(response);
    }

  } catch (error) {
    console.log(`Error listing routes: ${error}`);
    res.status(500).send(`Error listing routes: ${error}`);
  }
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

  // Send the request to the target
  fetch(targetUrl, options)
    .then(res => {
      if (debug) {
        console.log(`Response status: ${res.status}`);
        console.log(`Response body: ${res.body}`);
      }
    });

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

    // Get the event type from the X-GitHub-Event header
    const eventType = req.get('x-github-event');

    if (!eventType) {
      console.log('x-github-event header missing');
      return res.status(400).send('Bad Request: Missing event type');
    }

    // Ensure we have repository information
    if (!payload.repository || !payload.repository.owner || !payload.repository.name) {
      console.log('Missing repository information in payload');
      return res.status(400).send('Bad Request: Missing repository information');
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    console.log(`${owner}/${repo}: ${eventType} event received`);

    // Get the route configuration for this repository
    const routeConfig = await getTargetUrl(owner, repo);

    if (!routeConfig) {
      console.log(`No route found for ${owner}/${repo}, skipping event`);
      return res.status(200).send('OK');
    }

    // Check if this event type is allowed for this route
    if (!isEventAllowed(eventType, routeConfig)) {
      console.log(`Event type '${eventType}' is not allowed for ${owner}/${repo}, filtering out`);
      return res.status(200).send('OK');
    }

    console.log(`Forwarding ${eventType} event for ${owner}/${repo} to ${routeConfig.target}`);

    // Forward the webhook payload
    await sendPayload(routeConfig.target, JSON.stringify(payload), config.debug);

    // Send a response to the webhook
    res.statusCode = 200;
    res.send('OK');
  } catch (err) {
    console.log(err);
    res.statusCode = 500;
    res.send('Internal Server Error');
  }
}

// Handler to generate a JSON OpenAPI spec for the application
// Process the included openapi.yaml file and return it as JSON
async function openapiHandler(req, res) {
  try {
    // Read the openapi.yaml file
    const openapiFile = fs.readFileSync('./openapi.yaml', 'utf8');

    // Parse the YAML file
    const openapiSpec = yaml.load(openapiFile);

    // Send the spec as JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(openapiSpec));
  } catch (error) {
    console.log(`Error generating OpenAPI spec: ${error}`);
    res.status(500).send(`Error generating OpenAPI spec: ${error}`);
  }
}

module.exports = {
  isEventAllowed,
  listRouteHandler,
  openapiHandler,
  webhookHandler,
};
