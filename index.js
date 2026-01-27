const core = require('@actions/core');
const github = require('@actions/github');
const { Config } = require('./src/config');
const { TrivyParser } = require('./src/parser');
const { CommentFormatter } = require('./src/formatter');
const { PRCommenter } = require('./src/commenter');
const { ArtifactHandler } = require('./src/artifact-handler');
const { ContextResolver } = require('./src/context-resolver');

/**
 * Main entry point for the Trivy PR Decorator action.
 * Orchestrates the workflow: parse results, format comment, post to PR.
 * Supports both direct PR context and workflow_run pattern.
 */
async function run() {
  let tempDir = null;
  
  try {
    // Load and validate configuration
    core.info('Loading configuration...');
    const config = new Config();
    config.validate();
    core.info(`Configuration loaded: results-file=${config.resultsFile}, max-table-rows=${config.maxTableRows}`);

    // Initialize GitHub API client
    const octokit = github.getOctokit(config.githubToken);

    // Check if running in workflow_run context
    const artifactHandler = new ArtifactHandler(octokit, github.context);
    const isWorkflowRun = artifactHandler.isWorkflowRunContext();

    let resultsFilePath = config.resultsFile;
    let eventFilePath = config.eventFile;

    // Download artifacts if in workflow_run context
    if (isWorkflowRun) {
      core.info('Detected workflow_run context, downloading artifacts...');
      const downloadedArtifacts = await artifactHandler.downloadArtifacts(
        config.artifactName,
        config.eventArtifactName
      );

      // Use downloaded files if available, otherwise fall back to config
      if (downloadedArtifacts.resultsFilePath) {
        resultsFilePath = downloadedArtifacts.resultsFilePath;
        core.info(`Using downloaded results file: ${resultsFilePath}`);
      }
      if (downloadedArtifacts.eventFilePath) {
        eventFilePath = downloadedArtifacts.eventFilePath;
        core.info(`Using downloaded event file: ${eventFilePath}`);
      }
      tempDir = downloadedArtifacts.tempDir;
    }

    // Resolve PR context (handles both direct PR and workflow_run)
    const contextResolver = new ContextResolver(github.context);
    const prContext = await contextResolver.resolvePRContext(eventFilePath, config.eventName);
    
    if (prContext.prNumber) {
      core.info(`Resolved PR number: ${prContext.prNumber}`);
    }

    // Parse Trivy results
    core.info(`Parsing Trivy results from ${resultsFilePath}...`);
    const parser = new TrivyParser();
    const results = parser.parse(resultsFilePath);
    core.info(`Parsed ${results.counts.total} vulnerabilities (CRITICAL: ${results.counts.critical}, HIGH: ${results.counts.high}, MEDIUM: ${results.counts.medium}, LOW: ${results.counts.low})`);

    // Format comment
    core.info('Formatting comment...');
    const formatter = new CommentFormatter();
    const commentBody = formatter.format(results, config.maxTableRows);
    core.debug('Comment body generated');

    // Post or update comment
    core.info('Posting comment to pull request...');
    const commenter = new PRCommenter(octokit, github.context, core);
    const posted = await commenter.postOrUpdateComment(commentBody, prContext.prNumber);
    
    if (posted) {
      core.info('Successfully posted Trivy scan results');
    }

    // Set action outputs
    core.setOutput('total-vulnerabilities', results.counts.total);
    core.setOutput('critical-count', results.counts.critical);
    core.setOutput('high-count', results.counts.high);
    core.setOutput('medium-count', results.counts.medium);
    core.setOutput('low-count', results.counts.low);
    core.info('Action completed successfully');

    // Cleanup artifacts if downloaded
    if (tempDir) {
      await artifactHandler.cleanup(tempDir);
    }

  } catch (error) {
    core.setFailed(error.message);
    
    // Attempt cleanup even on error
    if (tempDir) {
      try {
        const octokit = github.getOctokit(core.getInput('github-token'));
        const artifactHandler = new ArtifactHandler(octokit, github.context);
        await artifactHandler.cleanup(tempDir);
      } catch (cleanupError) {
        core.warning(`Failed to cleanup artifacts: ${cleanupError.message}`);
      }
    }
  }
}

// Run the action
run();
