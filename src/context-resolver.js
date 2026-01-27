const core = require('@actions/core');
const fs = require('fs');

/**
 * Resolves PR context from event files in workflow_run scenarios.
 */
class ContextResolver {
  constructor(context) {
    this.context = context;
  }

  /**
   * Resolves PR context from event file.
   * @param {string} eventFilePath - Path to event file (optional)
   * @param {string} eventName - Event name (optional)
   * @returns {Promise<{prNumber: number|null, isWorkflowRun: boolean, eventName: string}>}
   */
  async resolvePRContext(eventFilePath, eventName) {
    const isWorkflowRun = !!this.context.payload.workflow_run;
    
    // Use provided event name or default from context
    const resolvedEventName = eventName || this.context.eventName || '';
    
    let prNumber = null;

    // If event file path provided, read and parse it
    if (eventFilePath) {
      try {
        const event = await this.readEventFile(eventFilePath);
        prNumber = this.extractPRNumber(event, resolvedEventName);
      } catch (error) {
        core.warning(`Failed to read event file: ${error.message}`);
      }
    } else {
      // Try to extract PR number from current context
      prNumber = this.extractPRNumber(this.context.payload, resolvedEventName);
    }

    return {
      prNumber,
      isWorkflowRun,
      eventName: resolvedEventName
    };
  }

  /**
   * Reads and parses an event file.
   * @param {string} filePath - Path to event file
   * @returns {Promise<any>} Parsed event data
   * @private
   */
  async readEventFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read event file: ${error.message}`);
    }
  }

  /**
   * Extracts PR number from event data based on event type.
   * @param {any} event - Event data
   * @param {string} eventName - Event name
   * @returns {number|null} PR number or null
   * @private
   */
  extractPRNumber(event, eventName) {
    if (!event) {
      return null;
    }

    // Handle pull_request events
    if (eventName === 'pull_request' || eventName === 'pull_request_target') {
      return event.pull_request?.number || null;
    }

    // Handle workflow_run events
    if (eventName === 'workflow_run') {
      // Check if workflow_run has pull_requests array
      const pullRequests = event.workflow_run?.pull_requests;
      if (pullRequests && pullRequests.length > 0) {
        return pullRequests[0].number;
      }
      return null;
    }

    // Handle workflow_call events - inherits context from parent workflow
    if (eventName === 'workflow_call') {
      // workflow_call inherits the parent's context, so check for pull_request
      if (event.pull_request?.number) {
        return event.pull_request.number;
      }
      return null;
    }

    // Handle push events - attempt to extract PR context (workflow_run pattern)
    if (eventName === 'push') {
      // In workflow_run pattern, push events may have PR context
      if (event.pull_request?.number) {
        return event.pull_request.number;
      }
      return null;
    }

    // Try to extract from pull_request if available (fallback)
    if (event.pull_request) {
      return event.pull_request.number || null;
    }

    // Try to extract from workflow_run if available (fallback)
    if (event.workflow_run?.pull_requests) {
      const pullRequests = event.workflow_run.pull_requests;
      if (pullRequests.length > 0) {
        return pullRequests[0].number;
      }
    }

    return null;
  }
}

module.exports = { ContextResolver };
