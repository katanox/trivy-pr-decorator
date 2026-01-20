# Trivy PR Decorator

A GitHub Action that parses [Trivy](https://github.com/aquasecurity/trivy) vulnerability scan results and posts beautifully formatted comments to pull requests. Keep your team informed about security vulnerabilities with clear, emoji-based summaries and detailed vulnerability tables.

## Features

- 🎯 **Clear Visual Indicators**: Emoji-based severity indicators (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, ⚪ LOW)
- 📊 **Detailed Vulnerability Tables**: Sortable tables with package names, CVE IDs, and version information
- 🔄 **Smart Comment Management**: Updates existing comments instead of creating duplicates
- ⚙️ **Configurable**: Customize table size and other display options
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
        uses: katanox/trivy-pr-decorator@v1.0.0
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Example

Customize the number of vulnerabilities displayed in the table:

```yaml
      - name: Decorate PR with scan results
        uses: katanox/trivy-pr-decorator@v1
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
        uses: katanox/trivy-pr-decorator@v1.0.0
        with:
          results-file: 'trivy-results.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check vulnerability threshold
        if: steps.trivy-decorator.outputs.critical-count > 0
        run: |
          echo "Found ${{ steps.trivy-decorator.outputs.critical-count }} critical vulnerabilities!"
          exit 1
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

## Permissions

Minimal [workflow job permissions](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs#example-setting-permissions-for-a-specific-job) required by this action in **public** GitHub repositories are:

```yaml
permissions:
  checks: write
  pull-requests: write
```

The following permissions are required in **private** GitHub repos:

```yaml
permissions:
  contents: read
  issues: read
  checks: write
  pull-requests: write
```

## Comment Format

The action posts a formatted comment to your pull request that looks like this:

### Example: Vulnerabilities Found

```markdown
## 🔒 Trivy Security Scan

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
## 🔒 Trivy Security Scan

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

- [Trivy](https://github.com/aquasecurity/trivy) - The amazing vulnerability scanner this action is built for
- [GitHub Actions](https://github.com/features/actions) - The platform that makes this automation possible

## Support

If you find this action helpful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs or suggesting features
- 📖 Improving documentation
- 🤝 Contributing code

---

**Made with ❤️ for the security-conscious developer community**
