// Test script to demonstrate event filtering functionality
// This simulates webhook requests with different event types

const { isEventAllowed } = require('../src/lib');

describe('Event Filtering', () => {
  // Example route configurations
  const routeConfigs = {
    // Route with event filtering
    filtered: {
      target: "https://example.com/webhook",
      events: ["push", "pull_request", "issues"]
    },

    // Route without event filtering (allows all)
    unfiltered: {
      target: "https://example.com/webhook"
    },

    // Route with specific events only
    specific: {
      target: "https://example.com/webhook",
      events: ["release", "star"]
    }
  };

  // Test cases
  const testCases = [
    { eventType: 'push', description: 'Push event' },
    { eventType: 'pull_request', description: 'Pull request event' },
    { eventType: 'issues', description: 'Issues event' },
    { eventType: 'release', description: 'Release event' },
    { eventType: 'star', description: 'Star event' },
    { eventType: 'fork', description: 'Fork event' },
    { eventType: 'workflow_run', description: 'Workflow run event' }
  ];

  describe('Route with event filtering (push, pull_request, issues)', () => {
    const config = routeConfigs.filtered;

    test('should allow push events', () => {
      expect(isEventAllowed('push', config)).toBe(true);
    });

    test('should allow pull_request events', () => {
      expect(isEventAllowed('pull_request', config)).toBe(true);
    });

    test('should allow issues events', () => {
      expect(isEventAllowed('issues', config)).toBe(true);
    });

    test('should reject release events', () => {
      expect(isEventAllowed('release', config)).toBe(false);
    });

    test('should reject star events', () => {
      expect(isEventAllowed('star', config)).toBe(false);
    });

    test('should reject fork events', () => {
      expect(isEventAllowed('fork', config)).toBe(false);
    });

    test('should reject workflow_run events', () => {
      expect(isEventAllowed('workflow_run', config)).toBe(false);
    });
  });

  describe('Route without event filtering (allows all)', () => {
    const config = routeConfigs.unfiltered;

    testCases.forEach(({ eventType, description }) => {
      test(`should allow ${description}`, () => {
        expect(isEventAllowed(eventType, config)).toBe(true);
      });
    });
  });

  describe('Route with specific events only (release, star)', () => {
    const config = routeConfigs.specific;

    test('should reject push events', () => {
      expect(isEventAllowed('push', config)).toBe(false);
    });

    test('should reject pull_request events', () => {
      expect(isEventAllowed('pull_request', config)).toBe(false);
    });

    test('should reject issues events', () => {
      expect(isEventAllowed('issues', config)).toBe(false);
    });

    test('should allow release events', () => {
      expect(isEventAllowed('release', config)).toBe(true);
    });

    test('should allow star events', () => {
      expect(isEventAllowed('star', config)).toBe(true);
    });

    test('should reject fork events', () => {
      expect(isEventAllowed('fork', config)).toBe(false);
    });

    test('should reject workflow_run events', () => {
      expect(isEventAllowed('workflow_run', config)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty events array', () => {
      const config = { target: "https://example.com/webhook", events: [] };
      expect(isEventAllowed('push', config)).toBe(false);
    });

    test('should handle missing events property as allow all', () => {
      const config = { target: "https://example.com/webhook" };
      expect(isEventAllowed('push', config)).toBe(true);
      expect(isEventAllowed('pull_request', config)).toBe(true);
      expect(isEventAllowed('any_event', config)).toBe(true);
    });

    test('should handle case sensitivity', () => {
      const config = { target: "https://example.com/webhook", events: ["push"] };
      expect(isEventAllowed('push', config)).toBe(true);
      expect(isEventAllowed('PUSH', config)).toBe(false);
      expect(isEventAllowed('Push', config)).toBe(false);
    });
  });
});
