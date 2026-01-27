const { Config } = require('../../src/config');
const core = require('@actions/core');

// Mock @actions/core
jest.mock('@actions/core');

describe('Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should read inputs from @actions/core', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '15'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.resultsFile).toBe('trivy-results.json');
      expect(config.githubToken).toBe('ghp_test123');
      expect(config.maxTableRows).toBe(15);
    });

    it('should apply default value of 20 for maxTableRows if not provided', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': ''
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.maxTableRows).toBe(20);
    });

    it('should parse maxTableRows as integer', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '50'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.maxTableRows).toBe(50);
      expect(typeof config.maxTableRows).toBe('number');
    });

    it('should use GITHUB_EVENT_PATH as default for eventFile', () => {
      process.env.GITHUB_EVENT_PATH = '/github/workflow/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '20',
          'event-file': '',
          'event-name': '',
          'artifact-name': '',
          'event-artifact-name': ''
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.eventFile).toBe('/github/workflow/event.json');
      expect(config.eventName).toBe('pull_request');
      
      delete process.env.GITHUB_EVENT_PATH;
      delete process.env.GITHUB_EVENT_NAME;
    });

    it('should use custom eventFile and eventName when provided', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '20',
          'event-file': '/custom/event.json',
          'event-name': 'workflow_run',
          'artifact-name': '',
          'event-artifact-name': ''
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.eventFile).toBe('/custom/event.json');
      expect(config.eventName).toBe('workflow_run');
    });

    it('should handle optional artifact names', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '20',
          'event-file': '',
          'event-name': '',
          'artifact-name': 'trivy-results',
          'event-artifact-name': 'event-file'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.artifactName).toBe('trivy-results');
      expect(config.eventArtifactName).toBe('event-file');
    });

    it('should allow empty artifact names', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '20',
          'event-file': '',
          'event-name': '',
          'artifact-name': '',
          'event-artifact-name': ''
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(config.artifactName).toBe('');
      expect(config.eventArtifactName).toBe('');
    });
  });

  describe('validate', () => {
    it('should throw error when results-file is missing', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': '',
          'github-token': 'ghp_test123',
          'max-table-rows': '20'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).toThrow('results-file input is required');
    });

    it('should throw error when github-token is missing', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': '',
          'max-table-rows': '20'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).toThrow('github-token input is required');
    });

    it('should throw error when both required inputs are missing', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': '',
          'github-token': '',
          'max-table-rows': '20'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).toThrow('Configuration validation failed');
      expect(() => config.validate()).toThrow('results-file input is required');
      expect(() => config.validate()).toThrow('github-token input is required');
    });

    it('should throw error when max-table-rows is not a valid number', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': 'invalid'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).toThrow('max-table-rows must be a positive number');
    });

    it('should throw error when max-table-rows is zero or negative', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '0'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).toThrow('max-table-rows must be a positive number');
    });

    it('should pass validation when all required inputs are provided', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': '20'
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).not.toThrow();
    });

    it('should pass validation with default maxTableRows', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'results-file': 'trivy-results.json',
          'github-token': 'ghp_test123',
          'max-table-rows': ''
        };
        return inputs[name] || '';
      });

      const config = new Config();

      expect(() => config.validate()).not.toThrow();
      expect(config.maxTableRows).toBe(20);
    });
  });
});
