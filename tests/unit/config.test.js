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
