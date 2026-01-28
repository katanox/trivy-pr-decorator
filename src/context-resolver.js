const core = require('@actions/core');
const fs = require('fs');

/**
 * Resolves PR context from event files in workflow_run scenarios.
 */
class ContextResolver {
  constructor(context, octokit = null) {
    this.context = context;
    this.octokit = octokit;
  }

  /**
   * Resolves PR context from event file.
   * @param {string} eventFilePath - Path to event file (optional)
   * @param {string} eventName - Event name (optional)
   * @param {string} shaInput - Commit SHA input (optional)
   * @returns {Promise<{prNumber: number|null, isWorkflowRun: boolean, eventName: string}>}
   */
  async resolvePRContext(eventFilePath, eventName, shaInput = null) {
    const isWorkflowRun = !!this.context.payload.workflow_run;
    
    // Use provided event name or default from context
    const resolvedEventName = eventName || this.context.eventName || '';
    
    core.info(`Resolving PR context for event: ${resolvedEventName}`);
    
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
      
      // If workflow_call and no PR found, check if there's a pull_request in the payload
      // (workflow_call inherits the parent's context which may have PR data)
      if (!prNumber && resolvedEventName === 'workflow_call') {
        core.info('workflow_call detected, checking for inherited PR context...');
        
        // Check various possible locations for PR context
        if (this.context.payload.pull_request?.number) {
          prNumber = this.context.payload.pull_request.number;
          core.info(`Found PR context from workflow_call parent: ${prNumber}`);
        } else {
          core.info('No pull_request found in payload');
          core.debug(`Payload keys: ${Object.keys(this.context.payload).join(', ')}`);
        }
      }
      
      // If push or workflow_call event and still no PR, try to find PR by commit SHA
      if (!prNumber && (resolvedEventName === 'push' || resolvedEventName === 'workflow_call')) {
        const sha = this.extractCommitSHA(shaInput);
        if (sha) {
          core.info(`Attempting to find PR associated with commit: ${sha}`);
          prNumber = await this.findPRByCommit(sha);
        }
      }
    }

    if (prNumber) {
      core.info(`Resolved PR number: ${prNumber}`);
    } else {
      core.info('No PR number could be resolved from context');
    }

    return {
      prNumber,
      isWorkflowRun,
      eventName: resolvedEventName
    };
  }

  /**
   * Extracts commit SHA from multiple possible locations in the GitHub Actions context.
   * Priority order: shaInput > head_commit.id > after > context.sha
   * @param {string} shaInput - Optional explicit SHA input (highest priority)
   * @returns {string|null} Commit SHA or null if not found
   * @private
   */
  extractCommitSHA(shaInput = null) {
    core.info('Extracting commit SHA from context...');
    
    // Priority 1: Explicit input (highest priority)
    if (shaInput) {
      core.info(`Using SHA from input: ${shaInput}`);
      return shaInput;
    }
    
    // Priority 2: head_commit.id (common in push events)
    if (this.context.payload.head_commit?.id) {
      const sha = this.context.payload.head_commit.id;
      core.info(`Found SHA in payload.head_commit.id: ${sha}`);
      return sha;
    }
    
    // Priority 3: after (push events)
    if (this.context.payload.after) {
      const sha = this.context.payload.after;
      core.info(`Found SHA in payload.after: ${sha}`);
      return sha;
    }
    
    // Priority 4: context.sha (fallback)
    if (this.context.sha) {
      const sha = this.context.sha;
      core.info(`Found SHA in context.sha: ${sha}`);
      return sha;
    }
    
    core.info('No commit SHA found in any checked location');
    core.debug(`Checked locations: shaInput, payload.head_commit.id, payload.after, context.sha`);
    return null;
  }

  /**
   * Finds PR number associated with a commit SHA using GitHub API.
   * @param {string} sha - Commit SHA
   * @returns {Promise<number|null>} PR number or null
   * @private
   */
  async findPRByCommit(sha) {
    if (!this.octokit) {
      core.debug('No octokit instance available for PR lookup');
      return null;
    }

    try {
      const { owner, repo } = this.context.repo;
      core.info(`Looking up PRs for commit ${sha} in ${owner}/${repo}`);
      
      // Search for PRs associated with this commit
      const { data: prs } = await this.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: sha
      });

      if (prs && prs.length > 0) {
        core.info(`Found ${prs.length} PR(s) associated with commit`);
        
        // Return the first open PR, or the first PR if none are open
        const openPR = prs.find(pr => pr.state === 'open');
        const pr = openPR || prs[0];
        
        core.info(`Selected PR #${pr.number} (state: ${pr.state}, title: "${pr.title}")`);
        return pr.number;
      }

      core.info('No PRs found associated with this commit');
      return null;
    } catch (error) {
      core.warning(`Failed to lookup PR by commit: ${error.message}`);
      core.debug(`Error details: ${error.stack}`);
      return null;
    }
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
