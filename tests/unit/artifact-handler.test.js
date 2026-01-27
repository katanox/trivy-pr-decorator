const { ArtifactHandler } = require('../../src/artifact-handler');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

// Mock dependencies
jest.mock('fs', () => ({
  mkdtempSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
  rmSync: jest.fn(),
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
jest.mock('adm-zip');

describe('ArtifactHandler', () => {
  let mockOctokit;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        actions: {
          listWorkflowRunArtifacts: jest.fn(),
          downloadArtifact: jest.fn()
        }
      }
    };

    mockContext = {
      payload: {},
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };
  });

  describe('isWorkflowRunContext', () => {
    it('should return true when workflow_run exists in payload', () => {
      mockContext.payload.workflow_run = {
        id: 12345,
        name: 'CI'
      };

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      expect(handler.isWorkflowRunContext()).toBe(true);
    });

    it('should return false when workflow_run does not exist', () => {
      mockContext.payload.pull_request = {
        number: 42
      };

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      expect(handler.isWorkflowRunContext()).toBe(false);
    });

    it('should return false with empty payload', () => {
      const handler = new ArtifactHandler(mockOctokit, mockContext);
      expect(handler.isWorkflowRunContext()).toBe(false);
    });
  });

  describe('downloadArtifacts', () => {
    beforeEach(() => {
      // Mock fs functions
      fs.mkdtempSync = jest.fn().mockReturnValue('/tmp/trivy-artifacts-abc123');
      fs.writeFileSync = jest.fn();
      fs.readdirSync = jest.fn();
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.rmSync = jest.fn();
    });

    it('should throw error when not in workflow_run context', async () => {
      const handler = new ArtifactHandler(mockOctokit, mockContext);

      await expect(
        handler.downloadArtifacts('trivy-results', 'event-file')
      ).rejects.toThrow('Not in workflow_run context');
    });

    it('should download and extract artifacts when found', async () => {
      mockContext.payload.workflow_run = {
        id: 12345
      };

      mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [
            { id: 1, name: 'trivy-results' },
            { id: 2, name: 'event-file' }
          ]
        }
      });

      mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
        data: Buffer.from('mock-zip-data')
      });

      fs.readdirSync.mockReturnValue(['trivy-results.json']);

      const mockZip = {
        extractAllTo: jest.fn()
      };
      AdmZip.mockImplementation(() => mockZip);

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      const result = await handler.downloadArtifacts('trivy-results', 'event-file');

      expect(result.resultsFilePath).toContain('trivy-results.json');
      expect(result.eventFilePath).toContain('event-file');
      expect(result.tempDir).toBe('/tmp/trivy-artifacts-abc123');

      expect(mockOctokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 12345
      });

      expect(mockOctokit.rest.actions.downloadArtifact).toHaveBeenCalledTimes(2);
    });

    it('should return null paths when artifacts not found', async () => {
      mockContext.payload.workflow_run = {
        id: 12345
      };

      mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: []
        }
      });

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      const result = await handler.downloadArtifacts('trivy-results', 'event-file');

      expect(result.resultsFilePath).toBeNull();
      expect(result.eventFilePath).toBeNull();
      expect(result.tempDir).toBe('/tmp/trivy-artifacts-abc123');
    });

    it('should handle partial artifact availability', async () => {
      mockContext.payload.workflow_run = {
        id: 12345
      };

      mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [
            { id: 1, name: 'trivy-results' }
            // event-file artifact missing
          ]
        }
      });

      mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
        data: Buffer.from('mock-zip-data')
      });

      fs.readdirSync.mockReturnValue(['trivy-results.json']);

      const mockZip = {
        extractAllTo: jest.fn()
      };
      AdmZip.mockImplementation(() => mockZip);

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      const result = await handler.downloadArtifacts('trivy-results', 'event-file');

      expect(result.resultsFilePath).toContain('trivy-results.json');
      expect(result.eventFilePath).toBeNull();
      expect(result.tempDir).toBe('/tmp/trivy-artifacts-abc123');
    });

    it('should throw error when artifact download fails', async () => {
      mockContext.payload.workflow_run = {
        id: 12345
      };

      mockOctokit.rest.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [
            { id: 1, name: 'trivy-results' }
          ]
        }
      });

      mockOctokit.rest.actions.downloadArtifact.mockRejectedValue(
        new Error('Network error')
      );

      const handler = new ArtifactHandler(mockOctokit, mockContext);

      await expect(
        handler.downloadArtifacts('trivy-results', '')
      ).rejects.toThrow('Failed to download artifact: Network error');
    });

    it('should throw error when artifact listing fails', async () => {
      mockContext.payload.workflow_run = {
        id: 12345
      };

      mockOctokit.rest.actions.listWorkflowRunArtifacts.mockRejectedValue(
        new Error('API error')
      );

      const handler = new ArtifactHandler(mockOctokit, mockContext);

      await expect(
        handler.downloadArtifacts('trivy-results', '')
      ).rejects.toThrow('Failed to list artifacts: API error');
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      fs.existsSync = jest.fn();
      fs.rmSync = jest.fn();
    });

    it('should remove temporary directory when it exists', async () => {
      fs.existsSync.mockReturnValue(true);

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      await handler.cleanup('/tmp/trivy-artifacts-abc123');

      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/trivy-artifacts-abc123');
      expect(fs.rmSync).toHaveBeenCalledWith('/tmp/trivy-artifacts-abc123', {
        recursive: true,
        force: true
      });
    });

    it('should not throw error when directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      await expect(handler.cleanup('/tmp/nonexistent')).resolves.not.toThrow();

      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.rmSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const handler = new ArtifactHandler(mockOctokit, mockContext);
      
      // Should not throw, just log warning
      await expect(handler.cleanup('/tmp/trivy-artifacts-abc123')).resolves.not.toThrow();
    });
  });
});
