# Contributing to AI Licia Integrations

Thank you for considering contributing to this project! Your help is essential for making these integrations better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

Before creating bug reports, please check the issue tracker as you might find that the issue is already reported. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue
* **Describe the exact steps to reproduce the problem** with as much detail as possible
* **Provide specific examples** to demonstrate the steps
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots or animated GIFs** if possible
* **If the problem is related to performance or memory**, include a CPU profile capture with your report
* **If the console shows any errors**, include the error message and stack trace

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality:

* **Use a clear and descriptive title** for the issue
* **Provide a step-by-step description of the suggested enhancement** with as much detail as possible
* **Provide specific examples to demonstrate the steps or point out the part of the project that the suggestion is related to**
* **Describe the current behavior and explain which behavior you expected to see instead and why**
* **Explain why this enhancement would be useful** to most users
* **List some other tools or applications where this enhancement exists**

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through `beginner` and `help-wanted` issues:

* **Beginner issues** - issues that should only require a few lines of code, and a test or two
* **Help wanted issues** - issues that might be a bit more involved than `beginner` issues

### Pull Requests

The process described here aims to:
* Maintain the project's quality
* Fix problems that are important to users
* Enable a sustainable system for the project's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. **Follow all instructions in the PR template**
2. **Follow the style guides**
3. **After you submit your pull request, verify that all status checks are passing**

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

## Style Guides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* When only changing documentation, include `[docs]` in the commit title
* Consider starting the commit message with an applicable emoji:
  * 🎨 `:art:` when improving the format/structure of the code
  * 🐎 `:racehorse:` when improving performance
  * 🚱 `:non-potable_water:` when plugging memory leaks
  * 📝 `:memo:` when writing docs
  * 🐛 `:bug:` when fixing a bug
  * 🔥 `:fire:` when removing code or files
  * 💚 `:green_heart:` when fixing the CI build
  * ✅ `:white_check_mark:` when adding tests
  * 🔒 `:lock:` when dealing with security

### JavaScript & TypeScript Style Guide

* Use 2 spaces for indentation
* Use semicolons
* Prefer `const` over `let`. Only use `let` when absolutely necessary
* Prefer arrow functions
* Use template literals instead of string concatenation
* Use destructuring when it makes the code clearer
* Use the spread operator instead of `.apply()`
* Use async/await over Promise chains when possible

### Documentation Style Guide

* Use [Markdown](https://guides.github.com/features/mastering-markdown/)
* Reference methods and classes in brackets: `[Class.method]`
* Reference packages, modules, or libraries in bold: `**package**`
* Use code blocks with appropriate language annotation

## Additional Notes

### Issue and Pull Request Labels

This project uses labels to help organize and identify issues. Here's what they mean:

* `bug` - Issues for unexpected behaviors or problems
* `documentation` - Issues for improving or adding to documentation
* `enhancement` - Issues for new features or improvements
* `good first issue` - Good issues for newcomers to the project
* `help wanted` - Extra attention is needed on these issues
* `question` - Issues that are questions or need more information

Thank you for contributing to our project! 