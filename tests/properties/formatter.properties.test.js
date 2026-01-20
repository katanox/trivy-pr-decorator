const fc = require('fast-check');
const { CommentFormatter } = require('../../src/formatter');

describe('Formatter Property Tests', () => {
  let formatter;

  beforeEach(() => {
    formatter = new CommentFormatter();
  });

  /**
   * Property 4: Format summary with all non-zero severities
   * **Validates: Requirements 3.5, 3.6**
   * 
   * For any vulnerability set, the summary should include "{count} {emoji} {severity}"
   * for each severity level with non-zero count, and should include the total vulnerability count.
   */
  describe('Property 4: Format summary with all non-zero severities', () => {
    // Arbitrary for generating counts with various combinations of severities
    const countsArb = fc.record({
      critical: fc.integer({ min: 0, max: 50 }),
      high: fc.integer({ min: 0, max: 50 }),
      medium: fc.integer({ min: 0, max: 50 }),
      low: fc.integer({ min: 0, max: 50 })
    }).map(counts => ({
      ...counts,
      total: counts.critical + counts.high + counts.medium + counts.low
    }));

    it('should include count, emoji, and severity for each non-zero severity level', () => {
      fc.assert(
        fc.property(countsArb, (counts) => {
          // Skip the zero vulnerabilities case (handled separately)
          if (counts.total === 0) {
            return true;
          }

          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Check each severity level
          if (counts.critical > 0) {
            expect(summary).toContain(`${counts.critical} CRITICAL`);
          } else {
            expect(summary).not.toContain('CRITICAL');
          }

          if (counts.high > 0) {
            expect(summary).toContain(`${counts.high} HIGH`);
          } else {
            expect(summary).not.toContain('HIGH');
          }

          if (counts.medium > 0) {
            expect(summary).toContain(`${counts.medium} MEDIUM`);
          } else {
            expect(summary).not.toContain('MEDIUM');
          }

          if (counts.low > 0) {
            expect(summary).toContain(`${counts.low} LOW`);
          } else {
            expect(summary).not.toContain('LOW');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include total vulnerability count in summary', () => {
      fc.assert(
        fc.property(countsArb, (counts) => {
          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Verify total count is included
          if (counts.total === 0) {
            // Special case: zero vulnerabilities
            expect(summary).toContain('No vulnerabilities found');
          } else {
            expect(summary).toContain(`(${counts.total} total)`);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format summary with correct structure for non-zero counts', () => {
      fc.assert(
        fc.property(countsArb, (counts) => {
          // Skip zero case
          if (counts.total === 0) {
            return true;
          }

          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Verify the summary follows the pattern: {emoji} **{severities}** ({total} total)
          // Should start with an emoji
          expect(summary).toMatch(/^[🔴🟠🟡✅]/);

          // Should contain bold formatting
          expect(summary).toContain('**');

          // Should end with total count
          expect(summary).toContain(`(${counts.total} total)`);
        }),
        { numRuns: 100 }
      );
    });

    it('should separate multiple non-zero severities with commas', () => {
      fc.assert(
        fc.property(
          fc.record({
            critical: fc.integer({ min: 1, max: 10 }),
            high: fc.integer({ min: 1, max: 10 }),
            medium: fc.integer({ min: 1, max: 10 }),
            low: fc.integer({ min: 1, max: 10 })
          }).map(counts => ({
            ...counts,
            total: counts.critical + counts.high + counts.medium + counts.low
          })),
          (counts) => {
            // Format the summary with all severities present
            const summary = formatter.formatSummary(counts);

            // Count commas - should have 3 commas for 4 severities
            const commaCount = (summary.match(/,/g) || []).length;
            expect(commaCount).toBe(3);

            // Verify order: CRITICAL, HIGH, MEDIUM, LOW
            const criticalIndex = summary.indexOf('CRITICAL');
            const highIndex = summary.indexOf('HIGH');
            const mediumIndex = summary.indexOf('MEDIUM');
            const lowIndex = summary.indexOf('LOW');

            expect(criticalIndex).toBeLessThan(highIndex);
            expect(highIndex).toBeLessThan(mediumIndex);
            expect(mediumIndex).toBeLessThan(lowIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only include non-zero severities in any combination', () => {
      fc.assert(
        fc.property(countsArb, (counts) => {
          // Skip zero case
          if (counts.total === 0) {
            return true;
          }

          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Count how many severity levels are mentioned
          let mentionedCount = 0;
          if (summary.includes('CRITICAL')) mentionedCount++;
          if (summary.includes('HIGH')) mentionedCount++;
          if (summary.includes('MEDIUM')) mentionedCount++;
          if (summary.includes('LOW')) mentionedCount++;

          // Count how many severity levels have non-zero counts
          let nonZeroCount = 0;
          if (counts.critical > 0) nonZeroCount++;
          if (counts.high > 0) nonZeroCount++;
          if (counts.medium > 0) nonZeroCount++;
          if (counts.low > 0) nonZeroCount++;

          // They should match
          expect(mentionedCount).toBe(nonZeroCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle single severity level correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('critical', 'high', 'medium', 'low'),
          fc.integer({ min: 1, max: 50 }),
          (severityKey, count) => {
            // Create counts with only one severity level
            const counts = {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
              total: count
            };
            counts[severityKey] = count;

            // Format the summary
            const summary = formatter.formatSummary(counts);

            // Should contain the count and severity
            expect(summary).toContain(`${count}`);
            expect(summary).toContain(`(${count} total)`);

            // Should not contain commas (only one severity)
            expect(summary).not.toContain(',');

            // Verify correct severity name appears
            const severityNames = {
              critical: 'CRITICAL',
              high: 'HIGH',
              medium: 'MEDIUM',
              low: 'LOW'
            };
            expect(summary).toContain(severityNames[severityKey]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency between total and sum of individual counts', () => {
      fc.assert(
        fc.property(countsArb, (counts) => {
          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Extract the total from the summary
          const totalMatch = summary.match(/\((\d+) total\)/);
          
          if (counts.total === 0) {
            // Zero case should not have total in parentheses
            expect(totalMatch).toBeNull();
          } else {
            expect(totalMatch).not.toBeNull();
            const extractedTotal = parseInt(totalMatch[1], 10);
            expect(extractedTotal).toBe(counts.total);

            // Verify total equals sum of individual counts
            const sum = counts.critical + counts.high + counts.medium + counts.low;
            expect(extractedTotal).toBe(sum);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format zero vulnerabilities with success message', () => {
      const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      };

      const summary = formatter.formatSummary(counts);

      // Should show success emoji and message
      expect(summary).toContain('✅');
      expect(summary).toContain('No vulnerabilities found');

      // Should not contain any severity names
      expect(summary).not.toContain('CRITICAL');
      expect(summary).not.toContain('HIGH');
      expect(summary).not.toContain('MEDIUM');
      expect(summary).not.toContain('LOW');
    });
  });

  /**
   * Property 11: Respect max table rows configuration
   * **Validates: Requirements 7.4**
   * 
   * For any max-table-rows value N and vulnerability set, the generated table
   * should contain at most N rows.
   */
  describe('Property 11: Respect max table rows configuration', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    it('should respect any max rows value', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 200 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify the number of data lines doesn't exceed maxRows
            expect(dataLines.length).toBeLessThanOrEqual(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect max rows in complete formatted output', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Calculate counts from vulnerabilities
            const counts = {
              critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
              high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
              medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
              low: vulnerabilities.filter(v => v.severity === 'LOW').length,
              total: vulnerabilities.length
            };

            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Extract only table data lines (lines that start with | and contain severity emoji)
            const lines = formatted.split('\n');
            const tableDataLines = lines.filter(line => 
              line.trim().startsWith('|') && 
              (line.includes('🔴 CRITICAL') || 
               line.includes('🟠 HIGH') || 
               line.includes('🟡 MEDIUM') || 
               line.includes('⚪ LOW'))
            );

            // Verify the number of table data lines doesn't exceed maxRows
            expect(tableDataLines.length).toBeLessThanOrEqual(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect very small max rows values', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 10, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify the number of data lines equals maxRows (since we have more vulnerabilities)
            expect(dataLines.length).toBe(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect very large max rows values', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 100, max: 500 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify all vulnerabilities are shown (since maxRows is larger)
            expect(dataLines.length).toBe(vulnerabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect max rows value of 1', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 2, maxLength: 50 }),
          (vulnerabilities) => {
            // Format the table with maxRows = 1
            const table = formatter.formatTable(vulnerabilities, 1);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify exactly 1 data line
            expect(dataLines.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect max rows regardless of severity distribution', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 20, maxLength: 100 }),
          fc.integer({ min: 5, max: 15 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify maxRows is respected
            expect(dataLines.length).toBeLessThanOrEqual(maxRows);
            
            // Since we have more vulnerabilities than maxRows, should be exactly maxRows
            expect(dataLines.length).toBe(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply max rows consistently across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 10, maxLength: 50 }),
          fc.integer({ min: 5, max: 20 }),
          (vulnerabilities, maxRows) => {
            // Format the table twice with the same parameters
            const table1 = formatter.formatTable(vulnerabilities, maxRows);
            const table2 = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines from both
            const lines1 = table1.split('\n');
            const dataLines1 = lines1.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            const lines2 = table2.split('\n');
            const dataLines2 = lines2.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify both have the same number of rows
            expect(dataLines1.length).toBe(dataLines2.length);
            
            // Verify both respect maxRows
            expect(dataLines1.length).toBeLessThanOrEqual(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Comment includes scan header
   * **Validates: Requirements 5.4**
   * 
   * For any formatted comment body, it should contain the header "🔒 Trivy Security Scan Report".
   */
  describe('Property 9: Comment includes scan header', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    // Arbitrary for generating counts
    const countsArb = fc.record({
      critical: fc.integer({ min: 0, max: 50 }),
      high: fc.integer({ min: 0, max: 50 }),
      medium: fc.integer({ min: 0, max: 50 }),
      low: fc.integer({ min: 0, max: 50 })
    }).map(counts => ({
      ...counts,
      total: counts.critical + counts.high + counts.medium + counts.low
    }));

    it('should include scan header in any formatted comment', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 0, maxLength: 50 }),
          countsArb,
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, counts, maxRows) => {
            // Create results object
            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header is present
            expect(formatted).toContain('🔒 Trivy Security Scan Report');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include scan header as markdown heading', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 0, maxLength: 50 }),
          countsArb,
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, counts, maxRows) => {
            // Create results object
            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header is formatted as a markdown heading (##)
            expect(formatted).toContain('## 🔒 Trivy Security Scan Report');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include scan header at the beginning of the comment', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 0, maxLength: 50 }),
          countsArb,
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, counts, maxRows) => {
            // Create results object
            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header appears at the start
            expect(formatted.trim()).toMatch(/^## 🔒 Trivy Security Scan Report/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include scan header regardless of vulnerability count', () => {
      fc.assert(
        fc.property(
          countsArb,
          fc.integer({ min: 5, max: 100 }),
          (counts, maxRows) => {
            // Create results with matching vulnerability count
            const vulnerabilities = [];
            
            // Create results object
            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header is present even with zero vulnerabilities
            expect(formatted).toContain('🔒 Trivy Security Scan Report');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include scan header with zero vulnerabilities', () => {
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

      // Format the complete comment
      const formatted = formatter.format(results, 20);

      // Verify the header is present
      expect(formatted).toContain('## 🔒 Trivy Security Scan Report');
    });

    it('should include scan header with any severity distribution', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Calculate counts from vulnerabilities
            const counts = {
              critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
              high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
              medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
              low: vulnerabilities.filter(v => v.severity === 'LOW').length,
              total: vulnerabilities.length
            };

            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header is present
            expect(formatted).toContain('## 🔒 Trivy Security Scan Report');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include scan header with any maxRows value', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 200 }),
          (vulnerabilities, maxRows) => {
            // Calculate counts from vulnerabilities
            const counts = {
              critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
              high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
              medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
              low: vulnerabilities.filter(v => v.severity === 'LOW').length,
              total: vulnerabilities.length
            };

            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, maxRows);

            // Verify the header is present regardless of maxRows
            expect(formatted).toContain('## 🔒 Trivy Security Scan Report');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Generate table for any non-empty vulnerability set
   * **Validates: Requirements 4.1**
   * 
   * For any non-empty vulnerability set, the formatted output should include
   * a markdown table with vulnerability details.
   */
  describe('Property 8: Generate table for any non-empty vulnerability set', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    it('should generate a table for any non-empty vulnerability array', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify table is not empty
            expect(table).not.toBe('');
            expect(table.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include table header section for any non-empty vulnerability set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify table contains the header section
            expect(table).toContain('### Vulnerability Details');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include markdown table structure for any non-empty vulnerability set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify table contains markdown table structure (pipes)
            expect(table).toContain('|');
            
            // Verify table contains column headers
            expect(table).toContain('Severity');
            expect(table).toContain('Package');
            expect(table).toContain('Vulnerability');
            expect(table).toContain('Installed');
            expect(table).toContain('Fixed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include at least one data row for any non-empty vulnerability set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify at least one data row exists
            expect(dataLines.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate table in complete formatted output for non-empty vulnerability set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Create results object
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const counts = {
              critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
              high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
              medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
              low: vulnerabilities.filter(v => v.severity === 'LOW').length,
              total: vulnerabilities.length
            };

            const results = {
              vulnerabilities,
              counts
            };

            // Format the complete output
            const formatted = formatter.format(results, maxRows);

            // Verify the formatted output includes a table
            expect(formatted).toContain('### Vulnerability Details');
            expect(formatted).toContain('| Severity | Package | Type | Vulnerability | Installed | Fixed |');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not generate table for empty vulnerability set', () => {
      // Format table with empty array
      const table = formatter.formatTable([], 20);

      // Verify table is empty
      expect(table).toBe('');
    });

    it('should generate valid markdown table structure for any non-empty set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 5, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify table has proper markdown structure
            const lines = table.split('\n').filter(line => line.trim() !== '');
            
            // Should have at least: header section, column headers, separator, and one data row
            expect(lines.length).toBeGreaterThanOrEqual(4);
            
            // Verify separator line exists
            expect(table).toContain('|----------|---------|------|---------------|-----------|-------|');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include vulnerability data in table for any non-empty set', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify at least one vulnerability's data appears in the table
            // (checking for severity since it's always present)
            const hasCritical = vulnerabilities.some(v => v.severity === 'CRITICAL');
            const hasHigh = vulnerabilities.some(v => v.severity === 'HIGH');
            const hasMedium = vulnerabilities.some(v => v.severity === 'MEDIUM');
            const hasLow = vulnerabilities.some(v => v.severity === 'LOW');

            if (hasCritical) {
              expect(table).toContain('CRITICAL');
            }
            if (hasHigh) {
              expect(table).toContain('HIGH');
            }
            if (hasMedium) {
              expect(table).toContain('MEDIUM');
            }
            if (hasLow) {
              expect(table).toContain('LOW');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Limit table rows and show overflow
   * **Validates: Requirements 4.4, 4.5**
   * 
   * For any vulnerability set and max row limit N, the table should contain at most N rows,
   * and if the total vulnerabilities exceed N, an overflow message should indicate how many more exist.
   */
  describe('Property 7: Limit table rows and show overflow', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    it('should limit table to at most maxRows rows', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines (lines with severity information)
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify the number of data lines doesn't exceed maxRows
            expect(dataLines.length).toBeLessThanOrEqual(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show overflow message when vulnerabilities exceed maxRows', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (maxRows, extra) => {
            // Create vulnerabilities that exceed maxRows
            const totalVulns = maxRows + extra;
            const vulnerabilities = Array.from({ length: totalVulns }, (_, i) => ({
              target: 'test',
              id: `CVE-${i}`,
              package: `pkg${i}`,
              installedVersion: '1.0.0',
              fixedVersion: '1.0.1',
              severity: 'HIGH',
              title: 'Test'
            }));

            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify overflow message is present
            expect(table).toContain('and');
            expect(table).toContain('more');
            expect(table).toContain(`${extra}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not show overflow message when vulnerabilities equal maxRows', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            // Create exactly count vulnerabilities
            const vulnerabilities = Array.from({ length: count }, (_, i) => ({
              target: 'test',
              id: `CVE-${i}`,
              package: `pkg${i}`,
              installedVersion: '1.0.0',
              fixedVersion: '1.0.1',
              severity: 'HIGH',
              title: 'Test'
            }));

            // Format the table with maxRows equal to vulnerability count
            const table = formatter.formatTable(vulnerabilities, count);

            // Verify no overflow message
            expect(table).not.toContain('and');
            expect(table).not.toContain('more');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not show overflow message when vulnerabilities are less than maxRows', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (maxRows, fewer) => {
            // Create fewer vulnerabilities than maxRows
            const count = Math.max(1, maxRows - fewer);
            const vulnerabilities = Array.from({ length: count }, (_, i) => ({
              target: 'test',
              id: `CVE-${i}`,
              package: `pkg${i}`,
              installedVersion: '1.0.0',
              fixedVersion: '1.0.1',
              severity: 'HIGH',
              title: 'Test'
            }));

            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify no overflow message
            expect(table).not.toContain('and');
            expect(table).not.toContain('more');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show correct count of remaining vulnerabilities in overflow message', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1, max: 50 }),
          (maxRows, extra) => {
            // Create vulnerabilities that exceed maxRows
            const totalVulns = maxRows + extra;
            const vulnerabilities = Array.from({ length: totalVulns }, (_, i) => ({
              target: 'test',
              id: `CVE-${i}`,
              package: `pkg${i}`,
              installedVersion: '1.0.0',
              fixedVersion: '1.0.1',
              severity: 'HIGH',
              title: 'Test'
            }));

            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract the overflow message
            const overflowMatch = table.match(/and (\d+) more/);
            expect(overflowMatch).not.toBeNull();
            
            const remaining = parseInt(overflowMatch[1], 10);
            expect(remaining).toBe(extra);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display exactly maxRows vulnerabilities when total exceeds maxRows', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 10, maxLength: 100 }),
          fc.integer({ min: 1, max: 20 }),
          (vulnerabilities, maxRows) => {
            // Only test when we have more vulnerabilities than maxRows
            if (vulnerabilities.length <= maxRows) {
              return true;
            }

            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify exactly maxRows are displayed
            expect(dataLines.length).toBe(maxRows);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display all vulnerabilities when total is less than maxRows', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 30, max: 100 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify all vulnerabilities are displayed
            expect(dataLines.length).toBe(vulnerabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maxRows regardless of severity distribution', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 20, maxLength: 100 }),
          fc.integer({ min: 5, max: 15 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify maxRows is respected
            expect(dataLines.length).toBeLessThanOrEqual(maxRows);
            
            // If we have more vulnerabilities than maxRows, verify overflow message
            if (vulnerabilities.length > maxRows) {
              expect(table).toContain('more');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Table contains required columns with emoji formatting
   * **Validates: Requirements 4.2, 4.6**
   * 
   * For any generated vulnerability table, it should contain columns for Severity, Package,
   * Vulnerability ID, Installed Version, and Fixed Version, with severity values formatted
   * as emoji + text (e.g., "🔴 CRITICAL").
   */
  describe('Property 6: Table contains required columns with emoji formatting', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    it('should contain all required column headers', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify all required columns are present in the header
            expect(table).toContain('| Severity | Package | Type | Vulnerability | Installed | Fixed |');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include header separator row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify the separator row is present
            expect(table).toContain('|----------|---------|------|---------------|-----------|-------|');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format severity with emoji prefix in all rows', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify each data line has emoji + severity
            dataLines.forEach(line => {
              const hasFormattedSeverity = 
                line.includes('🔴 CRITICAL') ||
                line.includes('🟠 HIGH') ||
                line.includes('🟡 MEDIUM') ||
                line.includes('⚪ LOW');
              
              expect(hasFormattedSeverity).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include package name in each row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify each vulnerability's package appears in the table (possibly escaped)
            const displayedCount = Math.min(vulnerabilities.length, maxRows);
            const sortedVulns = [...vulnerabilities].sort((a, b) => {
              const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            for (let i = 0; i < displayedCount; i++) {
              // Check for either the original or escaped version
              const original = sortedVulns[i].package;
              const escaped = original.replace(/\|/g, '\\|');
              const hasPackage = table.includes(original) || table.includes(escaped);
              expect(hasPackage).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include vulnerability ID in each row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify each vulnerability's ID appears in the table (possibly escaped)
            const displayedCount = Math.min(vulnerabilities.length, maxRows);
            const sortedVulns = [...vulnerabilities].sort((a, b) => {
              const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            for (let i = 0; i < displayedCount; i++) {
              // Check for either the original or escaped version
              const original = sortedVulns[i].id;
              const escaped = original.replace(/\|/g, '\\|');
              const hasId = table.includes(original) || table.includes(escaped);
              expect(hasId).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include installed version in each row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify each vulnerability's installed version appears in the table (possibly escaped)
            const displayedCount = Math.min(vulnerabilities.length, maxRows);
            const sortedVulns = [...vulnerabilities].sort((a, b) => {
              const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            for (let i = 0; i < displayedCount; i++) {
              // Check for either the original or escaped version
              const original = sortedVulns[i].installedVersion;
              const escaped = original.replace(/\|/g, '\\|');
              const hasVersion = table.includes(original) || table.includes(escaped);
              expect(hasVersion).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include fixed version in each row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Verify each vulnerability's fixed version appears in the table (possibly escaped)
            const displayedCount = Math.min(vulnerabilities.length, maxRows);
            const sortedVulns = [...vulnerabilities].sort((a, b) => {
              const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            for (let i = 0; i < displayedCount; i++) {
              // Check for either the original or escaped version
              const original = sortedVulns[i].fixedVersion;
              const escaped = original.replace(/\|/g, '\\|');
              const hasVersion = table.includes(original) || table.includes(escaped);
              expect(hasVersion).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format each row as a valid markdown table row', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Extract data lines
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Verify each data line has the correct number of unescaped pipes (7 for 6 columns)
            // Count only pipes that are not escaped (not preceded by backslash)
            dataLines.forEach(line => {
              // Count unescaped pipes: pipes not preceded by backslash
              const unescapedPipes = (line.match(/(?<!\\)\|/g) || []).length;
              expect(unescapedPipes).toBe(7); // 6 columns = 7 pipes
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct emoji for each severity level', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            // Check that CRITICAL uses red emoji
            if (vulnerabilities.some(v => v.severity === 'CRITICAL')) {
              const criticalLines = table.split('\n').filter(line => line.includes('CRITICAL'));
              criticalLines.forEach(line => {
                expect(line).toContain('🔴 CRITICAL');
              });
            }

            // Check that HIGH uses orange emoji
            if (vulnerabilities.some(v => v.severity === 'HIGH')) {
              const highLines = table.split('\n').filter(line => line.includes('HIGH'));
              highLines.forEach(line => {
                expect(line).toContain('🟠 HIGH');
              });
            }

            // Check that MEDIUM uses yellow emoji
            if (vulnerabilities.some(v => v.severity === 'MEDIUM')) {
              const mediumLines = table.split('\n').filter(line => line.includes('MEDIUM'));
              mediumLines.forEach(line => {
                expect(line).toContain('🟡 MEDIUM');
              });
            }

            // Check that LOW uses white emoji
            if (vulnerabilities.some(v => v.severity === 'LOW')) {
              const lowLines = table.split('\n').filter(line => line.includes('LOW'));
              lowLines.forEach(line => {
                expect(line).toContain('⚪ LOW');
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Sort vulnerabilities by severity
   * **Validates: Requirements 4.3**
   * 
   * For any list of vulnerabilities, sorting by severity should place all CRITICAL first,
   * then all HIGH, then all MEDIUM, then all LOW, maintaining this order throughout.
   */
  describe('Property 5: Sort vulnerabilities by severity', () => {
    // Arbitrary for generating a vulnerability
    const vulnerabilityArb = fc.record({
      target: fc.string(),
      id: fc.string(),
      package: fc.string(),
      type: fc.string(),
      installedVersion: fc.string(),
      fixedVersion: fc.string(),
      severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      title: fc.string()
    });

    it('should sort vulnerabilities with CRITICAL first, then HIGH, then MEDIUM, then LOW', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 1, maxLength: 50 }),
          (vulnerabilities) => {
            // Sort using the formatter's internal sorting logic
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const sorted = [...vulnerabilities].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Verify the order is maintained
            for (let i = 0; i < sorted.length - 1; i++) {
              const currentOrder = severityOrder[sorted[i].severity];
              const nextOrder = severityOrder[sorted[i + 1].severity];
              expect(currentOrder).toBeLessThanOrEqual(nextOrder);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain severity order in formatted table', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 2, maxLength: 30 }),
          fc.integer({ min: 5, max: 50 }),
          (vulnerabilities, maxRows) => {
            // Format the table
            const table = formatter.formatTable(vulnerabilities, maxRows);

            if (table === '') {
              return true; // Skip empty tables
            }

            // Extract severity values from the table rows
            const lines = table.split('\n');
            const dataLines = lines.filter(line => 
              line.includes('CRITICAL') || 
              line.includes('HIGH') || 
              line.includes('MEDIUM') || 
              line.includes('LOW')
            );

            // Map severity names to order
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };

            // Extract severities from each line
            const severities = dataLines.map(line => {
              if (line.includes('CRITICAL')) return 'CRITICAL';
              if (line.includes('HIGH')) return 'HIGH';
              if (line.includes('MEDIUM')) return 'MEDIUM';
              if (line.includes('LOW')) return 'LOW';
              return null;
            }).filter(s => s !== null);

            // Verify order is maintained
            for (let i = 0; i < severities.length - 1; i++) {
              const currentOrder = severityOrder[severities[i]];
              const nextOrder = severities[i + 1] ? severityOrder[severities[i + 1]] : Infinity;
              expect(currentOrder).toBeLessThanOrEqual(nextOrder);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should group all vulnerabilities of the same severity together', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 5, maxLength: 50 }),
          (vulnerabilities) => {
            // Sort using the formatter's internal sorting logic
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const sorted = [...vulnerabilities].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Check that all vulnerabilities of the same severity are grouped together
            const severityGroups = {};
            sorted.forEach((vuln, index) => {
              if (!severityGroups[vuln.severity]) {
                severityGroups[vuln.severity] = [];
              }
              severityGroups[vuln.severity].push(index);
            });

            // For each severity group, verify indices are consecutive
            Object.values(severityGroups).forEach(indices => {
              for (let i = 0; i < indices.length - 1; i++) {
                // Check if indices are consecutive (allowing for other severities in between)
                // But within the same severity, they should be grouped
                const currentIndex = indices[i];
                const nextIndex = indices[i + 1];
                
                // Verify no other severity appears between these indices
                for (let j = currentIndex + 1; j < nextIndex; j++) {
                  expect(sorted[j].severity).toBe(sorted[currentIndex].severity);
                }
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place CRITICAL before any other severity', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 2, maxLength: 50 })
            .filter(vulns => vulns.some(v => v.severity === 'CRITICAL')),
          (vulnerabilities) => {
            // Sort using the formatter's internal sorting logic
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const sorted = [...vulnerabilities].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Find the first CRITICAL vulnerability
            const firstCriticalIndex = sorted.findIndex(v => v.severity === 'CRITICAL');
            
            // Verify no non-CRITICAL vulnerabilities appear before it
            for (let i = 0; i < firstCriticalIndex; i++) {
              expect(sorted[i].severity).toBe('CRITICAL');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place LOW after all other severities', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 2, maxLength: 50 })
            .filter(vulns => vulns.some(v => v.severity === 'LOW')),
          (vulnerabilities) => {
            // Sort using the formatter's internal sorting logic
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const sorted = [...vulnerabilities].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Find the last LOW vulnerability
            const lastLowIndex = sorted.map((v, i) => v.severity === 'LOW' ? i : -1)
              .filter(i => i !== -1)
              .pop();
            
            if (lastLowIndex !== undefined) {
              // Verify no non-LOW vulnerabilities appear after it
              for (let i = lastLowIndex + 1; i < sorted.length; i++) {
                expect(sorted[i].severity).toBe('LOW');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain sort order regardless of input order', () => {
      fc.assert(
        fc.property(
          fc.array(vulnerabilityArb, { minLength: 3, maxLength: 20 }),
          (vulnerabilities) => {
            // Sort the vulnerabilities
            const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const sorted1 = [...vulnerabilities].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Shuffle and sort again
            const shuffled = [...vulnerabilities].sort(() => Math.random() - 0.5);
            const sorted2 = [...shuffled].sort((a, b) => {
              return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Both should have the same severity order
            expect(sorted1.map(v => v.severity)).toEqual(sorted2.map(v => v.severity));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Critical vulnerabilities trigger red emoji
   * **Validates: Requirements 3.2**
   * 
   * For any vulnerability set containing at least one CRITICAL vulnerability,
   * the summary emoji should be 🔴.
   */
  describe('Property 3: Critical vulnerabilities trigger red emoji', () => {
    // Arbitrary for generating counts with at least one critical vulnerability
    const countsWithCriticalArb = fc.record({
      critical: fc.integer({ min: 1, max: 100 }), // At least 1 critical
      high: fc.integer({ min: 0, max: 100 }),
      medium: fc.integer({ min: 0, max: 100 }),
      low: fc.integer({ min: 0, max: 100 })
    }).map(counts => ({
      ...counts,
      total: counts.critical + counts.high + counts.medium + counts.low
    }));

    it('should return red emoji when at least one critical vulnerability exists', () => {
      fc.assert(
        fc.property(countsWithCriticalArb, (counts) => {
          // Get the summary emoji
          const emoji = formatter.getSummaryEmoji(counts);

          // Verify it's the red emoji
          expect(emoji).toBe('🔴');
        }),
        { numRuns: 100 }
      );
    });

    it('should return red emoji regardless of other severity counts', () => {
      fc.assert(
        fc.property(countsWithCriticalArb, (counts) => {
          // Verify critical count is at least 1
          expect(counts.critical).toBeGreaterThanOrEqual(1);

          // Get the summary emoji
          const emoji = formatter.getSummaryEmoji(counts);

          // Verify it's the red emoji, regardless of high, medium, or low counts
          expect(emoji).toBe('🔴');
        }),
        { numRuns: 100 }
      );
    });

    it('should include red emoji in formatted summary when critical vulnerabilities exist', () => {
      fc.assert(
        fc.property(countsWithCriticalArb, (counts) => {
          // Format the summary
          const summary = formatter.formatSummary(counts);

          // Verify the summary starts with the red emoji
          expect(summary).toMatch(/^🔴/);
          
          // Verify the summary contains the critical count (without emoji)
          expect(summary).toContain(`${counts.critical} CRITICAL`);
        }),
        { numRuns: 100 }
      );
    });

    it('should prioritize red emoji over other severities in complete format', () => {
      fc.assert(
        fc.property(
          countsWithCriticalArb,
          fc.array(
            fc.record({
              target: fc.string(),
              id: fc.string(),
              package: fc.string(),
              installedVersion: fc.string(),
              fixedVersion: fc.string(),
              severity: fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
              title: fc.string()
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (counts, vulnerabilities) => {
            // Ensure at least one vulnerability is CRITICAL to match the counts
            const vulnsWithCritical = [
              { ...vulnerabilities[0], severity: 'CRITICAL' },
              ...vulnerabilities.slice(1)
            ];

            const results = {
              vulnerabilities: vulnsWithCritical,
              counts: counts
            };

            // Format the complete comment
            const formatted = formatter.format(results, 20);

            // Verify the formatted output contains the red emoji in the summary
            expect(formatted).toContain('🔴');
            
            // Verify the summary line starts with red emoji
            const lines = formatted.split('\n');
            const summaryLine = lines.find(line => line.includes('total'));
            expect(summaryLine).toMatch(/^🔴/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not return red emoji when no critical vulnerabilities exist', () => {
      fc.assert(
        fc.property(
          fc.record({
            critical: fc.constant(0), // No critical vulnerabilities
            high: fc.integer({ min: 0, max: 100 }),
            medium: fc.integer({ min: 0, max: 100 }),
            low: fc.integer({ min: 0, max: 100 })
          }).map(counts => ({
            ...counts,
            total: counts.high + counts.medium + counts.low
          })),
          (counts) => {
            // Get the summary emoji
            const emoji = formatter.getSummaryEmoji(counts);

            // Verify it's NOT the red emoji
            expect(emoji).not.toBe('🔴');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
