# Contributing to Trivy PR Decorator

Thank you for your interest in contributing! This guide will help you get started.

## Development Workflow

### Making Changes

1. **Fork and clone** the repository
2. **Create a branch** for your changes
3. **Make your changes** to the source code
4. **Write tests** for any new functionality
5. **Run tests** to ensure everything works: `npm test`
6. **Build the distribution**: `npm run build` ⚠️ **IMPORTANT**
7. **Commit your changes** including the `dist/` folder

### Important: Building Before Committing

This action uses `@vercel/ncc` to bundle all dependencies into a single file. You **must** run the build command before committing:

```bash
npm run build
git add dist/
git commit -m "Your commit message"
```

**Why?** GitHub Actions runs the code from the `dist/` folder, not from `node_modules`. If you don't build and commit the dist folder, the action will fail with "Cannot find module" errors.

### Testing

Run the full test suite:

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Property-based tests only
npm run test:properties

# With coverage
npm run test:coverage
```

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Build the distribution (`npm run build`)
4. Commit the `dist/` folder
5. Create a pull request with a clear description

### Questions?

Open an issue if you have questions or need help!
