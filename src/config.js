const core = require('@actions/core');

/**
 * Configuration class for the Trivy PR Decorator action.
 * Reads and validates action inputs.
 */
class Config {
  constructor() {
    // Read inputs from action.yml
    this.resultsFile = core.getInput('results-file');
    this.githubToken = core.getInput('github-token');
    
    // Read optional input with default value
    const maxTableRowsInput = core.getInput('max-table-rows');
    this.maxTableRows = maxTableRowsInput ? parseInt(maxTableRowsInput, 10) : 20;
    
    // Read workflow_run support inputs (optional)
    const eventFileInput = core.getInput('event-file');
    this.eventFile = eventFileInput || process.env.GITHUB_EVENT_PATH || '';
    
    const eventNameInput = core.getInput('event-name');
    this.eventName = eventNameInput || process.env.GITHUB_EVENT_NAME || '';
    
    this.artifactName = core.getInput('artifact-name') || '';
    this.eventArtifactName = core.getInput('event-artifact-name') || '';
  }

  /**
   * Validates that all required inputs are provided.
   * @throws {Error} If required inputs are missing or invalid
   */
  validate() {
    const errors = [];

    if (!this.resultsFile) {
      errors.push('results-file input is required');
    }

    if (!this.githubToken) {
      errors.push('github-token input is required');
    }

    if (isNaN(this.maxTableRows) || this.maxTableRows <= 0) {
      errors.push('max-table-rows must be a positive number');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
}

module.exports = { Config };
