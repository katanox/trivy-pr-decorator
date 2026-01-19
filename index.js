const core = require('@actions/core');
const github = require('@actions/github');
const { Config } = require('./src/config');
const { TrivyParser } = require('./src/parser');
const { CommentFormatter } = require('./src/formatter');
const { PRCommenter } = require('./src/commenter');

/**
 * Main entry point for the Trivy PR Decorator action.
 * Orchestrates the workflow: parse results, format comment, post to PR.
 */
async function run() {
  try {
    // Load and validate configuration
    core.info('Loading configuration...');
    const config = new Config();
    config.validate();
    core.info(`Configuration loaded: results-file=${config.resultsFile}, max-table-rows=${config.maxTableRows}`);

    // Parse Trivy results
    core.info(`Parsing Trivy results from ${config.resultsFile}...`);
    const parser = new TrivyParser();
    const results = parser.parse(config.resultsFile);
    core.info(`Parsed ${results.counts.total} vulnerabilities (CRITICAL: ${results.counts.critical}, HIGH: ${results.counts.high}, MEDIUM: ${results.counts.medium}, LOW: ${results.counts.low})`);

    // Format comment
    core.info('Formatting comment...');
    const formatter = new CommentFormatter();
    const commentBody = formatter.format(results, config.maxTableRows);
    core.debug('Comment body generated');

    // Post or update comment
    core.info('Posting comment to pull request...');
    const octokit = github.getOctokit(config.githubToken);
    const commenter = new PRCommenter(octokit, github.context);
    await commenter.postOrUpdateComment(commentBody);
    core.info('Successfully posted Trivy scan results');

    // Set action outputs
    core.setOutput('total-vulnerabilities', results.counts.total);
    core.setOutput('critical-count', results.counts.critical);
    core.setOutput('high-count', results.counts.high);
    core.info('Action completed successfully');

  } catch (error) {
    core.setFailed(error.message);
  }
}

// Run the action
run();
