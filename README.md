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
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1 # v0.35.0
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'json'
          output: 'trivy-results.json'

      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@57e223b003c96ab604014d81c864634919a06033 # v1.0.1
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Example for Grype Scan:

```yaml
      - name: Scan container image with Grype
        id: grype-scan
        uses: anchore/scan-action@e1165082ffb1fe366ebaf02d8526e7c4989ea9d2 # v7.4.0
        with:
          image: "localbuild/testimage:latest"
          output-format: json
          output-file: grype-results.json
          grype-version: "v0.110.0"
          fail-build: false

      - name: Convert Grype results to Trivy JSON format
        run: |
          jq '{
            Results: [
              .matches | group_by(.artifact.type)[] |
              {
                Target: (.[0].artifact.locations[0].path // .[0].artifact.type),
                Type: .[0].artifact.type,
                Vulnerabilities: [
                  .[] |
                  {
                    VulnerabilityID: .vulnerability.id,
                    PkgName: .artifact.name,
                    InstalledVersion: .artifact.version,
                    FixedVersion: ((.vulnerability.fix.versions // []) | join(", ") | if . == "" then "N/A" else . end),
                    Severity: (.vulnerability.severity | ascii_upcase),
                    Title: (.vulnerability.description // "")
                  }
                ]
              }
            ]
          }' grype-results.json > trivy-results.json

      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@57e223b003c96ab604014d81c864634919a06033 # v1.0.1
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Example

Customize the number of vulnerabilities displayed in the table:

```yaml
      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@57e223b003c96ab604014d81c864634919a06033 # v1.0.1
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          max-table-rows: 30
```

### Using Action Outputs

The action provides outputs that can be used in subsequent steps:

```yaml
      - name: Decorate PR with scan results
        id: trivy-decorator
        uses: katanox/trivy-pr-decorator@57e223b003c96ab604014d81c864634919a06033 # v1.0.1
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
| `results-file` | Path to the Trivy JSON results file | Yes | - |
| `github-token` | GitHub token for API authentication (use `${{ secrets.GITHUB_TOKEN }}`) | Yes | - |
| `max-table-rows` | Maximum number of rows to display in the vulnerability details table | No | `20` |

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

1. **Parse**: Reads the Trivy JSON results file and extracts vulnerability data
2. **Aggregate**: Counts vulnerabilities by severity level (CRITICAL, HIGH, MEDIUM, LOW)
3. **Format**: Generates a markdown comment with emoji indicators and a sorted vulnerability table
4. **Post**: Creates a new PR comment or updates an existing one to avoid clutter

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
│   └── config.js          # Input validation and configuration
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
