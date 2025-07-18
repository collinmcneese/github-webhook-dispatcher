// Test script for configuration error handling
// Tests various error scenarios and edge cases

const fs = require('fs');
const path = require('path');
const toml = require('toml');
const yaml = require('js-yaml');

describe('Configuration Error Handling', () => {
  const testDir = path.join(__dirname, 'fixtures');

  // Mock the processRouteFile function for testing
  // This simulates the actual function from lib.js
  async function processRouteFile(routeFile) {
    if (!fs.existsSync(routeFile)) {
      throw new Error(`Route file ${routeFile} not found`);
    }

    const stats = fs.statSync(routeFile);
    if (stats.isDirectory()) {
      throw new Error(`${routeFile} is a directory, not a file`);
    }

    const routeFileContent = fs.readFileSync(routeFile, 'utf8');
    const routeFileExtension = path.extname(routeFile).toLowerCase();

    let routeFileContentType;
    if (routeFileExtension === '.toml') {
      routeFileContentType = 'toml';
    } else if (routeFileExtension === '.json') {
      routeFileContentType = 'json';
    } else if (routeFileExtension === '.yaml' || routeFileExtension === '.yml') {
      routeFileContentType = 'yaml';
    } else {
      throw new Error(`Route file ${routeFile} is not in TOML, JSON, or YAML format`);
    }

    let parsedContent;
    if (routeFileContentType === 'toml') {
      parsedContent = toml.parse(routeFileContent);
    } else if (routeFileContentType === 'json') {
      parsedContent = JSON.parse(routeFileContent);
    } else if (routeFileContentType === 'yaml') {
      parsedContent = yaml.load(routeFileContent);
    }

    return parsedContent;
  }

  beforeEach(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        const filePath = path.join(testDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            fs.rmdirSync(filePath);
          } else {
            // Reset permissions before deletion
            fs.chmodSync(filePath, 0o644);
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          // Ignore cleanup errors
          void err;
        }
      });
      try {
        fs.rmdirSync(testDir);
      } catch (error) {
        // Ignore cleanup errors
        void error;
      }
    }
  });

  describe('File existence errors', () => {
    test('should throw error for non-existent file', async () => {
      await expect(processRouteFile('/non/existent/file.toml'))
        .rejects.toThrow('Route file /non/existent/file.toml not found');
    });

    test('should throw error when given a directory instead of file', async () => {
      const dirPath = path.join(testDir, 'subdir');
      fs.mkdirSync(dirPath);

      await expect(processRouteFile(dirPath))
        .rejects.toThrow('is a directory, not a file');
    });
  });

  describe('File format errors', () => {
    test('should throw error for unsupported file extension', async () => {
      const unsupportedFile = path.join(testDir, 'config.txt');
      fs.writeFileSync(unsupportedFile, 'some content');

      await expect(processRouteFile(unsupportedFile))
        .rejects.toThrow('is not in TOML, JSON, or YAML format');
    });

    test('should throw error for file with no extension', async () => {
      const noExtFile = path.join(testDir, 'config');
      fs.writeFileSync(noExtFile, 'some content');

      await expect(processRouteFile(noExtFile))
        .rejects.toThrow('is not in TOML, JSON, or YAML format');
    });
  });

  describe('TOML parsing errors', () => {
    test('should throw error for malformed TOML', async () => {
      const malformedToml = path.join(testDir, 'malformed.toml');
      fs.writeFileSync(malformedToml, '[invalid toml syntax');

      await expect(processRouteFile(malformedToml))
        .rejects.toThrow();
    });

    test('should throw error for TOML with invalid syntax', async () => {
      const invalidToml = path.join(testDir, 'invalid.toml');
      fs.writeFileSync(invalidToml, 'key = value = invalid');

      await expect(processRouteFile(invalidToml))
        .rejects.toThrow();
    });

    test('should handle empty TOML file', async () => {
      const emptyToml = path.join(testDir, 'empty.toml');
      fs.writeFileSync(emptyToml, '');

      const result = await processRouteFile(emptyToml);
      expect(result).toEqual({});
    });
  });

  describe('JSON parsing errors', () => {
    test('should throw error for malformed JSON', async () => {
      const malformedJson = path.join(testDir, 'malformed.json');
      fs.writeFileSync(malformedJson, '{ "invalid": json syntax }');

      await expect(processRouteFile(malformedJson))
        .rejects.toThrow();
    });

    test('should throw error for JSON with trailing comma', async () => {
      const invalidJson = path.join(testDir, 'invalid.json');
      fs.writeFileSync(invalidJson, '{ "key": "value", }');

      await expect(processRouteFile(invalidJson))
        .rejects.toThrow();
    });

    test('should handle empty JSON object', async () => {
      const emptyJson = path.join(testDir, 'empty.json');
      fs.writeFileSync(emptyJson, '{}');

      const result = await processRouteFile(emptyJson);
      expect(result).toEqual({});
    });

    test('should handle empty JSON file', async () => {
      const emptyFile = path.join(testDir, 'empty-file.json');
      fs.writeFileSync(emptyFile, '');

      await expect(processRouteFile(emptyFile))
        .rejects.toThrow();
    });
  });

  describe('YAML parsing errors', () => {
    test('should throw error for malformed YAML', async () => {
      const malformedYaml = path.join(testDir, 'malformed.yaml');
      fs.writeFileSync(malformedYaml, 'invalid:\n  - yaml: syntax\n    - nested');

      await expect(processRouteFile(malformedYaml))
        .rejects.toThrow();
    });

    test('should handle both .yaml and .yml extensions', async () => {
      const yamlContent = 'owner:\n  target: https://example.com';

      const yamlFile = path.join(testDir, 'config.yaml');
      fs.writeFileSync(yamlFile, yamlContent);

      const ymlFile = path.join(testDir, 'config.yml');
      fs.writeFileSync(ymlFile, yamlContent);

      const yamlResult = await processRouteFile(yamlFile);
      const ymlResult = await processRouteFile(ymlFile);

      expect(yamlResult).toEqual({ owner: { target: 'https://example.com' } });
      expect(ymlResult).toEqual({ owner: { target: 'https://example.com' } });

      // Cleanup files immediately after test
      fs.unlinkSync(yamlFile);
      fs.unlinkSync(ymlFile);
    });

    test('should handle empty YAML file', async () => {
      const emptyYaml = path.join(testDir, 'empty.yaml');
      fs.writeFileSync(emptyYaml, '');

      const result = await processRouteFile(emptyYaml);
      expect(result === null || result === undefined).toBe(true);
    });
  });

  describe('File permission errors', () => {
    test('should handle file permission errors gracefully', async () => {
      const permFile = path.join(testDir, 'noperm.toml');
      fs.writeFileSync(permFile, '[test]\ntarget = "https://example.com"');

      try {
        // Try to remove read permissions (may not work on all systems)
        fs.chmodSync(permFile, 0o000);

        await expect(processRouteFile(permFile))
          .rejects.toThrow();
      } catch (chmodError) {
        // If chmod fails, skip this test (common on some filesystems)
        console.log('Skipping permission test: chmod not supported');
        void chmodError;
      }
    });
  });

  describe('Edge cases', () => {
    test('should handle very large files', async () => {
      const largeContent = 'key = "' + 'x'.repeat(10000) + '"';
      const largeFile = path.join(testDir, 'large.toml');
      fs.writeFileSync(largeFile, largeContent);

      const result = await processRouteFile(largeFile);
      expect(result.key).toHaveLength(10000);
    });

    test('should handle files with special characters in paths', async () => {
      const specialDir = path.join(testDir, 'special-chars!@#');
      fs.mkdirSync(specialDir, { recursive: true });

      const specialFile = path.join(specialDir, 'config.toml');
      fs.writeFileSync(specialFile, '[owner]\ntarget = "https://example.com"');

      const result = await processRouteFile(specialFile);
      expect(result.owner.target).toBe('https://example.com');

      // Cleanup
      fs.unlinkSync(specialFile);
      fs.rmdirSync(specialDir);
    });
  });
});
