const fc = require('fast-check');
const { PRCommenter } = require('../../src/commenter');

describe('Commenter Property Tests', () => {
  /**
   * Property 10: Identify bot comments correctly
   * **Validates: Requirements 6.3**
   * 
   * For any list of comments, filtering for bot comments with the scan header
   * should only return comments where user.type is "Bot" AND the body contains
   * "🔒 Trivy Security Scan Report".
   */
  describe('Property 10: Identify bot comments correctly', () => {
    // Arbitrary for generating user types
    const userTypeArb = fc.constantFrom('Bot', 'User', 'Organization');

    // Arbitrary for generating comment bodies with or without the scan header
    const scanHeader = '🔒 Trivy Security Scan Report';
    const commentBodyArb = fc.oneof(
      // Body with scan header
      fc.string().map(s => `${scanHeader}\n\n${s}`),
      // Body without scan header
      fc.string().filter(s => !s.includes(scanHeader)),
      // Body with partial match (should not match)
      fc.constantFrom(
        '🔒 Trivy',
        'Security Scan',
        '🔒 Security Scan',
        'Trivy Security Scan Report' // Missing emoji
      )
    );

    // Arbitrary for generating a single comment
    const commentArb = fc.record({
      id: fc.integer({ min: 1 }),
      user: fc.record({
        type: userTypeArb,
        login: fc.string()
      }),
      body: commentBodyArb
    });

    // Arbitrary for generating a list of comments
    const commentsListArb = fc.array(commentArb, { minLength: 0, maxLength: 20 });

    it('should only identify comments where user.type is Bot AND body contains scan header', async () => {
      await fc.assert(
        fc.asyncProperty(commentsListArb, async (comments) => {
          // Create a mock octokit that returns our generated comments
          const mockOctokit = {
            rest: {
              issues: {
                listComments: jest.fn().mockResolvedValue({ data: comments })
              }
            }
          };

          // Create a mock context with PR information
          const mockContext = {
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

          const commenter = new PRCommenter(mockOctokit, mockContext);

          // Call the private method through the public interface
          // We'll test this by checking the filtering logic
          const result = await commenter.findExistingComment();
          
          // Manually filter comments to find what should be returned
          const expectedComment = comments.find(comment =>
            comment.user.type === 'Bot' &&
            comment.body.includes(scanHeader)
          );

          // Verify the result matches our expectation
          if (expectedComment) {
            expect(result).not.toBeNull();
            expect(result.id).toBe(expectedComment.id);
            expect(result.user.type).toBe('Bot');
            expect(result.body).toContain(scanHeader);
          } else {
            expect(result).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not identify comments where user.type is not Bot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              user: fc.record({
                type: fc.constantFrom('User', 'Organization'),
                login: fc.string()
              }),
              body: fc.string().map(s => `${scanHeader}\n\n${s}`)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (comments) => {
            // All comments have scan header but none are from Bot
            const mockOctokit = {
              rest: {
                issues: {
                  listComments: jest.fn().mockResolvedValue({ data: comments })
                }
              }
            };

            const mockContext = {
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

            const commenter = new PRCommenter(mockOctokit, mockContext);

            const result = await commenter.findExistingComment();
            
            // Should return null since no Bot comments exist
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not identify Bot comments without scan header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              user: fc.record({
                type: fc.constant('Bot'),
                login: fc.string()
              }),
              body: fc.string().filter(s => !s.includes(scanHeader))
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (comments) => {
            // All comments are from Bot but none have scan header
            const mockOctokit = {
              rest: {
                issues: {
                  listComments: jest.fn().mockResolvedValue({ data: comments })
                }
              }
            };

            const mockContext = {
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

            const commenter = new PRCommenter(mockOctokit, mockContext);

            const result = await commenter.findExistingComment();
            
            // Should return null since no comments have scan header
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return first matching comment when multiple Bot comments with scan header exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              user: fc.record({
                type: fc.constant('Bot'),
                login: fc.string()
              }),
              body: fc.string().map(s => `${scanHeader}\n\n${s}`)
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (comments) => {
            // All comments are Bot comments with scan header
            const mockOctokit = {
              rest: {
                issues: {
                  listComments: jest.fn().mockResolvedValue({ data: comments })
                }
              }
            };

            const mockContext = {
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

            const commenter = new PRCommenter(mockOctokit, mockContext);

            const result = await commenter.findExistingComment();
            
            // Should return the first comment
            expect(result).not.toBeNull();
            expect(result.id).toBe(comments[0].id);
            expect(result.user.type).toBe('Bot');
            expect(result.body).toContain(scanHeader);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mixed comment lists correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            // Non-matching comments before
            fc.array(commentArb, { minLength: 0, maxLength: 5 }),
            // Matching Bot comment
            fc.record({
              id: fc.integer({ min: 1 }),
              user: fc.record({
                type: fc.constant('Bot'),
                login: fc.string()
              }),
              body: fc.string().map(s => `${scanHeader}\n\n${s}`)
            }),
            // Non-matching comments after
            fc.array(commentArb, { minLength: 0, maxLength: 5 })
          ),
          async ([before, matching, after]) => {
            // Ensure before and after don't contain matching comments
            const filteredBefore = before.filter(c => 
              !(c.user.type === 'Bot' && c.body.includes(scanHeader))
            );
            const filteredAfter = after.filter(c => 
              !(c.user.type === 'Bot' && c.body.includes(scanHeader))
            );

            const comments = [...filteredBefore, matching, ...filteredAfter];

            const mockOctokit = {
              rest: {
                issues: {
                  listComments: jest.fn().mockResolvedValue({ data: comments })
                }
              }
            };

            const mockContext = {
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

            const commenter = new PRCommenter(mockOctokit, mockContext);

            const result = await commenter.findExistingComment();
            
            // Should find the matching comment
            expect(result).not.toBeNull();
            expect(result.id).toBe(matching.id);
            expect(result.user.type).toBe('Bot');
            expect(result.body).toContain(scanHeader);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty comment lists', () => {
      const mockOctokit = {
        rest: {
          issues: {
            listComments: jest.fn().mockResolvedValue({ data: [] })
          }
        }
      };

      const mockContext = {
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

      const commenter = new PRCommenter(mockOctokit, mockContext);

      return commenter.findExistingComment().then(result => {
        expect(result).toBeNull();
      });
    });

    it('should be case-sensitive for scan header matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              user: fc.record({
                type: fc.constant('Bot'),
                login: fc.string()
              }),
              body: fc.constantFrom(
                '🔒 trivy security scan report',  // lowercase
                '🔒 TRIVY SECURITY SCAN REPORT',  // uppercase
                '🔒 Trivy security scan report',  // mixed case
                'trivy security scan report'       // no emoji
              )
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (comments) => {
            const mockOctokit = {
              rest: {
                issues: {
                  listComments: jest.fn().mockResolvedValue({ data: comments })
                }
              }
            };

            const mockContext = {
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

            const commenter = new PRCommenter(mockOctokit, mockContext);

            const result = await commenter.findExistingComment();
            
            // None of these should match the exact header
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
