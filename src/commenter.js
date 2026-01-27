/**
 * PRCommenter handles GitHub API interactions for posting and updating PR comments.
 * Manages bot comment identification and update logic.
 */
class PRCommenter {
  /**
   * Creates a new PRCommenter instance.
   * 
   * @param {import('@octokit/rest').Octokit} octokit - Authenticated Octokit instance
   * @param {import('@actions/github').context} context - GitHub Actions context
   * @param {import('@actions/core')} core - Actions core for logging
   */
  constructor(octokit, context, core) {
    this.octokit = octokit;
    this.context = context;
    this.core = core;
    this.scanHeader = '🔒 Trivy Security Scan Report';
  }

  /**
   * Posts a new comment or updates an existing bot comment on the PR.
   * Gracefully exits if no PR context can be determined.
   * 
   * @param {string} body - The comment body to post or update
   * @param {number|null} prNumber - Optional PR number (for workflow_run context or push events)
   * @returns {Promise<boolean>} True if comment was posted/updated, false if skipped
   * @throws {Error} If API call fails
   */
  async postOrUpdateComment(body, prNumber = null) {
    // Determine PR number from parameter or context
    const pr = prNumber || this.context.payload.pull_request?.number;
    
    // Validate PR context - gracefully exit if no PR number available
    if (!pr) {
      this.core.info('No pull request context found, skipping comment');
      return false;
    }

    const existingComment = await this.findExistingComment(pr);

    if (existingComment) {
      await this.updateComment(existingComment.id, body);
    } else {
      await this.createComment(pr, body);
    }
    
    return true;
  }

  /**
   * Finds an existing bot comment with the scan header.
   * 
   * @param {number} prNumber - PR number
   * @returns {Promise<Object|null>} The existing comment or null if not found
   * @private
   */
  async findExistingComment(prNumber) {
    const { owner, repo } = this.context.repo;

    try {
      // List all comments on the PR
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber
      });

      // Filter for bot comments with the scan header
      const botComment = comments.find(comment => 
        comment.user.type === 'Bot' && 
        comment.body.includes(this.scanHeader)
      );

      return botComment || null;
    } catch (error) {
      throw new Error(`Failed to list PR comments: ${error.message}`);
    }
  }

  /**
   * Creates a new comment on the PR.
   * 
   * @param {number} prNumber - PR number
   * @param {string} body - The comment body
   * @private
   */
  async createComment(prNumber, body) {
    const { owner, repo } = this.context.repo;

    try {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });
    } catch (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Updates an existing comment on the PR.
   * 
   * @param {number} commentId - The ID of the comment to update
   * @param {string} body - The new comment body
   * @private
   */
  async updateComment(commentId, body) {
    const { owner, repo } = this.context.repo;

    try {
      await this.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body
      });
    } catch (error) {
      throw new Error(`Failed to update comment: ${error.message}`);
    }
  }
}

module.exports = { PRCommenter };
