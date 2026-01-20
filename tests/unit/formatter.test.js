const { CommentFormatter } = require('../../src/formatter');

describe('CommentFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new CommentFormatter();
  });

  describe('format()', () => {
    it('should format complete comment with header, summary, and table', () => {
      const results = {
        vulnerabilities: [
          {
            target: 'package-lock.json',
            id: 'CVE-2023-1234',
            package: 'lodash',
            type: 'npm',
            installedVersion: '4.17.19',
            fixedVersion: '4.17.21',
            severity: 'HIGH',
            title: 'Prototype Pollution'
          }
        ],
        counts: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          total: 1
        }
      };

      const result = formatter.format(results, 20);

      expect(result).toContain('## 🔒 Trivy Security Scan Report');
      expect(result).toContain('🟠 **1 HIGH** (1 total)');
      expect(result).toContain('### Vulnerability Details');
      expect(result).toContain('| 🟠 HIGH | lodash | npm | CVE-2023-1234 | 4.17.19 | 4.17.21 |');
    });

    it('should format comment with no vulnerabilities', () => {
      const results = {
        vulnerabilities: [],
        counts: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          total: 0
        }
      };

      const result = formatter.format(results, 20);

      expect(result).toContain('## 🔒 Trivy Security Scan Report');
      expect(result).toContain('✅ **No vulnerabilities found**');
      expect(result).not.toContain('### Vulnerability Details');
    });
  });

  describe('formatSummary()', () => {
    it('should return success message when no vulnerabilities', () => {
      const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      const result = formatter.formatSummary(counts);
      expect(result).toBe('✅ **No vulnerabilities found**\n\n');
    });

    it('should show red emoji for critical vulnerabilities', () => {
      const counts = { critical: 2, high: 1, medium: 0, low: 0, total: 3 };
      const result = formatter.formatSummary(counts);
      expect(result).toContain('🔴');
      expect(result).toContain('2 CRITICAL');
      expect(result).toContain('1 HIGH');
      expect(result).toContain('(3 total)');
    });

    it('should show orange emoji for high vulnerabilities without critical', () => {
      const counts = { critical: 0, high: 3, medium: 1, low: 0, total: 4 };
      const result = formatter.formatSummary(counts);
      expect(result).toContain('🟠');
      expect(result).toContain('3 HIGH');
      expect(result).toContain('1 MEDIUM');
      expect(result).not.toContain('CRITICAL');
    });

    it('should show yellow emoji for medium/low only', () => {
      const counts = { critical: 0, high: 0, medium: 2, low: 1, total: 3 };
      const result = formatter.formatSummary(counts);
      expect(result).toContain('🟡');
      expect(result).toContain('2 MEDIUM');
      expect(result).toContain('1 LOW');
    });

    it('should only include non-zero severity counts', () => {
      const counts = { critical: 1, high: 0, medium: 0, low: 2, total: 3 };
      const result = formatter.formatSummary(counts);
      expect(result).toContain('1 CRITICAL');
      expect(result).toContain('2 LOW');
      expect(result).not.toContain('HIGH');
      expect(result).not.toContain('MEDIUM');
    });
  });

  describe('formatTable()', () => {
    it('should return empty string for no vulnerabilities', () => {
      const result = formatter.formatTable([], 20);
      expect(result).toBe('');
    });

    it('should generate table with correct headers', () => {
      const vulnerabilities = [
        {
          id: 'CVE-2023-1234',
          package: 'lodash',
          type: 'npm',
          installedVersion: '4.17.19',
          fixedVersion: '4.17.21',
          severity: 'HIGH'
        }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      expect(result).toContain('### Vulnerability Details');
      expect(result).toContain('| Severity | Package | Type | Vulnerability | Installed | Fixed |');
      expect(result).toContain('|----------|---------|------|---------------|-----------|-------|');
    });

    it('should sort vulnerabilities by severity', () => {
      const vulnerabilities = [
        { id: 'CVE-1', package: 'pkg1', type: 'npm', installedVersion: '1.0', fixedVersion: '1.1', severity: 'LOW' },
        { id: 'CVE-2', package: 'pkg2', type: 'npm', installedVersion: '2.0', fixedVersion: '2.1', severity: 'CRITICAL' },
        { id: 'CVE-3', package: 'pkg3', type: 'npm', installedVersion: '3.0', fixedVersion: '3.1', severity: 'MEDIUM' },
        { id: 'CVE-4', package: 'pkg4', type: 'npm', installedVersion: '4.0', fixedVersion: '4.1', severity: 'HIGH' }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      
      expect(dataLines[0]).toContain('CRITICAL');
      expect(dataLines[1]).toContain('HIGH');
      expect(dataLines[2]).toContain('MEDIUM');
      expect(dataLines[3]).toContain('LOW');
    });

    it('should limit table to maxRows', () => {
      const vulnerabilities = Array.from({ length: 25 }, (_, i) => ({
        id: `CVE-2023-${i}`,
        package: `pkg${i}`,
        type: 'npm',
        installedVersion: '1.0.0',
        fixedVersion: '1.0.1',
        severity: 'HIGH'
      }));

      const result = formatter.formatTable(vulnerabilities, 10);

      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      
      expect(dataLines).toHaveLength(10);
    });

    it('should show overflow message when vulnerabilities exceed maxRows', () => {
      const vulnerabilities = Array.from({ length: 25 }, (_, i) => ({
        id: `CVE-2023-${i}`,
        package: `pkg${i}`,
        type: 'npm',
        installedVersion: '1.0.0',
        fixedVersion: '1.0.1',
        severity: 'HIGH'
      }));

      const result = formatter.formatTable(vulnerabilities, 20);

      expect(result).toContain('*... and 5 more*');
    });

    it('should not show overflow message when vulnerabilities equal maxRows', () => {
      const vulnerabilities = Array.from({ length: 20 }, (_, i) => ({
        id: `CVE-2023-${i}`,
        package: `pkg${i}`,
        type: 'npm',
        installedVersion: '1.0.0',
        fixedVersion: '1.0.1',
        severity: 'HIGH'
      }));

      const result = formatter.formatTable(vulnerabilities, 20);

      expect(result).not.toContain('and');
      expect(result).not.toContain('more');
    });

    it('should include severity emoji in table rows', () => {
      const vulnerabilities = [
        { id: 'CVE-1', package: 'pkg1', type: 'npm', installedVersion: '1.0', fixedVersion: '1.1', severity: 'CRITICAL' },
        { id: 'CVE-2', package: 'pkg2', type: 'gem', installedVersion: '2.0', fixedVersion: '2.1', severity: 'HIGH' },
        { id: 'CVE-3', package: 'pkg3', type: 'pip', installedVersion: '3.0', fixedVersion: '3.1', severity: 'MEDIUM' },
        { id: 'CVE-4', package: 'pkg4', type: 'npm', installedVersion: '4.0', fixedVersion: '4.1', severity: 'LOW' }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      expect(result).toContain('🔴 CRITICAL');
      expect(result).toContain('🟠 HIGH');
      expect(result).toContain('🟡 MEDIUM');
      expect(result).toContain('⚪ LOW');
    });
  });

  describe('getSummaryEmoji()', () => {
    it('should return red emoji for critical vulnerabilities', () => {
      const counts = { critical: 1, high: 0, medium: 0, low: 0, total: 1 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🔴');
    });

    it('should return red emoji when critical and other severities exist', () => {
      const counts = { critical: 1, high: 2, medium: 3, low: 4, total: 10 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🔴');
    });

    it('should return orange emoji for high without critical', () => {
      const counts = { critical: 0, high: 1, medium: 0, low: 0, total: 1 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🟠');
    });

    it('should return yellow emoji for medium only', () => {
      const counts = { critical: 0, high: 0, medium: 1, low: 0, total: 1 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🟡');
    });

    it('should return yellow emoji for low only', () => {
      const counts = { critical: 0, high: 0, medium: 0, low: 1, total: 1 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🟡');
    });

    it('should return yellow emoji for medium and low', () => {
      const counts = { critical: 0, high: 0, medium: 2, low: 3, total: 5 };
      expect(formatter.getSummaryEmoji(counts)).toBe('🟡');
    });

    it('should return success emoji for zero vulnerabilities', () => {
      const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      expect(formatter.getSummaryEmoji(counts)).toBe('✅');
    });
  });

  describe('getSeverityEmoji()', () => {
    it('should return correct emoji for CRITICAL', () => {
      expect(formatter.getSeverityEmoji('CRITICAL')).toBe('🔴');
    });

    it('should return correct emoji for HIGH', () => {
      expect(formatter.getSeverityEmoji('HIGH')).toBe('🟠');
    });

    it('should return correct emoji for MEDIUM', () => {
      expect(formatter.getSeverityEmoji('MEDIUM')).toBe('🟡');
    });

    it('should return correct emoji for LOW', () => {
      expect(formatter.getSeverityEmoji('LOW')).toBe('⚪');
    });

    it('should return empty string for unknown severity', () => {
      expect(formatter.getSeverityEmoji('UNKNOWN')).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle default max rows value of 20', () => {
      // Create 25 vulnerabilities
      const vulnerabilities = Array.from({ length: 25 }, (_, i) => ({
        id: `CVE-2023-${i}`,
        package: `pkg${i}`,
        type: 'npm',
        installedVersion: '1.0.0',
        fixedVersion: '1.0.1',
        severity: 'HIGH'
      }));

      // Format with default max rows (20)
      const result = formatter.formatTable(vulnerabilities, 20);

      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      
      // Should show exactly 20 rows
      expect(dataLines).toHaveLength(20);
      
      // Should show overflow message for remaining 5
      expect(result).toContain('*... and 5 more*');
    });

    it('should handle vulnerabilities with pipe characters in fields', () => {
      const vulnerabilities = [
        {
          id: 'CVE-2023-1234',
          package: 'pkg|name',
          type: 'npm',
          installedVersion: '1.0|beta',
          fixedVersion: '1.1|stable',
          severity: 'HIGH'
        }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      // Should escape pipe characters
      expect(result).toContain('pkg\\|name');
      expect(result).toContain('1.0\\|beta');
      expect(result).toContain('1.1\\|stable');
      
      // Should still be valid markdown table (7 unescaped pipes per row for 6 columns)
      const lines = result.split('\n');
      const dataLine = lines.find(line => line.includes('CVE-2023-1234'));
      const unescapedPipes = (dataLine.match(/(?<!\\)\|/g) || []).length;
      expect(unescapedPipes).toBe(7);
    });

    it('should handle empty string fields', () => {
      const vulnerabilities = [
        {
          id: '',
          package: '',
          type: '',
          installedVersion: '',
          fixedVersion: '',
          severity: 'HIGH'
        }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      // Should still generate valid table
      expect(result).toContain('### Vulnerability Details');
      expect(result).toContain('🟠 HIGH');
      
      // Should have proper table structure
      const lines = result.split('\n');
      const dataLine = lines.find(line => line.includes('🟠 HIGH'));
      expect(dataLine).toContain('|');
    });

    it('should handle single vulnerability', () => {
      const vulnerabilities = [
        {
          id: 'CVE-2023-1234',
          package: 'lodash',
          type: 'npm',
          installedVersion: '4.17.19',
          fixedVersion: '4.17.21',
          severity: 'CRITICAL'
        }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      // Should generate table with one row
      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      expect(dataLines).toHaveLength(1);
      
      // Should not show overflow message
      expect(result).not.toContain('more');
    });

    it('should handle very large vulnerability count', () => {
      // Create 1000 vulnerabilities
      const vulnerabilities = Array.from({ length: 1000 }, (_, i) => ({
        id: `CVE-2023-${i}`,
        package: `pkg${i}`,
        type: 'npm',
        installedVersion: '1.0.0',
        fixedVersion: '1.0.1',
        severity: i % 4 === 0 ? 'CRITICAL' : i % 4 === 1 ? 'HIGH' : i % 4 === 2 ? 'MEDIUM' : 'LOW'
      }));

      const result = formatter.formatTable(vulnerabilities, 20);

      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      
      // Should limit to 20 rows
      expect(dataLines).toHaveLength(20);
      
      // Should show overflow message for remaining 980
      expect(result).toContain('*... and 980 more*');
    });

    it('should handle mixed severity levels correctly', () => {
      const vulnerabilities = [
        { id: 'CVE-1', package: 'pkg1', type: 'npm', installedVersion: '1.0', fixedVersion: '1.1', severity: 'LOW' },
        { id: 'CVE-2', package: 'pkg2', type: 'npm', installedVersion: '2.0', fixedVersion: '2.1', severity: 'CRITICAL' },
        { id: 'CVE-3', package: 'pkg3', type: 'npm', installedVersion: '3.0', fixedVersion: '3.1', severity: 'MEDIUM' },
        { id: 'CVE-4', package: 'pkg4', type: 'npm', installedVersion: '4.0', fixedVersion: '4.1', severity: 'HIGH' },
        { id: 'CVE-5', package: 'pkg5', type: 'npm', installedVersion: '5.0', fixedVersion: '5.1', severity: 'CRITICAL' },
        { id: 'CVE-6', package: 'pkg6', type: 'npm', installedVersion: '6.0', fixedVersion: '6.1', severity: 'LOW' }
      ];

      const counts = {
        critical: 2,
        high: 1,
        medium: 1,
        low: 2,
        total: 6
      };

      const results = {
        vulnerabilities,
        counts
      };

      const formatted = formatter.format(results, 20);

      // Should show all severity levels in summary
      expect(formatted).toContain('2 CRITICAL');
      expect(formatted).toContain('1 HIGH');
      expect(formatted).toContain('1 MEDIUM');
      expect(formatted).toContain('2 LOW');
      
      // Should use red emoji as primary (highest severity)
      expect(formatted).toMatch(/^## 🔒 Trivy Security Scan Report\n\n🔴/);
    });

    it('should handle maxRows of 1', () => {
      const vulnerabilities = [
        { id: 'CVE-1', package: 'pkg1', type: 'npm', installedVersion: '1.0', fixedVersion: '1.1', severity: 'HIGH' },
        { id: 'CVE-2', package: 'pkg2', type: 'npm', installedVersion: '2.0', fixedVersion: '2.1', severity: 'HIGH' }
      ];

      const result = formatter.formatTable(vulnerabilities, 1);

      const lines = result.split('\n');
      const dataLines = lines.filter(line => line.includes('CVE-'));
      
      // Should show exactly 1 row
      expect(dataLines).toHaveLength(1);
      
      // Should show overflow message
      expect(result).toContain('*... and 1 more*');
    });

    it('should handle special characters in vulnerability fields', () => {
      const vulnerabilities = [
        {
          id: 'CVE-2023-1234',
          package: 'pkg<script>alert("xss")</script>',
          type: 'npm',
          installedVersion: '1.0 & 2.0',
          fixedVersion: '3.0 > 2.0',
          severity: 'HIGH'
        }
      ];

      const result = formatter.formatTable(vulnerabilities, 20);

      // Should include the special characters (markdown will handle escaping)
      expect(result).toContain('pkg<script>alert("xss")</script>');
      expect(result).toContain('1.0 & 2.0');
      expect(result).toContain('3.0 > 2.0');
    });
  });
});
