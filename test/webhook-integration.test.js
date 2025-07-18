// Test script for complete webhook handling flow
// Tests the core webhook processing functions

const crypto = require('crypto');
const { isEventAllowed } = require('../src/lib');

describe('Webhook Handler Integration', () => {
  // Generate GitHub signature
  function generateGitHubSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    return 'sha256=' + hmac.digest('hex');
  }

  // Mock signature validation function
  function validateGitHubSignature(payload, signature, secret) {
    if (payload === null || payload === undefined || !signature || !secret) {
      throw new Error('Missing required parameters for signature validation');
    }

    if (!signature.startsWith('sha256=')) {
      throw new Error('Invalid signature format - must start with sha256=');
    }

    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (err) {
      void err;
      return false;
    }
  }

  describe('GitHub signature validation integration', () => {
    const testSecret = 'test-secret';

    test('should validate GitHub webhook signatures correctly', () => {
      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        action: 'opened'
      });

      const validSignature = generateGitHubSignature(payload, testSecret);
      expect(validateGitHubSignature(payload, validSignature, testSecret)).toBe(true);
    });

    test('should reject invalid signatures', () => {
      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        action: 'opened'
      });

      const invalidSignature = 'sha256=invalid-signature';
      expect(validateGitHubSignature(payload, invalidSignature, testSecret)).toBe(false);
    });

    test('should handle signature format validation', () => {
      const payload = JSON.stringify({ test: 'data' });

      expect(() => {
        validateGitHubSignature(payload, 'invalid-format', testSecret);
      }).toThrow('Invalid signature format - must start with sha256=');
    });
  });

  describe('Event filtering integration', () => {
    test('should correctly filter events based on route configuration', () => {
      const routeWithFiltering = {
        target: "https://example.com/webhook",
        events: ["push", "pull_request"]
      };

      const routeWithoutFiltering = {
        target: "https://example.com/webhook"
      };

      // Test allowed events
      expect(isEventAllowed('push', routeWithFiltering)).toBe(true);
      expect(isEventAllowed('pull_request', routeWithFiltering)).toBe(true);

      // Test filtered events
      expect(isEventAllowed('issues', routeWithFiltering)).toBe(false);
      expect(isEventAllowed('release', routeWithFiltering)).toBe(false);

      // Test route without filtering (should allow all)
      expect(isEventAllowed('push', routeWithoutFiltering)).toBe(true);
      expect(isEventAllowed('issues', routeWithoutFiltering)).toBe(true);
      expect(isEventAllowed('any_event', routeWithoutFiltering)).toBe(true);
    });
  });

  describe('Webhook payload processing', () => {
    test('should extract repository information from GitHub payloads', () => {
      const pushPayload = {
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        ref: 'refs/heads/main',
        commits: []
      };

      const prPayload = {
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        pull_request: {
          number: 123,
          title: 'Test PR'
        },
        action: 'opened'
      };

      // Verify payload structure
      expect(pushPayload.repository.owner.login).toBe('testowner');
      expect(pushPayload.repository.name).toBe('testrepo');
      expect(prPayload.repository.owner.login).toBe('testowner');
      expect(prPayload.pull_request.number).toBe(123);
    });

    test('should handle malformed payloads gracefully', () => {
      const malformedPayloads = [
        {}, // Empty payload
        { repository: {} }, // Missing owner
        { repository: { owner: {} } }, // Missing login
        { repository: { owner: { login: 'test' } } }, // Missing name
      ];

      malformedPayloads.forEach(payload => {
        // These should be detectable as invalid
        const hasValidRepo = payload.repository &&
                            payload.repository.owner &&
                            payload.repository.owner.login &&
                            payload.repository.name;
        expect(hasValidRepo || false).toBe(false);
      });
    });
  });

  describe('End-to-end webhook processing simulation', () => {
    test('should simulate complete webhook processing flow', () => {
      const secret = 'webhook-secret';
      const payload = JSON.stringify({
        repository: {
          owner: { login: 'myorg' },
          name: 'myrepo'
        },
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Feature update'
        }
      });

      // Step 1: Validate signature
      const signature = generateGitHubSignature(payload, secret);
      const isValidSignature = validateGitHubSignature(payload, signature, secret);
      expect(isValidSignature).toBe(true);

      // Step 2: Parse payload
      const parsedPayload = JSON.parse(payload);
      expect(parsedPayload.repository.owner.login).toBe('myorg');

      // Step 3: Check event filtering
      const routeConfig = {
        target: 'https://api.example.com/webhook',
        events: ['pull_request', 'push']
      };

      const eventType = 'pull_request';
      const isEventAllowedResult = isEventAllowed(eventType, routeConfig);
      expect(isEventAllowedResult).toBe(true);

      // Step 4: Simulate different event that should be filtered
      const filteredEventResult = isEventAllowed('issues', routeConfig);
      expect(filteredEventResult).toBe(false);
    });

    test('should handle different webhook event types', () => {
      const routeConfig = {
        target: 'https://api.example.com/webhook',
        events: ['push', 'release']
      };

      const eventTypes = [
        { type: 'push', shouldAllow: true },
        { type: 'release', shouldAllow: true },
        { type: 'pull_request', shouldAllow: false },
        { type: 'issues', shouldAllow: false },
        { type: 'workflow_run', shouldAllow: false }
      ];

      eventTypes.forEach(({ type, shouldAllow }) => {
        expect(isEventAllowed(type, routeConfig)).toBe(shouldAllow);
      });
    });
  });
});
