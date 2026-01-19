/**
 * Formatter for generating markdown comments from vulnerability data.
 * Handles emoji selection, summary formatting, and table generation.
 */
class CommentFormatter {
  /**
   * Formats vulnerability data into a complete markdown comment.
   * 
   * @param {ParsedResults} results - Parsed vulnerability data with counts
   * @param {number} maxRows - Maximum number of rows to include in the table
   * @returns {string} Formatted markdown comment
   */
  format(results, maxRows) {
    const header = '## 🔒 Trivy Security Scan\n\n';
    const summary = this.formatSummary(results.counts);
    const table = this.formatTable(results.vulnerabilities, maxRows);
    
    return header + summary + table;
  }

  /**
   * Formats the summary line with emoji and vulnerability counts.
   * 
   * @param {Counts} counts - Vulnerability counts by severity
   * @returns {string} Formatted summary line
   */
  formatSummary(counts) {
    // Handle zero vulnerabilities case
    if (counts.total === 0) {
      return '✅ **No vulnerabilities found**\n\n';
    }

    // Get the primary emoji based on highest severity
    const emoji = this.getSummaryEmoji(counts);
    
    // Build list of non-zero severity counts
    const severityParts = [];
    if (counts.critical > 0) {
      severityParts.push(`${counts.critical} 🔴 CRITICAL`);
    }
    if (counts.high > 0) {
      severityParts.push(`${counts.high} 🟠 HIGH`);
    }
    if (counts.medium > 0) {
      severityParts.push(`${counts.medium} 🟡 MEDIUM`);
    }
    if (counts.low > 0) {
      severityParts.push(`${counts.low} ⚪ LOW`);
    }

    const severityList = severityParts.join(', ');
    
    return `${emoji} **${severityList}** (${counts.total} total)\n\n`;
  }

  /**
   * Formats the vulnerability details table.
   * 
   * @param {Vulnerability[]} vulnerabilities - Array of vulnerabilities
   * @param {number} maxRows - Maximum number of rows to include
   * @returns {string} Formatted markdown table or empty string if no vulnerabilities
   */
  formatTable(vulnerabilities, maxRows) {
    if (vulnerabilities.length === 0) {
      return '';
    }

    // Sort vulnerabilities by severity (CRITICAL -> HIGH -> MEDIUM -> LOW)
    const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    const sorted = [...vulnerabilities].sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Take first N vulnerabilities based on maxRows
    const limited = sorted.slice(0, maxRows);

    // Generate table header
    let table = '### Vulnerability Details\n\n';
    table += '| Severity | Package | Type | Vulnerability | Installed | Fixed |\n';
    table += '|----------|---------|------|---------------|-----------|-------|\n';

    // Generate table rows
    for (const vuln of limited) {
      const severityWithEmoji = `${this.getSeverityEmoji(vuln.severity)} ${vuln.severity}`;
      const pkg = this.escapeTableCell(vuln.package);
      const type = this.escapeTableCell(vuln.type);
      const id = this.escapeTableCell(vuln.id);
      const installed = this.escapeTableCell(vuln.installedVersion);
      const fixed = this.escapeTableCell(vuln.fixedVersion);
      table += `| ${severityWithEmoji} | ${pkg} | ${type} | ${id} | ${installed} | ${fixed} |\n`;
    }

    // Add overflow message if there are more vulnerabilities
    if (vulnerabilities.length > maxRows) {
      const remaining = vulnerabilities.length - maxRows;
      table += `\n*... and ${remaining} more*\n`;
    }

    return table;
  }

  /**
   * Escapes special characters in table cell content to prevent breaking markdown tables.
   * 
   * @param {string} text - Text to escape
   * @returns {string} Escaped text safe for markdown table cells
   */
  escapeTableCell(text) {
    // Replace pipe characters with escaped version to prevent breaking table structure
    // Handle undefined or null values
    if (text === undefined || text === null) {
      return '';
    }
    return text.replace(/\|/g, '\\|');
  }

  /**
   * Gets the summary emoji based on the highest severity present.
   * 
   * @param {Counts} counts - Vulnerability counts by severity
   * @returns {string} Emoji representing the highest severity
   */
  getSummaryEmoji(counts) {
    if (counts.critical > 0) {
      return '🔴';
    }
    if (counts.high > 0) {
      return '🟠';
    }
    if (counts.medium > 0 || counts.low > 0) {
      return '🟡';
    }
    return '✅';
  }

  /**
   * Maps a severity level to its corresponding emoji.
   * 
   * @param {string} severity - Severity level (CRITICAL, HIGH, MEDIUM, LOW)
   * @returns {string} Emoji for the severity level
   */
  getSeverityEmoji(severity) {
    const emojiMap = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '⚪'
    };
    return emojiMap[severity] || '';
  }
}

module.exports = { CommentFormatter };
