// Test script for route configuration processing
// Tests TOML, JSON, and YAML route file parsing

const fs = require('fs');
const path = require('path');
const toml = require('toml');
const yaml = require('js-yaml');

describe('Route Configuration Processing', () => {
  const testDir = path.join(__dirname, 'fixtures');

  // Implement the route processing function for testing
  function processRouteFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.toml':
        return toml.parse(fileContent);
      case '.json':
        return JSON.parse(fileContent);
      case '.yaml':
      case '.yml':
        return yaml.load(fileContent);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  // Create test route files
  const testFiles = {
    'test-routes.toml': `
[owner1]
target = "https://example.com/owner1"
events = ["push", "pull_request"]

[owner1.repo1]
target = "https://example.com/owner1/repo1"
events = ["release"]
`,
    'test-routes.json': `{
  "owner1": {
    "target": "https://example.com/owner1",
    "events": ["push", "pull_request"],
    "repo1": {
      "target": "https://example.com/owner1/repo1",
      "events": ["release"]
    }
  }
}`,
    'test-routes.yaml': `
owner1:
  target: https://example.com/owner1
  events: ["push", "pull_request"]
  repo1:
    target: https://example.com/owner1/repo1
    events: ["release"]
`
  };

  beforeEach(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      try {
        const files = fs.readdirSync(testDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(testDir, file));
          } catch (err) {
            // Ignore file cleanup errors
            void err;
          }
        });
        fs.rmdirSync(testDir);
      } catch (err) {
        // Ignore directory cleanup errors
        void err;
      }
    }
  });

  describe('TOML format processing', () => {
    test('should parse TOML route configuration correctly', () => {
      const filePath = path.join(testDir, 'test-routes.toml');
      fs.writeFileSync(filePath, testFiles['test-routes.toml']);

      const routes = processRouteFile(filePath);

      expect(routes.owner1).toBeDefined();
      expect(routes.owner1.target).toBe('https://example.com/owner1');
      expect(routes.owner1.events).toEqual(['push', 'pull_request']);
      expect(routes.owner1.repo1).toBeDefined();
      expect(routes.owner1.repo1.target).toBe('https://example.com/owner1/repo1');
      expect(routes.owner1.repo1.events).toEqual(['release']);
    });
  });

  describe('JSON format processing', () => {
    test('should parse JSON route configuration correctly', () => {
      const filePath = path.join(testDir, 'test-routes.json');
      fs.writeFileSync(filePath, testFiles['test-routes.json']);

      const routes = processRouteFile(filePath);

      expect(routes.owner1).toBeDefined();
      expect(routes.owner1.target).toBe('https://example.com/owner1');
      expect(routes.owner1.events).toEqual(['push', 'pull_request']);
      expect(routes.owner1.repo1).toBeDefined();
      expect(routes.owner1.repo1.target).toBe('https://example.com/owner1/repo1');
      expect(routes.owner1.repo1.events).toEqual(['release']);
    });

    test('should handle malformed JSON gracefully', () => {
      const filePath = path.join(testDir, 'malformed.json');
      fs.writeFileSync(filePath, '{ "invalid": json }');

      expect(() => processRouteFile(filePath)).toThrow();
    });
  });

  describe('YAML format processing', () => {
    test('should parse YAML route configuration correctly', () => {
      const filePath = path.join(testDir, 'test-routes.yaml');
      fs.writeFileSync(filePath, testFiles['test-routes.yaml']);

      const routes = processRouteFile(filePath);

      expect(routes.owner1).toBeDefined();
      expect(routes.owner1.target).toBe('https://example.com/owner1');
      expect(routes.owner1.events).toEqual(['push', 'pull_request']);
      expect(routes.owner1.repo1).toBeDefined();
      expect(routes.owner1.repo1.target).toBe('https://example.com/owner1/repo1');
      expect(routes.owner1.repo1.events).toEqual(['release']);
    });

    test('should handle .yml extension', () => {
      const filePath = path.join(testDir, 'test-routes.yml');
      fs.writeFileSync(filePath, testFiles['test-routes.yaml']);

      const routes = processRouteFile(filePath);

      expect(routes.owner1).toBeDefined();
      expect(routes.owner1.target).toBe('https://example.com/owner1');
    });

    test('should handle malformed YAML gracefully', () => {
      const filePath = path.join(testDir, 'malformed.yaml');
      fs.writeFileSync(filePath, 'invalid: yaml: content: [}');

      expect(() => processRouteFile(filePath)).toThrow();
    });
  });

  describe('Error handling', () => {
    test('should throw error for unsupported file format', () => {
      const filePath = path.join(testDir, 'test-invalid.txt');
      fs.writeFileSync(filePath, 'invalid content');

      expect(() => processRouteFile(filePath)).toThrow('Unsupported file format: .txt');
    });

    test('should throw error for non-existent file', () => {
      const filePath = path.join(testDir, 'non-existent.toml');

      expect(() => processRouteFile(filePath)).toThrow();
    });

    test('should handle empty files gracefully', () => {
      const filePath = path.join(testDir, 'empty.json');
      fs.writeFileSync(filePath, '');

      expect(() => processRouteFile(filePath)).toThrow();
    });
  });

  describe('Route structure validation', () => {
    test('should handle nested repository configurations', () => {
      const nestedConfig = {
        'nested-routes.toml': `
[owner1]
target = "https://example.com/owner1"

[owner1.repo1]
target = "https://example.com/owner1/repo1"

[owner1.repo2]
target = "https://example.com/owner1/repo2"
events = ["push", "release"]
`
      };

      const filePath = path.join(testDir, 'nested-routes.toml');
      fs.writeFileSync(filePath, nestedConfig['nested-routes.toml']);

      const routes = processRouteFile(filePath);

      expect(routes.owner1.repo1).toBeDefined();
      expect(routes.owner1.repo2).toBeDefined();
      expect(routes.owner1.repo2.events).toEqual(['push', 'release']);
    });

    test('should handle multiple owners', () => {
      const multiOwnerConfig = `
[owner1]
target = "https://example.com/owner1"

[owner2]
target = "https://example.com/owner2"
events = ["issues", "pull_request"]
`;

      const filePath = path.join(testDir, 'multi-owner.toml');
      fs.writeFileSync(filePath, multiOwnerConfig);

      const routes = processRouteFile(filePath);

      expect(routes.owner1).toBeDefined();
      expect(routes.owner2).toBeDefined();
      expect(routes.owner2.events).toEqual(['issues', 'pull_request']);
    });
  });
});
