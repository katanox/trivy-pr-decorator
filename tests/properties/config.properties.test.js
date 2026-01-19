const fc = require('fast-check');
const { Config } = require('../../src/config');
const core = require('@actions/core');

// Mock @actions/core
jest.mock('@actions/core');

describe('Config Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: Validate required inputs
   * **Validates: Requirements 7.6**
   * 
   * For any configuration where results-file or github-token is missing,
   * validation should throw an error.
   */
  describe('Property 12: Validate required inputs', () => {
    it('should throw error when results-file is missing', () => {
      fc.assert(
        fc.property(
          fc.string(), // githubToken (any string)
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined)
          ), // resultsFile (missing values)
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }), // maxTableRows (optional)
          (githubToken, resultsFile, maxTableRows) => {
            // Setup mock to return the generated values
            core.getInput.mockImplementation((name) => {
              if (name === 'results-file') return resultsFile || '';
              if (name === 'github-token') return githubToken;
              if (name === 'max-table-rows') return maxTableRows ? String(maxTableRows) : '';
              return '';
            });

            const config = new Config();

            // Validation should throw an error because results-file is missing
            expect(() => config.validate()).toThrow();
            expect(() => config.validate()).toThrow(/results-file input is required/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when github-token is missing', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // resultsFile (any non-empty string)
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined)
          ), // githubToken (missing values)
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }), // maxTableRows (optional)
          (resultsFile, githubToken, maxTableRows) => {
            // Setup mock to return the generated values
            core.getInput.mockImplementation((name) => {
              if (name === 'results-file') return resultsFile;
              if (name === 'github-token') return githubToken || '';
              if (name === 'max-table-rows') return maxTableRows ? String(maxTableRows) : '';
              return '';
            });

            const config = new Config();

            // Validation should throw an error because github-token is missing
            expect(() => config.validate()).toThrow();
            expect(() => config.validate()).toThrow(/github-token input is required/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when both required inputs are missing', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined)
          ), // resultsFile (missing)
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined)
          ), // githubToken (missing)
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }), // maxTableRows (optional)
          (resultsFile, githubToken, maxTableRows) => {
            // Setup mock to return the generated values
            core.getInput.mockImplementation((name) => {
              if (name === 'results-file') return resultsFile || '';
              if (name === 'github-token') return githubToken || '';
              if (name === 'max-table-rows') return maxTableRows ? String(maxTableRows) : '';
              return '';
            });

            const config = new Config();

            // Validation should throw an error because both required inputs are missing
            expect(() => config.validate()).toThrow();
            expect(() => config.validate()).toThrow(/Configuration validation failed/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation when all required inputs are provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // resultsFile (non-empty string)
          fc.string({ minLength: 1 }), // githubToken (non-empty string)
          fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }), // maxTableRows (optional positive integer)
          (resultsFile, githubToken, maxTableRows) => {
            // Setup mock to return the generated values
            core.getInput.mockImplementation((name) => {
              if (name === 'results-file') return resultsFile;
              if (name === 'github-token') return githubToken;
              if (name === 'max-table-rows') return maxTableRows ? String(maxTableRows) : '';
              return '';
            });

            const config = new Config();

            // Validation should NOT throw when all required inputs are provided
            expect(() => config.validate()).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
