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
   */
  constructor(octokit, context) {
    this.octokit = octokit;
    this.context = context;
    this.scanHeader = '🔒 Trivy Security Scan Report';
  }

  /**
   * Posts a new comment or updates an existing bot comment on the PR.
   * 
   * @param {string} body - The comment body to post or update
   * @throws {Error} If not in PR context or API call fails
   */
  async postOrUpdateComment(body) {
    // Validate PR context
    if (!this.context.payload.pull_request) {
      throw new Error('Action must run in pull request context');
    }

    const existingComment = await this.findExistingComment();

    if (existingComment) {
      await this.updateComment(existingComment.id, body);
    } else {
      await this.createComment(body);
    }
  }

  /**
   * Finds an existing bot comment with the scan header.
   * 
   * @returns {Promise<Object|null>} The existing comment or null if not found
   * @private
   */
  async findExistingComment() {
    const { owner, repo } = this.context.repo;
    const issue_number = this.context.payload.pull_request.number;

    try {
      // List all comments on the PR
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number
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
   * @param {string} body - The comment body
   * @private
   */
  async createComment(body) {
    const { owner, repo } = this.context.repo;
    const issue_number = this.context.payload.pull_request.number;

    try {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
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
