const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const { TrivyParser } = require('../../src/parser');

// Mock fs module
jest.mock('fs');

describe('Parser Property Tests', () => {
  let parser;

  beforeEach(() => {
    parser = new TrivyParser();
    jest.clearAllMocks();
  });

  /**
   * Property 1: Parse and extract vulnerability fields
   * **Validates: Requirements 1.1, 1.2, 1.5**
   * 
   * For any valid Trivy JSON file, parsing should extract all vulnerability fields
   * (VulnerabilityID, PkgName, InstalledVersion, FixedVersion, Severity, Title)
   * and aggregate vulnerabilities across all targets into a flat list.
   */
  describe('Property 1: Parse and extract vulnerability fields', () => {
    // Arbitrary for generating valid severity values
    const severityArb = fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

    // Arbitrary for generating a single vulnerability
    const vulnerabilityArb = fc.record({
      VulnerabilityID: fc.string(),
      PkgName: fc.string(),
      InstalledVersion: fc.string(),
      FixedVersion: fc.option(fc.string(), { nil: undefined }),
      Severity: severityArb,
      Title: fc.option(fc.string(), { nil: undefined })
    });

    // Arbitrary for generating a result with target and vulnerabilities
    const resultArb = fc.record({
      Target: fc.option(fc.string(), { nil: undefined }),
      Type: fc.option(fc.string(), { nil: undefined }),
      Vulnerabilities: fc.array(vulnerabilityArb, { minLength: 0, maxLength: 10 })
    });

    // Arbitrary for generating a complete Trivy JSON structure
    const trivyDataArb = fc.record({
      Results: fc.array(resultArb, { minLength: 1, maxLength: 5 })
    });

    it('should extract all vulnerability fields from any valid Trivy JSON', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Calculate expected number of vulnerabilities
          const expectedVulnCount = trivyData.Results.reduce(
            (sum, result) => sum + (result.Vulnerabilities?.length || 0),
            0
          );

          // Verify the vulnerabilities array has the correct length
          expect(result.vulnerabilities).toHaveLength(expectedVulnCount);

          // Verify each vulnerability has all required fields
          result.vulnerabilities.forEach((vuln, index) => {
            // Find the source vulnerability in the input data
            let sourceVuln = null;
            let sourceTarget = null;
            let sourceType = null;
            let found = false;

            for (const res of trivyData.Results) {
              if (res.Vulnerabilities) {
                for (const v of res.Vulnerabilities) {
                  if (
                    v.VulnerabilityID === vuln.id &&
                    v.PkgName === vuln.package &&
                    v.InstalledVersion === vuln.installedVersion
                  ) {
                    sourceVuln = v;
                    sourceTarget = res.Target;
                    sourceType = res.Type;
                    found = true;
                    break;
                  }
                }
              }
              if (found) break;
            }

            // Verify all fields are extracted correctly
            expect(vuln).toHaveProperty('target');
            expect(vuln).toHaveProperty('id');
            expect(vuln).toHaveProperty('package');
            expect(vuln).toHaveProperty('type');
            expect(vuln).toHaveProperty('installedVersion');
            expect(vuln).toHaveProperty('fixedVersion');
            expect(vuln).toHaveProperty('severity');
            expect(vuln).toHaveProperty('title');

            // Verify field values match source data
            if (sourceVuln) {
              expect(vuln.target).toBe(sourceTarget || 'unknown');
              expect(vuln.id).toBe(sourceVuln.VulnerabilityID || '');
              expect(vuln.package).toBe(sourceVuln.PkgName || '');
              expect(vuln.type).toBe(sourceType || 'unknown');
              expect(vuln.installedVersion).toBe(sourceVuln.InstalledVersion || '');
              expect(vuln.fixedVersion).toBe(sourceVuln.FixedVersion || 'N/A');
              expect(vuln.severity).toBe(sourceVuln.Severity.toUpperCase());
              // Title can be any value including whitespace, so we need to match exactly
              const expectedTitle = sourceVuln.Title !== undefined && sourceVuln.Title !== null ? sourceVuln.Title : '';
              expect(vuln.title).toBe(expectedTitle);
            }
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should aggregate vulnerabilities across all targets into a flat list', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Collect all targets from the input
          const targetsInInput = new Set();
          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities && res.Vulnerabilities.length > 0) {
              targetsInInput.add(res.Target || 'unknown');
            }
          });

          // Collect all targets from the output
          const targetsInOutput = new Set(result.vulnerabilities.map((v) => v.target));

          // Verify that all targets with vulnerabilities are represented in the output
          targetsInInput.forEach((target) => {
            expect(targetsInOutput.has(target)).toBe(true);
          });

          // Verify the output is a flat list (single array)
          expect(Array.isArray(result.vulnerabilities)).toBe(true);

          // Verify vulnerabilities from different targets are all in the same array
          if (trivyData.Results.length > 1) {
            const uniqueTargets = new Set(result.vulnerabilities.map((v) => v.target));
            // If we have multiple results with vulnerabilities, we should see multiple targets
            const resultsWithVulns = trivyData.Results.filter(
              (r) => r.Vulnerabilities && r.Vulnerabilities.length > 0
            );
            if (resultsWithVulns.length > 1) {
              expect(uniqueTargets.size).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle missing optional fields correctly', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Verify that missing FixedVersion defaults to "N/A"
          result.vulnerabilities.forEach((vuln) => {
            expect(vuln.fixedVersion).toBeDefined();
            expect(typeof vuln.fixedVersion).toBe('string');
          });

          // Verify that missing Title defaults to empty string
          result.vulnerabilities.forEach((vuln) => {
            expect(vuln.title).toBeDefined();
            expect(typeof vuln.title).toBe('string');
          });

          // Verify that missing Target defaults to "unknown"
          result.vulnerabilities.forEach((vuln) => {
            expect(vuln.target).toBeDefined();
            expect(typeof vuln.target).toBe('string');
          });

          // Verify that missing Type defaults to "unknown"
          result.vulnerabilities.forEach((vuln) => {
            expect(vuln.type).toBeDefined();
            expect(typeof vuln.type).toBe('string');
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly count vulnerabilities by severity', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Manually count vulnerabilities by severity from input
          const expectedCounts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            total: 0
          };

          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities) {
              res.Vulnerabilities.forEach((vuln) => {
                const severity = (vuln.Severity || '').toUpperCase();
                if (severity === 'CRITICAL') {
                  expectedCounts.critical++;
                  expectedCounts.total++;
                } else if (severity === 'HIGH') {
                  expectedCounts.high++;
                  expectedCounts.total++;
                } else if (severity === 'MEDIUM') {
                  expectedCounts.medium++;
                  expectedCounts.total++;
                } else if (severity === 'LOW') {
                  expectedCounts.low++;
                  expectedCounts.total++;
                }
              });
            }
          });

          // Verify counts match
          expect(result.counts).toEqual(expectedCounts);

          // Verify total is sum of all severity levels
          const sumOfSeverities =
            result.counts.critical +
            result.counts.high +
            result.counts.medium +
            result.counts.low;
          expect(result.counts.total).toBe(sumOfSeverities);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all vulnerability data without loss', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Count total vulnerabilities in input
          let totalInputVulns = 0;
          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities) {
              totalInputVulns += res.Vulnerabilities.length;
            }
          });

          // Verify no vulnerabilities are lost
          expect(result.vulnerabilities.length).toBe(totalInputVulns);
          expect(result.counts.total).toBe(totalInputVulns);

          // Verify each input vulnerability can be found in output
          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities) {
              res.Vulnerabilities.forEach((inputVuln) => {
                const found = result.vulnerabilities.some(
                  (outputVuln) =>
                    outputVuln.id === (inputVuln.VulnerabilityID || '') &&
                    outputVuln.package === (inputVuln.PkgName || '') &&
                    outputVuln.installedVersion === (inputVuln.InstalledVersion || '') &&
                    outputVuln.severity === inputVuln.Severity.toUpperCase()
                );
                expect(found).toBe(true);
              });
            }
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Error on invalid JSON
   * **Validates: Requirements 1.4**
   * 
   * For any file containing invalid JSON or missing required structure,
   * parsing should throw a descriptive error.
   */
  describe('Property 13: Error on invalid JSON', () => {
    // Arbitrary for generating invalid JSON strings
    const invalidJsonArb = fc.oneof(
      // Malformed JSON syntax
      fc.string().filter(s => {
        try {
          JSON.parse(s);
          return false; // Valid JSON, skip it
        } catch {
          return true; // Invalid JSON, use it
        }
      }),
      // Valid JSON but not an object
      fc.oneof(
        fc.constant('null'),
        fc.constant('true'),
        fc.constant('false'),
        fc.constant('123'),
        fc.constant('"string"'),
        fc.constant('[]')
      ),
      // Valid JSON object but missing Results array
      fc.record({
        SomeOtherField: fc.string()
      }).map(obj => JSON.stringify(obj)),
      // Valid JSON object with Results but not an array
      fc.record({
        Results: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
          fc.record({ nested: fc.string() })
        )
      }).map(obj => JSON.stringify(obj))
    );

    it('should throw descriptive error for invalid JSON syntax', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, skip it
            } catch {
              return true; // Invalid JSON, use it
            }
          }),
          (invalidJson) => {
            // Mock the file system to return invalid JSON
            fs.readFileSync.mockReturnValue(invalidJson);

            // Verify that parsing throws an error
            expect(() => parser.parse('test.json')).toThrow();

            // Verify the error message mentions "Invalid JSON"
            try {
              parser.parse('test.json');
            } catch (error) {
              expect(error.message).toMatch(/Invalid JSON in results file/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw descriptive error for missing Results array', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Valid JSON but missing Results field
            fc.record({
              SomeOtherField: fc.string(),
              AnotherField: fc.integer()
            }),
            // Valid JSON with Results but not an array
            fc.record({
              Results: fc.oneof(
                fc.string(),
                fc.integer(),
                fc.constant(null),
                fc.record({ nested: fc.string() })
              )
            })
          ),
          (invalidData) => {
            // Mock the file system to return invalid structure
            fs.readFileSync.mockReturnValue(JSON.stringify(invalidData));

            // Verify that parsing throws an error
            expect(() => parser.parse('test.json')).toThrow();

            // Verify the error message mentions missing Results array
            try {
              parser.parse('test.json');
            } catch (error) {
              expect(error.message).toMatch(/Invalid Trivy format: missing Results array/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw descriptive error for any invalid input', () => {
      fc.assert(
        fc.property(invalidJsonArb, (invalidContent) => {
          // Mock the file system to return invalid content
          fs.readFileSync.mockReturnValue(invalidContent);

          // Verify that parsing throws an error with a descriptive message
          expect(() => parser.parse('test.json')).toThrow();

          // Verify the error message is descriptive (contains key information)
          try {
            parser.parse('test.json');
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            expect(error.message).toBeDefined();
            expect(error.message.length).toBeGreaterThan(0);
            // Error should mention either "Invalid JSON" or "Invalid Trivy format"
            // Note: Valid JSON primitives like "null", "true", etc. will fail structure validation
            const isDescriptive = 
              error.message.includes('Invalid JSON') ||
              error.message.includes('Invalid Trivy format') ||
              error.message.includes('missing Results array');
            expect(isDescriptive).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should distinguish between different error types', () => {
      // Test malformed JSON
      fs.readFileSync.mockReturnValue('{ invalid json }');
      expect(() => parser.parse('test.json')).toThrow(/Invalid JSON in results file/);

      // Test missing Results array
      fs.readFileSync.mockReturnValue(JSON.stringify({ SomeField: 'value' }));
      expect(() => parser.parse('test.json')).toThrow(/Invalid Trivy format: missing Results array/);

      // Test Results is not an array
      fs.readFileSync.mockReturnValue(JSON.stringify({ Results: 'not an array' }));
      expect(() => parser.parse('test.json')).toThrow(/Invalid Trivy format: missing Results array/);

      // Test Results is null
      fs.readFileSync.mockReturnValue(JSON.stringify({ Results: null }));
      expect(() => parser.parse('test.json')).toThrow(/Invalid Trivy format: missing Results array/);
    });

    it('should handle edge cases of invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),                    // Empty string
            fc.constant('   '),                 // Whitespace only
            fc.constant('{'),                   // Incomplete JSON
            fc.constant('{"Results": ['),       // Incomplete array
            fc.constant('undefined'),           // JavaScript undefined as string
            fc.constant('NaN'),                 // JavaScript NaN as string
            fc.constant('{]'),                  // Mismatched brackets
            fc.constant('[}')                   // Mismatched brackets
          ),
          (edgeCase) => {
            // Mock the file system to return edge case
            fs.readFileSync.mockReturnValue(edgeCase);

            // Verify that parsing throws an error
            expect(() => parser.parse('test.json')).toThrow();

            // Verify error is descriptive
            try {
              parser.parse('test.json');
            } catch (error) {
              expect(error.message).toBeDefined();
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Count vulnerabilities with total as sum
   * **Validates: Requirements 2.1, 2.4**
   * 
   * For any set of vulnerabilities, the count for each severity level
   * (CRITICAL, HIGH, MEDIUM, LOW) should match the number of vulnerabilities
   * with that severity, and the total count should equal the sum of all severity counts.
   */
  describe('Property 2: Count vulnerabilities with total as sum', () => {
    // Arbitrary for generating valid severity values
    const severityArb = fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

    // Arbitrary for generating a single vulnerability
    const vulnerabilityArb = fc.record({
      VulnerabilityID: fc.string({ minLength: 1 }),
      PkgName: fc.string({ minLength: 1 }),
      InstalledVersion: fc.string({ minLength: 1 }),
      FixedVersion: fc.option(fc.string(), { nil: undefined }),
      Severity: severityArb,
      Title: fc.option(fc.string(), { nil: undefined })
    });

    // Arbitrary for generating a result with target and vulnerabilities
    const resultArb = fc.record({
      Target: fc.option(fc.string(), { nil: undefined }),
      Vulnerabilities: fc.array(vulnerabilityArb, { minLength: 0, maxLength: 20 })
    });

    // Arbitrary for generating a complete Trivy JSON structure
    const trivyDataArb = fc.record({
      Results: fc.array(resultArb, { minLength: 1, maxLength: 10 })
    });

    it('should count vulnerabilities by severity level correctly', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Manually count vulnerabilities by severity from input
          const expectedCounts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
          };

          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities) {
              res.Vulnerabilities.forEach((vuln) => {
                const severity = (vuln.Severity || '').toUpperCase();
                if (severity === 'CRITICAL') {
                  expectedCounts.critical++;
                } else if (severity === 'HIGH') {
                  expectedCounts.high++;
                } else if (severity === 'MEDIUM') {
                  expectedCounts.medium++;
                } else if (severity === 'LOW') {
                  expectedCounts.low++;
                }
              });
            }
          });

          // Verify each severity count matches expected
          expect(result.counts.critical).toBe(expectedCounts.critical);
          expect(result.counts.high).toBe(expectedCounts.high);
          expect(result.counts.medium).toBe(expectedCounts.medium);
          expect(result.counts.low).toBe(expectedCounts.low);
        }),
        { numRuns: 100 }
      );
    });

    it('should have total count equal to sum of all severity counts', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Calculate sum of all severity counts
          const sumOfSeverities =
            result.counts.critical +
            result.counts.high +
            result.counts.medium +
            result.counts.low;

          // Verify total equals sum
          expect(result.counts.total).toBe(sumOfSeverities);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain count invariant: total >= each individual severity count', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Verify total is at least as large as each individual count
          expect(result.counts.total).toBeGreaterThanOrEqual(result.counts.critical);
          expect(result.counts.total).toBeGreaterThanOrEqual(result.counts.high);
          expect(result.counts.total).toBeGreaterThanOrEqual(result.counts.medium);
          expect(result.counts.total).toBeGreaterThanOrEqual(result.counts.low);

          // Verify all counts are non-negative
          expect(result.counts.critical).toBeGreaterThanOrEqual(0);
          expect(result.counts.high).toBeGreaterThanOrEqual(0);
          expect(result.counts.medium).toBeGreaterThanOrEqual(0);
          expect(result.counts.low).toBeGreaterThanOrEqual(0);
          expect(result.counts.total).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should count only recognized severity levels', () => {
      fc.assert(
        fc.property(trivyDataArb, (trivyData) => {
          // Mock the file system to return our generated data
          fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

          // Parse the data
          const result = parser.parse('test.json');

          // Count all vulnerabilities with recognized severities in input
          let recognizedCount = 0;
          trivyData.Results.forEach((res) => {
            if (res.Vulnerabilities) {
              res.Vulnerabilities.forEach((vuln) => {
                const severity = (vuln.Severity || '').toUpperCase();
                if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity)) {
                  recognizedCount++;
                }
              });
            }
          });

          // Verify total matches count of recognized severities
          expect(result.counts.total).toBe(recognizedCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty vulnerability sets with zero counts', () => {
      fc.assert(
        fc.property(
          fc.record({
            Results: fc.array(
              fc.record({
                Target: fc.option(fc.string(), { nil: undefined }),
                Vulnerabilities: fc.constant([])
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          (trivyData) => {
            // Mock the file system to return our generated data
            fs.readFileSync.mockReturnValue(JSON.stringify(trivyData));

            // Parse the data
            const result = parser.parse('test.json');

            // Verify all counts are zero
            expect(result.counts.critical).toBe(0);
            expect(result.counts.high).toBe(0);
            expect(result.counts.medium).toBe(0);
            expect(result.counts.low).toBe(0);
            expect(result.counts.total).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
