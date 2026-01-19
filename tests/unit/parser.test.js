const fs = require('fs');
const path = require('path');
const { TrivyParser } = require('../../src/parser');

// Mock fs module
jest.mock('fs');

describe('TrivyParser', () => {
  let parser;

  beforeEach(() => {
    parser = new TrivyParser();
    jest.clearAllMocks();
  });

  describe('parse()', () => {
    it('should parse valid Trivy JSON with vulnerabilities', () => {
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
                Title: 'Prototype Pollution in lodash'
              },
              {
                VulnerabilityID: 'CVE-2023-5678',
                PkgName: 'axios',
                InstalledVersion: '0.21.0',
                FixedVersion: '0.21.2',
                Severity: 'CRITICAL',
                Title: 'Server-Side Request Forgery'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.vulnerabilities[0]).toEqual({
        target: 'package-lock.json',
        type: 'npm',
        id: 'CVE-2023-1234',
        package: 'lodash',
        installedVersion: '4.17.19',
        fixedVersion: '4.17.21',
        severity: 'HIGH',
        title: 'Prototype Pollution in lodash'
      });
      expect(result.counts).toEqual({
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
        total: 2
      });
    });

    it('should handle empty results (no vulnerabilities)', () => {
      const trivyData = {
        Results: []
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.counts).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      });
    });

    it('should handle results with no Vulnerabilities array', () => {
      const trivyData = {
        Results: [
          {
            Target: 'package-lock.json'
            // No Vulnerabilities array
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.counts.total).toBe(0);
    });

    it('should default FixedVersion to "N/A" when missing', () => {
      const trivyData = {
        Results: [
          {
            Target: 'Dockerfile',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-9999',
                PkgName: 'openssl',
                InstalledVersion: '1.1.1',
                // No FixedVersion
                Severity: 'MEDIUM',
                Title: 'OpenSSL vulnerability'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities[0].fixedVersion).toBe('N/A');
    });

    it('should handle missing optional fields', () => {
      const trivyData = {
        Results: [
          {
            // No Target
            Vulnerabilities: [
              {
                // Minimal vulnerability data
                Severity: 'LOW'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities[0]).toEqual({
        target: 'unknown',
        type: 'unknown',
        id: '',
        package: '',
        installedVersion: '',
        fixedVersion: 'N/A',
        severity: 'LOW',
        title: ''
      });
      expect(result.counts.low).toBe(1);
    });

    it('should ignore vulnerabilities with unrecognized severity', () => {
      const trivyData = {
        Results: [
          {
            Target: 'test',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-1111',
                PkgName: 'pkg1',
                InstalledVersion: '1.0.0',
                Severity: 'HIGH',
                Title: 'Valid vulnerability'
              },
              {
                VulnerabilityID: 'CVE-2023-2222',
                PkgName: 'pkg2',
                InstalledVersion: '2.0.0',
                Severity: 'UNKNOWN',
                Title: 'Invalid severity'
              },
              {
                VulnerabilityID: 'CVE-2023-3333',
                PkgName: 'pkg3',
                InstalledVersion: '3.0.0',
                Severity: '',
                Title: 'Empty severity'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].id).toBe('CVE-2023-1111');
      expect(result.counts.total).toBe(1);
    });

    it('should aggregate vulnerabilities across multiple targets', () => {
      const trivyData = {
        Results: [
          {
            Target: 'package-lock.json',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-1111',
                PkgName: 'pkg1',
                InstalledVersion: '1.0.0',
                Severity: 'CRITICAL',
                Title: 'Critical vuln'
              }
            ]
          },
          {
            Target: 'Dockerfile',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2023-2222',
                PkgName: 'pkg2',
                InstalledVersion: '2.0.0',
                Severity: 'HIGH',
                Title: 'High vuln'
              }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.vulnerabilities[0].target).toBe('package-lock.json');
      expect(result.vulnerabilities[1].target).toBe('Dockerfile');
      expect(result.counts.total).toBe(2);
    });

    it('should count all severity levels correctly', () => {
      const trivyData = {
        Results: [
          {
            Target: 'test',
            Vulnerabilities: [
              { Severity: 'CRITICAL', VulnerabilityID: 'CVE-1', PkgName: 'pkg1', InstalledVersion: '1.0' },
              { Severity: 'CRITICAL', VulnerabilityID: 'CVE-2', PkgName: 'pkg2', InstalledVersion: '1.0' },
              { Severity: 'HIGH', VulnerabilityID: 'CVE-3', PkgName: 'pkg3', InstalledVersion: '1.0' },
              { Severity: 'HIGH', VulnerabilityID: 'CVE-4', PkgName: 'pkg4', InstalledVersion: '1.0' },
              { Severity: 'HIGH', VulnerabilityID: 'CVE-5', PkgName: 'pkg5', InstalledVersion: '1.0' },
              { Severity: 'MEDIUM', VulnerabilityID: 'CVE-6', PkgName: 'pkg6', InstalledVersion: '1.0' },
              { Severity: 'LOW', VulnerabilityID: 'CVE-7', PkgName: 'pkg7', InstalledVersion: '1.0' }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.counts).toEqual({
        critical: 2,
        high: 3,
        medium: 1,
        low: 1,
        total: 7
      });
    });

    it('should normalize severity to uppercase', () => {
      const trivyData = {
        Results: [
          {
            Target: 'test',
            Vulnerabilities: [
              { Severity: 'high', VulnerabilityID: 'CVE-1', PkgName: 'pkg1', InstalledVersion: '1.0' },
              { Severity: 'Critical', VulnerabilityID: 'CVE-2', PkgName: 'pkg2', InstalledVersion: '1.0' },
              { Severity: 'MeDiUm', VulnerabilityID: 'CVE-3', PkgName: 'pkg3', InstalledVersion: '1.0' }
            ]
          }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

      const result = parser.parse('test.json');

      expect(result.vulnerabilities[0].severity).toBe('HIGH');
      expect(result.vulnerabilities[1].severity).toBe('CRITICAL');
      expect(result.vulnerabilities[2].severity).toBe('MEDIUM');
      expect(result.counts.total).toBe(3);
    });

    it('should throw error when file not found', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => parser.parse('nonexistent.json')).toThrow('Results file not found: nonexistent.json');
    });

    it('should throw error when JSON is invalid', () => {
      fs.readFileSync.mockReturnValue('{ invalid json }');

      expect(() => parser.parse('invalid.json')).toThrow(/Invalid JSON in results file/);
    });

    it('should throw error when Results array is missing', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ SomeOtherField: 'value' }));

      expect(() => parser.parse('test.json')).toThrow('Invalid Trivy format: missing Results array');
    });

    it('should throw error when Results is not an array', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ Results: 'not an array' }));

      expect(() => parser.parse('test.json')).toThrow('Invalid Trivy format: missing Results array');
    });
  });
});
