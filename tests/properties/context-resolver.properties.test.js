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

  describe('Property 1: SHA Extraction from Multiple Locations', () => {
    /**
     * For any GitHub Actions context with a commit SHA in any of the checked locations
     * (head_commit.id, after, or context.sha), the extractCommitSHA method should
     * successfully extract and return that SHA value.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4
     */
    it('should extract SHA from head_commit.id when present', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (sha) => {
            const context = {
              payload: {
                head_commit: {
                  id: sha
                }
              }
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(sha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract SHA from payload.after when head_commit.id is missing', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (sha) => {
            const context = {
              payload: {
                after: sha
              }
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(sha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract SHA from context.sha when other locations are missing', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (sha) => {
            const context = {
              payload: {},
              sha: sha
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(sha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when no SHA is present in any location', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          () => {
            const context = {
              payload: {}
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: SHA Priority Order', () => {
    /**
     * For any GitHub Actions context where multiple SHA locations contain values,
     * the extractCommitSHA method should return the SHA from the highest priority
     * location according to this order: shaInput > head_commit.id > after > context.sha.
     * 
     * Validates: Requirements 1.5, 2.1, 2.2
     */
    it('should prioritize shaInput over all other locations', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (inputSha, headCommitSha, afterSha, contextSha) => {
            fc.pre(inputSha !== headCommitSha && inputSha !== afterSha && inputSha !== contextSha);

            const context = {
              payload: {
                head_commit: { id: headCommitSha },
                after: afterSha
              },
              sha: contextSha
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA(inputSha);

            expect(extracted).toBe(inputSha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize head_commit.id over after and context.sha', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (headCommitSha, afterSha, contextSha) => {
            fc.pre(headCommitSha !== afterSha && headCommitSha !== contextSha);

            const context = {
              payload: {
                head_commit: { id: headCommitSha },
                after: afterSha
              },
              sha: contextSha
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(headCommitSha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize after over context.sha', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (afterSha, contextSha) => {
            fc.pre(afterSha !== contextSha);

            const context = {
              payload: {
                after: afterSha
              },
              sha: contextSha
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(afterSha);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: SHA Extraction Resilience', () => {
    /**
     * For any GitHub Actions context where some SHA locations are undefined or null,
     * the extractCommitSHA method should continue checking remaining locations and
     * return the first valid SHA found, or null if none exist.
     * 
     * Validates: Requirements 6.1
     */
    it('should handle undefined and null values gracefully', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          fc.constantFrom('head_commit', 'after', 'sha'),
          (validSha, location) => {
            const context = {
              payload: {
                head_commit: location === 'head_commit' ? { id: validSha } : undefined,
                after: location === 'after' ? validSha : null
              },
              sha: location === 'sha' ? validSha : undefined
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBe(validSha);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when all locations are undefined or null', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          () => {
            const context = {
              payload: {
                head_commit: null,
                after: undefined
              },
              sha: null
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip empty string values and continue checking', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (validSha) => {
            const context = {
              payload: {
                head_commit: { id: '' },
                after: ''
              },
              sha: validSha
            };

            const resolver = new ContextResolver(context);
            const extracted = resolver.extractCommitSHA();

            // Should skip empty strings and find the valid SHA
            expect(extracted).toBe(validSha);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
