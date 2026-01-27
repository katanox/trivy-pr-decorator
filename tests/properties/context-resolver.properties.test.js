const fc = require('fast-check');
const { ContextResolver } = require('../../src/context-resolver');

describe('ContextResolver Properties', () => {
  describe('Property 15: Extract PR number from event file', () => {
    /**
     * For any valid event file containing a pull_request event, the context resolver
     * should successfully extract the PR number.
     * 
     * Validates: Requirements 9.7
     */
    it('should extract PR number from pull_request events', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (prNumber) => {
            const event = {
              pull_request: {
                number: prNumber,
                title: 'Test PR',
                state: 'open'
              }
            };

            const context = {
              payload: event,
              eventName: 'pull_request'
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractPRNumber(event, 'pull_request');

            // Should extract the correct PR number
            expect(extracted).toBe(prNumber);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract PR number from workflow_run events', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (prNumber) => {
            const event = {
              workflow_run: {
                id: 12345,
                pull_requests: [
                  {
                    number: prNumber,
                    head: { ref: 'feature-branch' }
                  }
                ]
              }
            };

            const context = {
              payload: event,
              eventName: 'workflow_run'
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractPRNumber(event, 'workflow_run');

            // Should extract the correct PR number from workflow_run
            expect(extracted).toBe(prNumber);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for push events', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 40 }),
          (commitSha) => {
            const event = {
              ref: 'refs/heads/main',
              after: commitSha,
              commits: []
            };

            const context = {
              payload: event,
              eventName: 'push'
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractPRNumber(event, 'push');

            // Should return null for push events (no PR context)
            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when PR data is missing', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pull_request', 'workflow_run', 'push'),
          (eventName) => {
            const event = {}; // Empty event

            const context = {
              payload: event,
              eventName
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractPRNumber(event, eventName);

            // Should return null when PR data is missing
            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle workflow_run with empty pull_requests array', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          () => {
            const event = {
              workflow_run: {
                id: 12345,
                pull_requests: [] // Empty array
              }
            };

            const context = {
              payload: event,
              eventName: 'workflow_run'
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractPRNumber(event, 'workflow_run');

            // Should return null when pull_requests array is empty
            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
