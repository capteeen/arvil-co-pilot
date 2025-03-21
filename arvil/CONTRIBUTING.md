# Contributing to ARVIL

Thank you for your interest in contributing to ARVIL! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster an open and welcoming environment.

## How Can I Contribute?

There are many ways to contribute to ARVIL:

- Reporting bugs
- Suggesting enhancements
- Writing documentation
- Submitting code changes
- Helping with design
- Providing feedback

## Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/yourusername/arvil.git
   cd arvil
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Link the CLI for local development:
   ```bash
   npm link
   ```

## Development Workflow

1. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and test them
3. Make sure tests pass:
   ```bash
   npm test
   ```
4. Commit your changes:
   ```bash
   git commit -m "Description of changes"
   ```
5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Create a Pull Request from your fork to the main repository

## Pull Request Guidelines

- Fill in the required PR template
- Include tests for new features
- Update documentation as needed
- Ensure CI/tests pass
- Follow the existing code style
- Keep PRs focused on a single topic

## Commit Message Format

We follow a simple commit message format:

```
type: subject

body (optional)
```

Types include:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

## Testing

We use Jest for testing. Run tests with:

```bash
npm test
```

For coverage report:

```bash
npm test -- --coverage
```

## Style Guidelines

We use ESLint for JavaScript code style. Run the linter with:

```bash
npm run lint
```

## Working with Issues

- Look for issues labeled "good first issue" if you're new
- Comment on an issue if you're working on it
- Reference issues in your pull request

## License

By contributing to ARVIL, you agree that your contributions will be licensed under the project's [MIT License](LICENSE). 