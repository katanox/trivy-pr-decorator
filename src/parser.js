const fs = require('fs');

/**
 * Parser for Trivy JSON vulnerability scan results.
 * Extracts and aggregates vulnerability data from Trivy output.
 */
class TrivyParser {
  /**
   * Parses a Trivy JSON results file and extracts vulnerability data.
   * 
   * @param {string} filePath - Path to the Trivy JSON results file
   * @returns {ParsedResults} Parsed vulnerability data with counts
   * @throws {Error} If file doesn't exist, JSON is invalid, or format is incorrect
   */
  parse(filePath) {
    // Read the file
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Results file not found: ${filePath}`);
    }

    // Parse JSON
    let trivyData;
    try {
      trivyData = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON in results file: ${error.message}`);
    }

    // Validate structure
    if (!trivyData || typeof trivyData !== 'object' || !trivyData.Results || !Array.isArray(trivyData.Results)) {
      throw new Error('Invalid Trivy format: missing Results array');
    }

    // Extract and aggregate vulnerabilities
    const vulnerabilities = [];
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0
    };

    // Iterate through all results and their vulnerabilities
    for (const result of trivyData.Results) {
      const target = result.Target || 'unknown';
      const type = result.Type || 'unknown';
      const vulns = result.Vulnerabilities || [];

      for (const vuln of vulns) {
        // Extract severity and normalize to uppercase
        const severity = (vuln.Severity || '').toUpperCase();
        
        // Only process recognized severity levels
        if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity)) {
          continue;
        }

        // Map Trivy fields to internal model
        const vulnerability = {
          target: target,
          type: type,
          id: vuln.VulnerabilityID || '',
          package: vuln.PkgName || '',
          installedVersion: vuln.InstalledVersion || '',
          fixedVersion: vuln.FixedVersion || 'N/A',
          severity: severity,
          title: vuln.Title || ''
        };

        vulnerabilities.push(vulnerability);

        // Update counts
        switch (severity) {
          case 'CRITICAL':
            counts.critical++;
            break;
          case 'HIGH':
            counts.high++;
            break;
          case 'MEDIUM':
            counts.medium++;
            break;
          case 'LOW':
            counts.low++;
            break;
        }
        counts.total++;
      }
    }

    return {
      vulnerabilities,
      counts
    };
  }
}

module.exports = { TrivyParser };
