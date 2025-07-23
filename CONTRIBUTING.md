# Contributing to TestLuy Payment SDK

We welcome contributions to the TestLuy Payment SDK! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We expect all contributors to treat each other with respect and create a welcoming environment for everyone.

## Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- npm 6.0.0 or higher
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/testluy-payment-sdk.git
   cd testluy-payment-sdk
   ```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables for testing:
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials
   ```

3. Run tests to ensure everything is working:
   ```bash
   npm test
   ```

## Making Changes

### Branch Naming

Use descriptive branch names with the following format:
- `feature/description` - for new features
- `fix/description` - for bug fixes
- `docs/description` - for documentation changes
- `refactor/description` - for code refactoring

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: add new payment method support`
- `fix: resolve rate limiting issue`
- `docs: update installation instructions`
- `test: add unit tests for retry logic`
- `refactor: improve error handling`

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Write unit tests for all new functions and methods
- Write integration tests for API interactions
- Maintain test coverage above 90%
- Use descriptive test names that explain the behavior being tested

### Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  test('should do something specific', async () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

## Submitting Changes

### Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update documentation if needed
3. Add or update tests for your changes
4. Ensure all tests pass
5. Update the CHANGELOG.md file
6. Submit a pull request with a clear title and description

### Pull Request Template

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have added integration tests if applicable

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
```

## Coding Standards

### JavaScript/ES6+

- Use ES6+ features (arrow functions, destructuring, async/await)
- Use `const` and `let` instead of `var`
- Use meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Use JSDoc comments for public APIs

### Code Style

- Use Prettier for code formatting
- Follow ESLint rules
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Maximum line length of 100 characters

### Error Handling

- Always handle errors appropriately
- Use specific error types when possible
- Provide meaningful error messages
- Log errors with appropriate detail level
- Never swallow errors silently

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for all public methods
- Include code examples in documentation
- Keep documentation up to date with code changes

## Architecture Guidelines

### File Organization

```
src/
├── http/                 # HTTP client and related utilities
│   ├── adapters/        # HTTP adapters
│   ├── errors/          # Error classes
│   ├── interceptors/    # Request/response interceptors
│   └── utils/           # Utility functions
├── examples/            # Example code
└── tests/               # Test files
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

### Design Principles

- **Single Responsibility**: Each class/function should have one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Composition over Inheritance**: Favor composition when possible
- **Fail Fast**: Validate inputs early and fail with clear error messages

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality additions
- PATCH version for backwards-compatible bug fixes

### Release Steps

1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create a release commit: `chore: release v1.2.3`
4. Create a git tag: `git tag v1.2.3`
5. Push changes and tags: `git push origin main --tags`
6. Publish to npm: `npm publish`

## Getting Help

- Check existing [GitHub Issues](https://github.com/chanboraseng/testluy-payment-sdk/issues)
- Review the [documentation](README.md)
- Ask questions in issue discussions
- Contact maintainers: support@testluy.com

## Recognition

Contributors will be recognized in:
- The project's README.md
- Release notes for significant contributions
- GitHub's contributor graph

Thank you for contributing to TestLuy Payment SDK! 🎉
