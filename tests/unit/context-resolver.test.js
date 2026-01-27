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

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      payload: {},
      eventName: 'pull_request',
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
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
});
