// Read environment variables from .env file
require('dotenv').config();

// Get the route file from the environment
// This file should be present or else the app will not start
if (!process.env.WHDISPATCHER_ROUTE_FILE) {
  throw new Error('WHDISPATCHER_ROUTE_FILE environment variable not set');
}

// Get the route file from the environment
const routeFile = process.env.WHDISPATCHER_ROUTE_FILE;

// Check if DEBUG environment variable is set
const debug = !!process.env.WHDISPATCHER_DEBUG;

// Set the local port to listen on for the app
const port = process.env.WHDISPATCHER_PORT || 3000;

// Get the webhook secret from the environment or use a default value
const webhookSecret = process.env.WHDISPATCHER_WEBHOOK_SECRET;

module.exports = {
  debug,
  port,
  routeFile,
  webhookSecret,
};
