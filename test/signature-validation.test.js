// Test script for GitHub webhook signature validation
// Tests crypto signature verification with various scenarios

const crypto = require('crypto');

describe('GitHub Signature Validation', () => {
  // Test data
  const testPayload = JSON.stringify({ test: 'data', action: 'opened' });
  const testSecret = 'test-webhook-secret';

  // Implement the signature validation function for testing
  function validateGitHubSignature(payload, signature, secret) {
    if (payload === null || payload === undefined || !signature || !secret) {
      throw new Error('Missing required parameters for signature validation');
    }

    if (!signature.startsWith('sha256=')) {
      throw new Error('Invalid signature format - must start with sha256=');
    }

    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Use timing-safe comparison
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

  // Generate valid signature
  function generateSignature(payload, secret) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  describe('Valid signatures', () => {
    test('should accept valid signature', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      const result = validateGitHubSignature(testPayload, validSignature, testSecret);
      expect(result).toBe(true);
    });

    test('should accept empty payload with valid signature', () => {
      const emptyPayload = '';
      const emptyPayloadSig = generateSignature(emptyPayload, testSecret);
      const result = validateGitHubSignature(emptyPayload, emptyPayloadSig, testSecret);
      expect(result).toBe(true);
    });

    test('should work with different payload content', () => {
      const differentPayload = JSON.stringify({ action: 'closed', number: 123 });
      const validSignature = generateSignature(differentPayload, testSecret);
      const result = validateGitHubSignature(differentPayload, validSignature, testSecret);
      expect(result).toBe(true);
    });
  });

  describe('Invalid signatures', () => {
    test('should reject completely invalid signature', () => {
      const invalidSignature = 'sha256=invalid-signature-hash';
      const result = validateGitHubSignature(testPayload, invalidSignature, testSecret);
      expect(result).toBe(false);
    });

    test('should reject signature with wrong secret', () => {
      const wrongSecret = 'wrong-secret';
      const wrongSecretSig = generateSignature(testPayload, wrongSecret);
      const result = validateGitHubSignature(testPayload, wrongSecretSig, testSecret);
      expect(result).toBe(false);
    });

    test('should reject signature without sha256 prefix', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      const noPrefix = validSignature.replace('sha256=', '');
      expect(() => {
        validateGitHubSignature(testPayload, noPrefix, testSecret);
      }).toThrow('Invalid signature format - must start with sha256=');
    });

    test('should reject signature with different payload', () => {
      const originalPayload = JSON.stringify({ test: 'data', action: 'opened' });
      const modifiedPayload = JSON.stringify({ test: 'data', action: 'closed' });
      const signature = generateSignature(originalPayload, testSecret);

      const result = validateGitHubSignature(modifiedPayload, signature, testSecret);
      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('should throw error for null payload', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      expect(() => {
        validateGitHubSignature(null, validSignature, testSecret);
      }).toThrow('Missing required parameters for signature validation');
    });

    test('should throw error for undefined payload', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      expect(() => {
        validateGitHubSignature(undefined, validSignature, testSecret);
      }).toThrow('Missing required parameters for signature validation');
    });

    test('should throw error for missing signature', () => {
      expect(() => {
        validateGitHubSignature(testPayload, null, testSecret);
      }).toThrow('Missing required parameters for signature validation');
    });

    test('should throw error for missing secret', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      expect(() => {
        validateGitHubSignature(testPayload, validSignature, null);
      }).toThrow('Missing required parameters for signature validation');
    });

    test('should throw error for empty string inputs', () => {
      expect(() => {
        validateGitHubSignature('', '', '');
      }).toThrow('Missing required parameters for signature validation');
    });
  });

  describe('Signature format validation', () => {
    test('should reject signatures without proper prefix', () => {
      expect(() => {
        validateGitHubSignature(testPayload, 'invalid-format', testSecret);
      }).toThrow('Invalid signature format - must start with sha256=');
    });

    test('should reject signatures with wrong hash algorithm prefix', () => {
      expect(() => {
        validateGitHubSignature(testPayload, 'sha1=somehash', testSecret);
      }).toThrow('Invalid signature format - must start with sha256=');
    });

    test('should accept valid sha256 prefix format', () => {
      const validSignature = generateSignature(testPayload, testSecret);
      expect(validSignature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});
