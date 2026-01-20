// Mock fs module
jest.mock('fs');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn()
}));

const fs = require('fs');
const core = require('@actions/core');
const { TrivyParser } = require('../../src/parser');
const { CommentFormatter } = require('../../src/formatter');
const { PRCommenter } = require('../../src/commenter');

describe('Integration Tests - Main Workflow', () => {
  let mockOctokit;
  let mockContext;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup GitHub context mock
    mockContext = {
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      },
      payload: {
        pull_request: {
          number: 123
        }
      }
    };

    // Setup Octokit mock
    mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn(),
          createComment: jest.fn(),
          updateComment: jest.fn()
        }
      }
    };
  });

  describe('End-to-End Workflow', () => {
    it('should successfully process Trivy results and post comment', async () => {
      // Setup Trivy results file
      const trivyData = {
        Results: [
          {
            Target: 'package-lock.json',
            Type: 'npm',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-1234',
                PkgName: 'lodash',
                InstalledVersion: '4.17.19',
                FixedVersion: '4.17.21',
                Severity: 'HIGH',
                Title: 'Prototype Pollution'
              },
              {
                VulnerabilityID: 'CVE-2023-5678',
                PkgName: 'axios',
                InstalledVersion: '0.21.0',
                FixedVersion: '0.21.2',
                Severity: 'CRITICAL',
                Title: 'SSRF Vulnerability'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      // Setup GitHub API mock - no existing comment
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

      // Execute workflow
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      const formatter = new CommentFormatter();
      const commentBody = formatter.format(results, 20);

      const commenter = new PRCommenter(mockOctokit, mockContext);
      await commenter.postOrUpdateComment(commentBody);

      // Verify results
      expect(results.counts).toEqual({
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
        total: 2
      });

      expect(commentBody).toContain('🔒 Trivy Security Scan Report');
      expect(commentBody).toContain('1 CRITICAL');
      expect(commentBody).toContain('1 HIGH');
      expect(commentBody).toContain('2 total');

      // Verify GitHub API was called correctly
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: commentBody
      });
    });

    it('should update existing bot comment instead of creating new one', async () => {
      // Setup Trivy results
      const trivyData = {
        Results: [
          {
            Target: 'Dockerfile',
            Type: 'alpine',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-9999',
                PkgName: 'openssl',
                InstalledVersion: '1.1.1',
                FixedVersion: '1.1.2',
                Severity: 'MEDIUM',
                Title: 'OpenSSL vulnerability'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      // Setup GitHub API mock - existing bot comment
      const existingComment = {
        id: 789,
        user: { type: 'Bot' },
        body: '## 🔒 Trivy Security Scan Report\n\nOld content'
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [existingComment] });
      mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: { id: 789 } });

      // Execute workflow
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      const formatter = new CommentFormatter();
      const commentBody = formatter.format(results, 10);

      const commenter = new PRCommenter(mockOctokit, mockContext);
      await commenter.postOrUpdateComment(commentBody);

      // Verify update was called, not create
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 789,
        body: commentBody
      });

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should handle zero vulnerabilities gracefully', async () => {
      // Setup empty Trivy results
      const trivyData = {
        Results: []
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      // Setup GitHub API mock
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 999 } });

      // Execute workflow
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      const formatter = new CommentFormatter();
      const commentBody = formatter.format(results, 20);

      const commenter = new PRCommenter(mockOctokit, mockContext);
      await commenter.postOrUpdateComment(commentBody);

      // Verify results
      expect(results.counts.total).toBe(0);
      expect(commentBody).toContain('✅ **No vulnerabilities found**');
      expect(commentBody).not.toContain('Vulnerability Details');

      // Verify comment was posted
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });

    it('should respect max-table-rows configuration', async () => {
      // Setup Trivy results with multiple vulnerabilities
      const vulnerabilities = [];
      for (let i = 1; i <= 5; i++) {
        vulnerabilities.push({
          VulnerabilityID: `CVE-2023-${i}`,
          PkgName: `package${i}`,
          InstalledVersion: '1.0.0',
          FixedVersion: '1.0.1',
          Severity: 'HIGH',
          Title: `Vulnerability ${i}`
        });
      }

      const trivyData = {
        Results: [
          {
            Target: 'test',
            Type: 'npm',
            Vulnerabilities: vulnerabilities
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      // Setup GitHub API mock
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 111 } });

      // Execute workflow with custom max rows
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      const formatter = new CommentFormatter();
      const commentBody = formatter.format(results, 2); // Limit to 2 rows

      // Verify table is limited
      expect(results.vulnerabilities).toHaveLength(5);
      expect(commentBody).toContain('... and 3 more');

      // Count table rows (excluding header)
      const tableRows = commentBody.match(/\| 🟠 HIGH \|/g);
      expect(tableRows).toHaveLength(2);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate parser errors for missing file', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const parser = new TrivyParser();

      expect(() => parser.parse('nonexistent.json')).toThrow('Results file not found: nonexistent.json');
    });

    it('should propagate parser errors for invalid JSON', () => {
      fs.readFileSync.mockReturnValue('{ invalid json }');

      const parser = new TrivyParser();

      expect(() => parser.parse('invalid.json')).toThrow(/Invalid JSON in results file/);
    });

    it('should propagate commenter errors when not in PR context', async () => {
      // Remove PR context
      const noPRContext = {
        repo: {
          owner: 'test-owner',
          repo: 'test-repo'
        },
        payload: {}
      };

      const commenter = new PRCommenter(mockOctokit, noPRContext);

      await expect(commenter.postOrUpdateComment('test body')).rejects.toThrow('Action must run in pull request context');
    });

    it('should propagate GitHub API errors', async () => {
      // Setup GitHub API to fail
      mockOctokit.rest.issues.listComments.mockRejectedValue(new Error('API rate limit exceeded'));

      const commenter = new PRCommenter(mockOctokit, mockContext);

      await expect(commenter.postOrUpdateComment('test body')).rejects.toThrow(/Failed to list PR comments/);
    });
  });

  describe('Data Flow', () => {
    it('should correctly pass data through the entire pipeline', async () => {
      // Setup Trivy results with various severities
      const trivyData = {
        Results: [
          {
            Target: 'test',
            Type: 'npm',
            Vulnerabilities: [
              { VulnerabilityID: 'CVE-1', PkgName: 'pkg1', InstalledVersion: '1.0', Severity: 'CRITICAL', Title: 'Critical', FixedVersion: '1.1' },
              { VulnerabilityID: 'CVE-2', PkgName: 'pkg2', InstalledVersion: '1.0', Severity: 'CRITICAL', Title: 'Critical', FixedVersion: '1.1' },
              { VulnerabilityID: 'CVE-3', PkgName: 'pkg3', InstalledVersion: '1.0', Severity: 'HIGH', Title: 'High', FixedVersion: '1.1' },
              { VulnerabilityID: 'CVE-4', PkgName: 'pkg4', InstalledVersion: '1.0', Severity: 'MEDIUM', Title: 'Medium', FixedVersion: '1.1' }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 123 } });

      // Execute full pipeline
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      const formatter = new CommentFormatter();
      const commentBody = formatter.format(results, 20);

      const commenter = new PRCommenter(mockOctokit, mockContext);
      await commenter.postOrUpdateComment(commentBody);

      // Verify data flows correctly
      expect(results.counts).toEqual({
        critical: 2,
        high: 1,
        medium: 1,
        low: 0,
        total: 4
      });

      // Verify comment contains all expected data
      expect(commentBody).toContain('🔒 Trivy Security Scan Report');
      expect(commentBody).toContain('2 CRITICAL');
      expect(commentBody).toContain('1 HIGH');
      expect(commentBody).toContain('1 MEDIUM');
      expect(commentBody).toContain('4 total');
      expect(commentBody).toContain('CVE-1');
      expect(commentBody).toContain('CVE-2');
      expect(commentBody).toContain('CVE-3');
      expect(commentBody).toContain('CVE-4');

      // Verify GitHub API was called with the formatted comment
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: commentBody
      });
    });
  });

  describe('Action Outputs', () => {
    it('should set all output values correctly', async () => {
      // Clear previous calls
      core.setOutput.mockClear();

      // Setup Trivy results with all severity levels
      const trivyData = {
        Results: [
          {
            Target: 'package-lock.json',
            Type: 'npm',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-0001',
                PkgName: 'critical-pkg',
                InstalledVersion: '1.0.0',
                FixedVersion: '1.0.1',
                Severity: 'CRITICAL',
                Title: 'Critical vulnerability'
              },
              {
                VulnerabilityID: 'CVE-2023-0002',
                PkgName: 'high-pkg',
                InstalledVersion: '2.0.0',
                FixedVersion: '2.0.1',
                Severity: 'HIGH',
                Title: 'High vulnerability'
              },
              {
                VulnerabilityID: 'CVE-2023-0003',
                PkgName: 'medium-pkg',
                InstalledVersion: '3.0.0',
                FixedVersion: '3.0.1',
                Severity: 'MEDIUM',
                Title: 'Medium vulnerability'
              },
              {
                VulnerabilityID: 'CVE-2023-0004',
                PkgName: 'low-pkg',
                InstalledVersion: '4.0.0',
                FixedVersion: '4.0.1',
                Severity: 'LOW',
                Title: 'Low vulnerability'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      // Execute the workflow
      const parser = new TrivyParser();
      const results = parser.parse('trivy-results.json');

      // Simulate what index.js does - set outputs
      core.setOutput('total-vulnerabilities', results.counts.total);
      core.setOutput('critical-count', results.counts.critical);
      core.setOutput('high-count', results.counts.high);
      core.setOutput('medium-count', results.counts.medium);
      core.setOutput('low-count', results.counts.low);

      // Verify all outputs were set with correct values
      expect(core.setOutput).toHaveBeenCalledWith('total-vulnerabilities', 4);
      expect(core.setOutput).toHaveBeenCalledWith('critical-count', 1);
      expect(core.setOutput).toHaveBeenCalledWith('high-count', 1);
      expect(core.setOutput).toHaveBeenCalledWith('medium-count', 1);
      expect(core.setOutput).toHaveBeenCalledWith('low-count', 1);

      // Verify setOutput was called exactly 5 times
      expect(core.setOutput).toHaveBeenCalledTimes(5);
    });
  });
});
