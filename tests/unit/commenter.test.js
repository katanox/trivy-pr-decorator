const { PRCommenter } = require('../../src/commenter');

describe('PRCommenter', () => {
  let mockOctokit;
  let mockContext;
  let mockCore;
  let commenter;

  beforeEach(() => {
    // Create mock octokit with GitHub API methods
    mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn(),
          createComment: jest.fn(),
          updateComment: jest.fn()
        }
      }
    };

    // Create mock context with PR information
    mockContext = {
      payload: {
        pull_request: {
          number: 123
        }
      },
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };

    // Create mock core for logging
    mockCore = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn()
    };

    commenter = new PRCommenter(mockOctokit, mockContext, mockCore);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with octokit, context, and core', () => {
      expect(commenter.octokit).toBe(mockOctokit);
      expect(commenter.context).toBe(mockContext);
      expect(commenter.core).toBe(mockCore);
      expect(commenter.scanHeader).toBe('🔒 Trivy Security Scan Report');
    });
  });

  describe('postOrUpdateComment()', () => {
    it('should create new comment when none exists', async () => {
      // Mock no existing comments
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nTest comment';

      const result = await commenter.postOrUpdateComment(commentBody);

      // Verify it returns true when posted
      expect(result).toBe(true);

      // Verify listComments was called
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123
      });

      // Verify createComment was called
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: commentBody
      });

      // Verify updateComment was NOT called
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    it('should update existing comment when found', async () => {
      // Mock existing bot comment with scan header
      const existingComment = {
        id: 456,
        user: { type: 'Bot', login: 'github-actions[bot]' },
        body: '## 🔒 Trivy Security Scan Report\n\nOld comment'
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [existingComment]
      });
      mockOctokit.rest.issues.updateComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nNew comment';

      const result = await commenter.postOrUpdateComment(commentBody);

      // Verify it returns true when updated
      expect(result).toBe(true);

      // Verify listComments was called
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123
      });

      // Verify updateComment was called
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 456,
        body: commentBody
      });

      // Verify createComment was NOT called
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should update first comment when multiple exist', async () => {
      // Mock multiple bot comments with scan header
      const comments = [
        {
          id: 111,
          user: { type: 'Bot', login: 'github-actions[bot]' },
          body: '## 🔒 Trivy Security Scan Report\n\nFirst comment'
        },
        {
          id: 222,
          user: { type: 'Bot', login: 'github-actions[bot]' },
          body: '## 🔒 Trivy Security Scan Report\n\nSecond comment'
        }
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });
      mockOctokit.rest.issues.updateComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nUpdated comment';

      await commenter.postOrUpdateComment(commentBody);

      // Verify updateComment was called with first comment's ID
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 111,
        body: commentBody
      });

      // Verify it was only called once
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledTimes(1);
    });

    it('should gracefully exit with info log when not in PR context', async () => {
      // Create context without pull_request
      const noPRContext = {
        payload: {},
        repo: {
          owner: 'test-owner',
          repo: 'test-repo'
        }
      };

      const commenterNoPR = new PRCommenter(mockOctokit, noPRContext, mockCore);

      const result = await commenterNoPR.postOrUpdateComment('Test comment');

      // Verify it returns false when skipped
      expect(result).toBe(false);

      // Verify info log was called with graceful exit message
      expect(mockCore.info).toHaveBeenCalledWith(
        'No pull request context found, skipping comment'
      );

      // Verify no API calls were made
      expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    it('should ignore non-Bot comments', async () => {
      // Mock comments from users, not bots
      const comments = [
        {
          id: 789,
          user: { type: 'User', login: 'john-doe' },
          body: '## 🔒 Trivy Security Scan Report\n\nUser comment'
        }
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nBot comment';

      await commenter.postOrUpdateComment(commentBody);

      // Should create new comment since no bot comment exists
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    it('should ignore Bot comments without scan header', async () => {
      // Mock bot comments without the scan header
      const comments = [
        {
          id: 999,
          user: { type: 'Bot', login: 'github-actions[bot]' },
          body: 'Some other bot comment'
        }
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nNew scan comment';

      await commenter.postOrUpdateComment(commentBody);

      // Should create new comment since no matching bot comment exists
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    it('should use explicit PR number when provided', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nTest comment';
      const explicitPRNumber = 999;

      const result = await commenter.postOrUpdateComment(commentBody, explicitPRNumber);

      expect(result).toBe(true);

      // Verify listComments was called with explicit PR number
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: explicitPRNumber
      });

      // Verify createComment was called with explicit PR number
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: explicitPRNumber,
        body: commentBody
      });
    });

    it('should fall back to context PR number when explicit PR number not provided', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nTest comment';

      await commenter.postOrUpdateComment(commentBody);

      // Verify it used context PR number (123)
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123
      });
    });

    it('should gracefully exit when no PR number available', async () => {
      // Create context without pull_request
      const noPRContext = {
        payload: {},
        repo: {
          owner: 'test-owner',
          repo: 'test-repo'
        }
      };

      const commenterNoPR = new PRCommenter(mockOctokit, noPRContext, mockCore);

      // Call without explicit PR number
      const result = await commenterNoPR.postOrUpdateComment('Test comment');

      expect(result).toBe(false);
      expect(mockCore.info).toHaveBeenCalledWith(
        'No pull request context found, skipping comment'
      );
      expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
    });

    it('should post comment with explicit PR number from push event', async () => {
      // Create context for push event (no pull_request in payload)
      const pushContext = {
        payload: {
          ref: 'refs/heads/main'
        },
        repo: {
          owner: 'test-owner',
          repo: 'test-repo'
        }
      };

      const commenterPush = new PRCommenter(mockOctokit, pushContext, mockCore);

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nTest comment';
      const resolvedPRNumber = 42; // PR number resolved from event file

      const result = await commenterPush.postOrUpdateComment(commentBody, resolvedPRNumber);

      expect(result).toBe(true);

      // Verify createComment was called with resolved PR number
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: resolvedPRNumber,
        body: commentBody
      });
    });

    it('should update existing comment with explicit PR number', async () => {
      const existingComment = {
        id: 456,
        user: { type: 'Bot', login: 'github-actions[bot]' },
        body: '## 🔒 Trivy Security Scan Report\n\nOld comment'
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [existingComment]
      });
      mockOctokit.rest.issues.updateComment.mockResolvedValue({});

      const commentBody = '## 🔒 Trivy Security Scan Report\n\nNew comment';
      const explicitPRNumber = 888;

      await commenter.postOrUpdateComment(commentBody, explicitPRNumber);

      // Verify listComments was called with explicit PR number
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: explicitPRNumber
      });

      // Verify updateComment was called
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 456,
        body: commentBody
      });
    });
  });

  describe('findExistingComment()', () => {
    it('should return null when no comments exist', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });

      const result = await commenter.findExistingComment(123);

      expect(result).toBeNull();
    });

    it('should return bot comment with scan header', async () => {
      const botComment = {
        id: 123,
        user: { type: 'Bot', login: 'github-actions[bot]' },
        body: '## 🔒 Trivy Security Scan Report\n\nTest'
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [botComment]
      });

      const result = await commenter.findExistingComment(123);

      expect(result).toEqual(botComment);
    });

    it('should return null when only non-Bot comments exist', async () => {
      const comments = [
        {
          id: 123,
          user: { type: 'User', login: 'john-doe' },
          body: '## 🔒 Trivy Security Scan Report\n\nUser comment'
        }
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });

      const result = await commenter.findExistingComment(123);

      expect(result).toBeNull();
    });

    it('should return null when Bot comments lack scan header', async () => {
      const comments = [
        {
          id: 123,
          user: { type: 'Bot', login: 'github-actions[bot]' },
          body: 'Some other comment'
        }
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });

      const result = await commenter.findExistingComment(123);

      expect(result).toBeNull();
    });

    it('should throw error when API call fails', async () => {
      mockOctokit.rest.issues.listComments.mockRejectedValue(
        new Error('API Error')
      );

      await expect(commenter.findExistingComment(123)).rejects.toThrow(
        'Failed to list PR comments: API Error'
      );
    });
  });

  describe('createComment()', () => {
    it('should call GitHub API to create comment', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const commentBody = 'Test comment body';

      await commenter.createComment(123, commentBody);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: commentBody
      });
    });

    it('should throw error when API call fails', async () => {
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(commenter.createComment(123, 'Test')).rejects.toThrow(
        'Failed to create comment: Permission denied'
      );
    });
  });

  describe('updateComment()', () => {
    it('should call GitHub API to update comment', async () => {
      mockOctokit.rest.issues.updateComment.mockResolvedValue({});

      const commentId = 456;
      const commentBody = 'Updated comment body';

      await commenter.updateComment(commentId, commentBody);

      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: commentId,
        body: commentBody
      });
    });

    it('should throw error when API call fails', async () => {
      mockOctokit.rest.issues.updateComment.mockRejectedValue(
        new Error('Comment not found')
      );

      await expect(commenter.updateComment(456, 'Test')).rejects.toThrow(
        'Failed to update comment: Comment not found'
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockOctokit.rest.issues.listComments.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        commenter.postOrUpdateComment('Test')
      ).rejects.toThrow('Failed to list PR comments: Network timeout');
    });

    it('should handle authentication errors', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Bad credentials')
      );

      await expect(
        commenter.postOrUpdateComment('Test')
      ).rejects.toThrow('Failed to create comment: Bad credentials');
    });

    it('should handle permission errors', async () => {
      const existingComment = {
        id: 456,
        user: { type: 'Bot', login: 'github-actions[bot]' },
        body: '## 🔒 Trivy Security Scan Report\n\nOld'
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [existingComment]
      });
      mockOctokit.rest.issues.updateComment.mockRejectedValue(
        new Error('Insufficient permissions')
      );

      await expect(
        commenter.postOrUpdateComment('Test')
      ).rejects.toThrow('Failed to update comment: Insufficient permissions');
    });
  });
});
