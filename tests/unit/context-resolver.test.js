const { ContextResolver } = require('../../src/context-resolver');
const fs = require('fs');

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  constants: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    S_IFMT: 61440,
    S_IFREG: 32768,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960,
    S_IFSOCK: 49152
  },
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn()
  }
}));

describe('ContextResolver', () => {
  let mockContext;
  let mockOctokit;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      payload: {},
      eventName: 'pull_request',
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      },
      sha: 'abc123'
    };

    mockOctokit = {
      rest: {
        repos: {
          listPullRequestsAssociatedWithCommit: jest.fn()
        }
      }
    };
  });

  describe('extractPRNumber', () => {
    it('should extract PR number from pull_request event', () => {
      const event = {
        pull_request: {
          number: 42,
          title: 'Test PR'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'pull_request');

      expect(prNumber).toBe(42);
    });

    it('should extract PR number from pull_request_target event', () => {
      const event = {
        pull_request: {
          number: 99,
          title: 'Fork PR'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'pull_request_target');

      expect(prNumber).toBe(99);
    });

    it('should extract PR number from workflow_run event', () => {
      const event = {
        workflow_run: {
          id: 12345,
          pull_requests: [
            { number: 42, head: { ref: 'feature' } }
          ]
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'workflow_run');

      expect(prNumber).toBe(42);
    });

    it('should return null for push events without PR context', () => {
      const event = {
        ref: 'refs/heads/main',
        after: 'abc123'
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'push');

      expect(prNumber).toBeNull();
    });

    it('should extract PR number from push events with PR context (workflow_run pattern)', () => {
      const event = {
        ref: 'refs/heads/main',
        after: 'abc123',
        pull_request: {
          number: 42
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'push');

      expect(prNumber).toBe(42);
    });

    it('should extract PR number from workflow_call events', () => {
      const event = {
        pull_request: {
          number: 99,
          title: 'Test PR'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'workflow_call');

      expect(prNumber).toBe(99);
    });

    it('should return null for workflow_call events without PR context', () => {
      const event = {
        inputs: {
          some_input: 'value'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'workflow_call');

      expect(prNumber).toBeNull();
    });

    it('should return null when pull_request is missing', () => {
      const event = {};

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'pull_request');

      expect(prNumber).toBeNull();
    });

    it('should return null when workflow_run has no pull_requests', () => {
      const event = {
        workflow_run: {
          id: 12345
          // No pull_requests array
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'workflow_run');

      expect(prNumber).toBeNull();
    });

    it('should return null when workflow_run has empty pull_requests array', () => {
      const event = {
        workflow_run: {
          id: 12345,
          pull_requests: []
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'workflow_run');

      expect(prNumber).toBeNull();
    });

    it('should use fallback to extract from pull_request when event name unknown', () => {
      const event = {
        pull_request: {
          number: 42
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'unknown_event');

      expect(prNumber).toBe(42);
    });

    it('should use fallback to extract from workflow_run when event name unknown', () => {
      const event = {
        workflow_run: {
          pull_requests: [
            { number: 42 }
          ]
        }
      };

      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(event, 'unknown_event');

      expect(prNumber).toBe(42);
    });

    it('should return null for null event', () => {
      const resolver = new ContextResolver(mockContext);
      const prNumber = resolver.extractPRNumber(null, 'pull_request');

      expect(prNumber).toBeNull();
    });
  });

  describe('resolvePRContext', () => {
    it('should resolve PR context from current payload', async () => {
      mockContext.payload = {
        pull_request: {
          number: 42
        }
      };
      mockContext.eventName = 'pull_request';

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext();

      expect(result.prNumber).toBe(42);
      expect(result.isWorkflowRun).toBe(false);
      expect(result.eventName).toBe('pull_request');
    });

    it('should resolve PR context from event file', async () => {
      const eventData = {
        pull_request: {
          number: 99
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(eventData));

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext('/tmp/event.json', 'pull_request');

      expect(result.prNumber).toBe(99);
      expect(result.isWorkflowRun).toBe(false);
      expect(result.eventName).toBe('pull_request');

      expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/event.json', 'utf8');
    });

    it('should detect workflow_run context', async () => {
      mockContext.payload = {
        workflow_run: {
          id: 12345,
          pull_requests: [
            { number: 42 }
          ]
        }
      };
      mockContext.eventName = 'workflow_run';

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext();

      expect(result.prNumber).toBe(42);
      expect(result.isWorkflowRun).toBe(true);
      expect(result.eventName).toBe('workflow_run');
    });

    it('should use provided event name over context event name', async () => {
      mockContext.eventName = 'pull_request';

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext(null, 'workflow_run');

      expect(result.eventName).toBe('workflow_run');
    });

    it('should handle event file read errors gracefully', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext('/tmp/missing.json', 'pull_request');

      expect(result.prNumber).toBeNull();
      expect(result.eventName).toBe('pull_request');
    });

    it('should handle invalid JSON in event file gracefully', async () => {
      fs.readFileSync.mockReturnValue('invalid json{');

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext('/tmp/invalid.json', 'pull_request');

      expect(result.prNumber).toBeNull();
      expect(result.eventName).toBe('pull_request');
    });

    it('should use empty string for event name when not provided', async () => {
      mockContext.eventName = '';

      const resolver = new ContextResolver(mockContext);
      const result = await resolver.resolvePRContext();

      expect(result.eventName).toBe('');
    });
  });

  describe('extractCommitSHA', () => {
    it('should extract SHA from shaInput when provided', () => {
      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA('input-sha-123');

      expect(sha).toBe('input-sha-123');
    });

    it('should extract SHA from head_commit.id when shaInput not provided', () => {
      mockContext.payload = {
        head_commit: {
          id: 'head-commit-sha-456'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('head-commit-sha-456');
    });

    it('should extract SHA from payload.after when head_commit.id missing', () => {
      mockContext.payload = {
        after: 'after-sha-789'
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('after-sha-789');
    });

    it('should extract SHA from context.sha when other locations missing', () => {
      mockContext.payload = {};
      mockContext.sha = 'context-sha-abc';

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('context-sha-abc');
    });

    it('should return null when all locations are null/undefined', () => {
      mockContext.payload = {};
      mockContext.sha = undefined;

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBeNull();
    });

    it('should return null when all locations are empty strings', () => {
      mockContext.payload = {
        head_commit: { id: '' },
        after: ''
      };
      mockContext.sha = '';

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBeNull();
    });

    it('should prioritize shaInput over head_commit.id', () => {
      mockContext.payload = {
        head_commit: {
          id: 'head-commit-sha'
        }
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA('input-sha');

      expect(sha).toBe('input-sha');
    });

    it('should prioritize head_commit.id over after', () => {
      mockContext.payload = {
        head_commit: {
          id: 'head-commit-sha'
        },
        after: 'after-sha'
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('head-commit-sha');
    });

    it('should prioritize after over context.sha', () => {
      mockContext.payload = {
        after: 'after-sha'
      };
      mockContext.sha = 'context-sha';

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('after-sha');
    });

    it('should handle missing head_commit object', () => {
      mockContext.payload = {
        after: 'after-sha'
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('after-sha');
    });

    it('should handle head_commit without id property', () => {
      mockContext.payload = {
        head_commit: {},
        after: 'after-sha'
      };

      const resolver = new ContextResolver(mockContext);
      const sha = resolver.extractCommitSHA();

      expect(sha).toBe('after-sha');
    });
  });

  describe('findPRByCommit', () => {
    it('should return null when octokit is not available', async () => {
      const resolver = new ContextResolver(mockContext, null);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBeNull();
    });

    it('should find PR by commit SHA', async () => {
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: [
          {
            number: 42,
            state: 'open',
            title: 'Test PR'
          }
        ]
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBe(42);
      expect(mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        commit_sha: 'abc123'
      });
    });

    it('should return first open PR when multiple PRs found', async () => {
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: [
          {
            number: 10,
            state: 'closed',
            title: 'Closed PR'
          },
          {
            number: 42,
            state: 'open',
            title: 'Open PR'
          },
          {
            number: 99,
            state: 'open',
            title: 'Another Open PR'
          }
        ]
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBe(42);
    });

    it('should return first PR when no open PRs found', async () => {
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: [
          {
            number: 10,
            state: 'closed',
            title: 'Closed PR'
          },
          {
            number: 20,
            state: 'merged',
            title: 'Merged PR'
          }
        ]
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBe(10);
    });

    it('should return null when no PRs found', async () => {
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: []
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBeNull();
    });

    it('should return null when API call fails', async () => {
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockRejectedValue(
        new Error('API Error')
      );

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const prNumber = await resolver.findPRByCommit('abc123');

      expect(prNumber).toBeNull();
    });
  });

  describe('resolvePRContext with SHA input', () => {
    it('should use SHA input to find PR when no PR in payload', async () => {
      mockContext.eventName = 'workflow_call';
      mockContext.payload = {};

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: [
          {
            number: 42,
            state: 'open',
            title: 'Test PR'
          }
        ]
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const result = await resolver.resolvePRContext(null, 'workflow_call', 'input-sha-123');

      expect(result.prNumber).toBe(42);
      expect(mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        commit_sha: 'input-sha-123'
      });
    });

    it('should extract SHA from head_commit.id for workflow_call when no SHA input', async () => {
      mockContext.eventName = 'workflow_call';
      mockContext.payload = {
        head_commit: {
          id: 'head-commit-sha'
        }
      };

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
        data: [
          {
            number: 99,
            state: 'open',
            title: 'Test PR'
          }
        ]
      });

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const result = await resolver.resolvePRContext(null, 'workflow_call');

      expect(result.prNumber).toBe(99);
      expect(mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        commit_sha: 'head-commit-sha'
      });
    });

    it('should not call findPRByCommit when PR already in payload', async () => {
      mockContext.eventName = 'workflow_call';
      mockContext.payload = {
        pull_request: {
          number: 42
        }
      };

      const resolver = new ContextResolver(mockContext, mockOctokit);
      const result = await resolver.resolvePRContext(null, 'workflow_call', 'input-sha-123');

      expect(result.prNumber).toBe(42);
      expect(mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit).not.toHaveBeenCalled();
    });
  });
});
