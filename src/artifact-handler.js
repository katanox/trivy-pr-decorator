const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

/**
 * Handles artifact download and extraction for workflow_run events.
 */
class ArtifactHandler {
  constructor(octokit, context) {
    this.octokit = octokit;
    this.context = context;
  }

  /**
   * Checks if the action is running in a workflow_run context.
   * @returns {boolean} True if running in workflow_run context
   */
  isWorkflowRunContext() {
    return !!this.context.payload.workflow_run;
  }

  /**
   * Downloads and extracts artifacts from the triggering workflow.
   * @param {string} artifactName - Name of artifact containing test results (optional)
   * @param {string} eventArtifactName - Name of artifact containing event file (optional)
   * @returns {Promise<{resultsFilePath: string|null, eventFilePath: string|null, tempDir: string}>}
   */
  async downloadArtifacts(artifactName, eventArtifactName) {
    if (!this.isWorkflowRunContext()) {
      throw new Error('Not in workflow_run context');
    }

    const workflowRunId = this.context.payload.workflow_run.id;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trivy-artifacts-'));

    core.info(`Downloading artifacts from workflow run ${workflowRunId}`);

    // List all artifacts from the triggering workflow
    const artifacts = await this.listArtifacts(workflowRunId);

    let resultsFilePath = null;
    let eventFilePath = null;

    // Download results artifact if specified
    if (artifactName) {
      const resultsArtifact = artifacts.find(a => a.name === artifactName);
      if (resultsArtifact) {
        core.info(`Downloading artifact: ${artifactName}`);
        const resultsZipPath = path.join(tempDir, `${artifactName}.zip`);
        await this.downloadArtifact(resultsArtifact.id, resultsZipPath);
        
        const resultsExtractDir = path.join(tempDir, artifactName);
        await this.extractZip(resultsZipPath, resultsExtractDir);
        
        // Find the first file in the extracted directory
        const files = fs.readdirSync(resultsExtractDir);
        if (files.length > 0) {
          resultsFilePath = path.join(resultsExtractDir, files[0]);
          core.info(`Results file extracted to: ${resultsFilePath}`);
        }
      } else {
        core.warning(`Artifact '${artifactName}' not found`);
      }
    }

    // Download event artifact if specified
    if (eventArtifactName) {
      const eventArtifact = artifacts.find(a => a.name === eventArtifactName);
      if (eventArtifact) {
        core.info(`Downloading artifact: ${eventArtifactName}`);
        const eventZipPath = path.join(tempDir, `${eventArtifactName}.zip`);
        await this.downloadArtifact(eventArtifact.id, eventZipPath);
        
        const eventExtractDir = path.join(tempDir, eventArtifactName);
        await this.extractZip(eventZipPath, eventExtractDir);
        
        // Find the first file in the extracted directory
        const files = fs.readdirSync(eventExtractDir);
        if (files.length > 0) {
          eventFilePath = path.join(eventExtractDir, files[0]);
          core.info(`Event file extracted to: ${eventFilePath}`);
        }
      } else {
        core.warning(`Artifact '${eventArtifactName}' not found`);
      }
    }

    return {
      resultsFilePath,
      eventFilePath,
      tempDir
    };
  }

  /**
   * Lists all artifacts from a workflow run.
   * @param {number} runId - Workflow run ID
   * @returns {Promise<Array>} Array of artifacts
   * @private
   */
  async listArtifacts(runId) {
    try {
      const response = await this.octokit.rest.actions.listWorkflowRunArtifacts({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        run_id: runId
      });

      return response.data.artifacts;
    } catch (error) {
      throw new Error(`Failed to list artifacts: ${error.message}`);
    }
  }

  /**
   * Downloads an artifact as a ZIP file.
   * @param {number} artifactId - Artifact ID
   * @param {string} destPath - Destination path for the ZIP file
   * @returns {Promise<void>}
   * @private
   */
  async downloadArtifact(artifactId, destPath) {
    try {
      const response = await this.octokit.rest.actions.downloadArtifact({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        artifact_id: artifactId,
        archive_format: 'zip'
      });

      // Write the ZIP file
      fs.writeFileSync(destPath, Buffer.from(response.data));
    } catch (error) {
      throw new Error(`Failed to download artifact: ${error.message}`);
    }
  }

  /**
   * Extracts a ZIP file to a directory.
   * @param {string} zipPath - Path to ZIP file
   * @param {string} destPath - Destination directory
   * @returns {Promise<void>}
   * @private
   */
  async extractZip(zipPath, destPath) {
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(destPath, true);
    } catch (error) {
      throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
  }

  /**
   * Cleans up temporary files and directories.
   * @param {string} tempDir - Temporary directory to remove
   * @returns {Promise<void>}
   */
  async cleanup(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        core.info(`Cleaned up temporary directory: ${tempDir}`);
      }
    } catch (error) {
      core.warning(`Failed to cleanup temporary directory: ${error.message}`);
    }
  }
}

module.exports = { ArtifactHandler };
