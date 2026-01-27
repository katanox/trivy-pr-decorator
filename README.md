# Trivy PR Decorator

A GitHub Action that parses [Trivy](https://github.com/aquasecurity/trivy-action) vulnerability scan results and posts beautifully formatted comments to pull requests. Keep your team informed about security vulnerabilities with clear summaries and detailed vulnerability tables.

## Features

- 🎯 **Clear Visual Indicators**: Emoji-based severity indicators (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, ⚪ LOW)
- 📊 **Detailed Vulnerability Tables**: Sortable tables with package names, CVE IDs, and version information
- 🔄 **Smart Comment Management**: Updates existing comments instead of creating duplicates
- ⚙️ **Configurable**: Customize table size
- 🚀 **Easy Integration**: Works seamlessly with existing Trivy scan workflows

## Usage

### Basic Example

Add this action to your workflow after running a Trivy scan:

```yaml
name: Security Scan
on: [pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@v0.33.1
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'json'
          output: 'trivy-results.json'

      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@v1.1.0
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Example

Customize the number of vulnerabilities displayed in the table:

```yaml
      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@v1.1.0
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          max-table-rows: 30
```

### Fork-Safe Pattern with workflow_run

For workflows that need to work with pull requests from forks (including Dependabot PRs), use the two-workflow pattern. This approach runs the security scan in the untrusted fork context, then posts comments from a trusted workflow with full permissions.

**Why use this pattern?**
- ✅ Works with pull requests from forks
- ✅ Works with Dependabot pull requests
- ✅ Maintains security by separating scan execution from comment posting
- ✅ Avoids permission issues with `GITHUB_TOKEN` in fork PRs

#### Step 1: CI Workflow (runs on pull_request)

This workflow runs the Trivy scan and uploads results as artifacts:

```yaml
name: Security Scan
on:
  pull_request:

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@v0.33.1
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'json'
          output: 'trivy-results.json'

      - name: Upload scan results
        uses: actions/upload-artifact@v6
        with:
          name: trivy-results
          path: trivy-results.json

      - name: Upload event file
        uses: actions/upload-artifact@v6
        with:
          name: event-file
          path: ${{ github.event_path }}
```

#### Step 2: Publishing Workflow (runs on workflow_run)

This workflow downloads the artifacts and posts the PR comment with full permissions:

```yaml
name: Publish Security Results
on:
  workflow_run:
    workflows: ["Security Scan"]
    types:
      - completed

jobs:
  publish-results:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
    permissions:
      pull-requests: write
    steps:
      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@v1.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          artifact-name: 'trivy-results'
          event-artifact-name: 'event-file'
```

**How it works:**
1. The CI workflow runs on `pull_request` events (including from forks)
2. Trivy scans the code and saves results as an artifact
3. The event file (containing PR context) is also saved as an artifact
4. The publishing workflow triggers when the CI workflow completes
5. The publishing workflow runs with base repository permissions
6. It downloads both artifacts and posts the comment to the PR

### Using Action Outputs

The action provides outputs that can be used in subsequent steps:

```yaml
      - name: Decorate PR with scan results
        id: trivy-decorator
        uses: katanox/trivy-pr-decorator@v1.1.0
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check vulnerability threshold
        if: steps.trivy-decorator.outputs.critical-count > 0
        run: |
          echo "Found ${{ steps.trivy-decorator.outputs.critical-count }} critical vulnerabilities!"
          exit 1

      - name: Display vulnerability summary
        run: |
          echo "Total vulnerabilities: ${{ steps.trivy-decorator.outputs.total-vulnerabilities }}"
          echo "Critical: ${{ steps.trivy-decorator.outputs.critical-count }}"
          echo "High: ${{ steps.trivy-decorator.outputs.high-count }}"
          echo "Medium: ${{ steps.trivy-decorator.outputs.medium-count }}"
          echo "Low: ${{ steps.trivy-decorator.outputs.low-count }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `results-file` | Path to the Trivy JSON results file (not used when `artifact-name` is provided) | No* | - |
| `github-token` | GitHub token for API authentication (use `${{ secrets.GITHUB_TOKEN }}`) | Yes | - |
| `max-table-rows` | Maximum number of rows to display in the vulnerability details table | No | `20` |
| `artifact-name` | Name of the artifact containing Trivy results (for workflow_run pattern) | No | - |
| `event-artifact-name` | Name of the artifact containing the event file (for workflow_run pattern) | No | - |
| `event-file` | Path to the GitHub event file | No | `$GITHUB_EVENT_PATH` |
| `event-name` | Name of the GitHub event | No | `$GITHUB_EVENT_NAME` |

**Note:** Either `results-file` OR `artifact-name` must be provided. Use `results-file` for direct PR workflows, or `artifact-name` for the workflow_run pattern.

## Outputs

| Output | Description |
|--------|-------------|
| `total-vulnerabilities` | Total number of vulnerabilities found across all severity levels |
| `critical-count` | Number of CRITICAL severity vulnerabilities |
| `high-count` | Number of HIGH severity vulnerabilities |
| `medium-count` | Number of MEDIUM severity vulnerabilities |
| `low-count` | Number of LOW severity vulnerabilities |

## Permissions

Minimal [workflow job permissions](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs#example-setting-permissions-for-a-specific-job) required by this action in **public** GitHub repositories are:

```yaml
permissions:
  pull-requests: write
```

**Why this permission is needed:**
- `pull-requests: write` - Required to create and update comments on pull requests. This is the core functionality of the action.

The following permissions are required in **private** GitHub repos:

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: write
```

**Additional permissions for private repos:**
- `contents: read` - Required to access repository metadata and context in private repositories.
- `issues: read` - Required to list existing comments on pull requests in private repositories (pull requests are implemented as issues in GitHub's API).

### Workflow Pattern Comparison

| Feature | Direct PR Pattern | workflow_run Pattern |
|---------|------------------|---------------------|
| **Works with fork PRs** | ❌ No | ✅ Yes |
| **Works with Dependabot** | ❌ No | ✅ Yes |
| **Setup complexity** | Simple (1 workflow) | Moderate (2 workflows) |
| **Permissions** | Limited in forks | Full base repo permissions |
| **Use case** | Internal PRs only | All PRs including forks |

**Recommendation:** Use the workflow_run pattern if you accept pull requests from forks or use Dependabot. Use the direct pattern for simpler internal-only workflows.

## Comment Format

The action posts a formatted comment to your pull request that looks like this:

### Example: Vulnerabilities Found

```markdown
## 🔒 Trivy Security Scan Report

🔴 **3 CRITICAL, 5 HIGH, 12 MEDIUM, 8 LOW** (28 total)

### Vulnerability Details

| Severity | Package | Type | Vulnerability | Installed | Fixed |
|----------|---------|------|---------------|-----------|-------|
| 🔴 CRITICAL | lodash | npm | CVE-2023-1234 | 4.17.19 | 4.17.21 |
| 🔴 CRITICAL | axios | npm | CVE-2023-5678 | 0.21.1 | 0.21.4 |
| 🔴 CRITICAL | express | npm | CVE-2023-9012 | 4.17.1 | 4.18.2 |
| 🟠 HIGH | moment | npm | CVE-2023-3456 | 2.29.1 | 2.29.4 |
| 🟠 HIGH | webpack | npm | CVE-2023-7890 | 5.75.0 | 5.76.0 |

*... and 23 more*
```

### Example: No Vulnerabilities

```markdown
## 🔒 Trivy Security Scan Report

✅ **No vulnerabilities found**
```

## How It Works

### Direct PR Pattern

1. **Parse**: Reads the Trivy JSON results file and extracts vulnerability data
2. **Aggregate**: Counts vulnerabilities by severity level (CRITICAL, HIGH, MEDIUM, LOW)
3. **Format**: Generates a markdown comment with emoji indicators and a sorted vulnerability table
4. **Post**: Creates a new PR comment or updates an existing one to avoid clutter

### workflow_run Pattern

1. **Scan**: CI workflow runs Trivy scan and uploads results + event file as artifacts
2. **Trigger**: Publishing workflow triggers when CI workflow completes
3. **Download**: Publishing workflow downloads artifacts from the triggering workflow
4. **Resolve**: Extracts PR number from the event file
5. **Parse & Format**: Same as direct pattern - parses results and formats comment
6. **Post**: Posts comment to the PR using the resolved PR number
7. **Cleanup**: Removes temporary artifact files

The action intelligently identifies and updates existing comments from previous runs, ensuring your pull request stays clean and readable.

## Development

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/katanox/trivy-pr-decorator.git
cd trivy-pr-decorator

# Install dependencies
npm install

# Build the action (required before committing)
npm run build
```

### Building for Distribution

This action uses [@vercel/ncc](https://github.com/vercel/ncc) to compile the code and dependencies into a single file for distribution.

**Important:** You must run `npm run build` before committing changes. The `dist/` folder must be committed to the repository for the action to work.

```bash
# Build the action
npm run build

# Commit the dist folder
git add dist/
git commit -m "Build distribution"
```

### Running Tests

The project includes both unit tests and property-based tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Project Structure

```
trivy-pr-decorator/
├── action.yml              # Action metadata and configuration
├── index.js                # Main entry point
├── src/
│   ├── parser.js          # Trivy results parsing
│   ├── formatter.js       # Comment formatting
│   ├── commenter.js       # GitHub API interactions
│   ├── config.js          # Input validation and configuration
│   ├── artifact-handler.js # Artifact download and extraction
│   └── context-resolver.js # PR context resolution
├── tests/
│   ├── unit/              # Unit tests
│   ├── properties/        # Property-based tests
│   └── integration/       # Integration tests
└── package.json           # Dependencies
```

### Testing Strategy

The action uses a dual testing approach:

- **Unit Tests**: Test specific examples and edge cases using Jest
- **Property-Based Tests**: Verify universal properties across randomized inputs using fast-check

All property tests run with a minimum of 100 iterations to ensure robust validation.

## Troubleshooting

### Common Issues with workflow_run Pattern

**Problem: Comments not appearing on fork PRs**

Solution: Ensure you're using the two-workflow pattern with `workflow_run`. The direct pattern won't work with fork PRs due to GitHub security restrictions.

**Problem: "Artifact not found" error**

Solution: 
- Verify the artifact names match between upload and download steps
- Check that the CI workflow completed successfully before the publishing workflow ran
- Ensure artifacts are uploaded in the CI workflow before the workflow completes

**Problem: "Cannot read PR context" error**

Solution:
- Make sure you're uploading the event file in the CI workflow: `path: ${{ github.event_path }}`
- Verify the `event-artifact-name` input matches the artifact name used in upload

**Problem: Publishing workflow not triggering**

Solution:
- Check that the workflow name in `workflow_run.workflows` exactly matches the CI workflow name
- Verify the CI workflow completed (check `if: github.event.workflow_run.conclusion == 'success'`)
- Ensure both workflows are on the default branch (workflow_run only works for workflows on the default branch)

**Problem: Permission denied when posting comments**

Solution:
- Add `permissions: pull-requests: write` to the publishing workflow job
- For private repos, also add `contents: read` and `issues: read`

### General Troubleshooting

**Problem: Action fails with "Results file not found"**

Solution: Verify the `results-file` path matches the Trivy action's `output` parameter.

**Problem: No comment appears on PR**

Solution:
- Check workflow logs for errors
- Verify the `github-token` has `pull-requests: write` permission
- Ensure the workflow is running in a PR context (not on push to main)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Write tests** for any new functionality
3. **Ensure all tests pass** before submitting a pull request
4. **Follow the existing code style** and conventions
5. **Update documentation** as needed

### Reporting Issues

If you encounter a bug or have a feature request, please [open an issue](https://github.com/katanox/trivy-pr-decorator/issues) with:

- A clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Relevant logs or screenshots

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Trivy Action](https://github.com/aquasecurity/trivy-action) - The vulnerability scanner GitHub Action this decorator is built for
- [GitHub Actions](https://github.com/features/actions) - The platform that makes this automation possible

## Support

If you find this action helpful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs or suggesting features
- 📖 Improving documentation
- 🤝 Contributing code

---

**Made with ❤️ for the security-conscious developer community**
