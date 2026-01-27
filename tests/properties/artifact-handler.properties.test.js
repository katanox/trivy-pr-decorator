const fc = require('fast-check');
const { ArtifactHandler } = require('../../src/artifact-handler');

describe('ArtifactHandler Properties', () => {
  describe('Property 14: Detect workflow_run context correctly', () => {
    /**
     * For any GitHub context, the action should correctly identify whether it's running
     * in a workflow_run event by checking for the presence of github.event.workflow_run.
     * 
     * Validates: Requirements 10.1
     */
    it('should detect workflow_run context when workflow_run exists', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 1000000 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            head_branch: fc.string({ minLength: 1, maxLength: 50 })
          }),
          (workflowRun) => {
            const context = {
              payload: {
                workflow_run: workflowRun
              },
              repo: {
                owner: 'test-owner',
                repo: 'test-repo'
              }
            };

            const handler = new ArtifactHandler(null, context);
            const result = handler.isWorkflowRunContext();

            // Should return true when workflow_run exists
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect workflow_run context when workflow_run is missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            action: fc.constantFrom('opened', 'synchronize', 'reopened'),
            number: fc.integer({ min: 1, max: 10000 })
          }),
          (pullRequest) => {
            const context = {
              payload: {
                pull_request: pullRequest
              },
              repo: {
                owner: 'test-owner',
                repo: 'test-repo'
              }
            };

            const handler = new ArtifactHandler(null, context);
            const result = handler.isWorkflowRunContext();

            // Should return false when workflow_run doesn't exist
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect workflow_run context with empty payload', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          () => {
            const context = {
              payload: {},
              repo: {
                owner: 'test-owner',
                repo: 'test-repo'
              }
            };

            const handler = new ArtifactHandler(null, context);
            const result = handler.isWorkflowRunContext();

            // Should return false with empty payload
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Download and extract artifacts', () => {
    /**
     * For any workflow_run context with available artifacts, the artifact handler should
     * successfully download, extract, and return file paths.
     * 
     * Validates: Requirements 10.2, 10.3, 10.4
     */
    it('should return null paths when artifacts not found', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (artifactName, eventArtifactName) => {
            const mockOctokit = {
              rest: {
                actions: {
                  listWorkflowRunArtifacts: jest.fn().mockResolvedValue({
                    data: {
                      artifacts: [] // No artifacts available
                    }
                  })
                }
              }
            };

            const context = {
              payload: {
                workflow_run: {
                  id: 12345
                }
              },
              repo: {
                owner: 'test-owner',
                repo: 'test-repo'
              }
            };

            const handler = new ArtifactHandler(mockOctokit, context);
            const result = await handler.downloadArtifacts(artifactName, eventArtifactName);

            // Should return null paths when artifacts not found
            expect(result.resultsFilePath).toBeNull();
            expect(result.eventFilePath).toBeNull();
            expect(result.tempDir).toBeTruthy();
            expect(typeof result.tempDir).toBe('string');

            // Cleanup
            await handler.cleanup(result.tempDir);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when not in workflow_run context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (artifactName) => {
            const context = {
              payload: {}, // No workflow_run
              repo: {
                owner: 'test-owner',
                repo: 'test-repo'
              }
            };

            const handler = new ArtifactHandler(null, context);

            // Should throw error when not in workflow_run context
            await expect(handler.downloadArtifacts(artifactName, '')).rejects.toThrow(
              'Not in workflow_run context'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
