# CI/CD Deployment Guide

This document explains how to set up and use the CI/CD pipeline for automated testing and deployment of generated projects.

## Prerequisites

- GitHub repository for your project
- Python 3.10+ installed
- Docker (for local testing)

## Setup Instructions

### 1. Repository Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository Settings > Secrets and variables > Actions
2. Click "New repository secret" and add:

   - `SLACK_WEBHOOK_URL`: Your Slack incoming webhook URL (optional)
   - `TELEGRAM_TOKEN`: Your Telegram bot token (optional)
   - `TELEGRAM_TO`: Chat ID or channel ID for Telegram notifications (optional)
   - `CODECOV_TOKEN`: Codecov upload token (optional)

### 2. Workflow Configuration

The CI/CD pipeline is configured in `.github/workflows/ci-cd.yml`. By default, it:

- Runs on pushes to `main`/`master` branches
- Runs on pull requests to `main`/`master`
- Can be manually triggered from the Actions tab

### 3. Environment Variables

Update environment variables in `.github/workflows/ci-cd.yml` if needed:

```yaml
env:
  PYTHON_VERSION: '3.10'
  OLLAMA_VERSION: 'latest'
```

## Pipeline Stages

1. **Setup**
   - Checks out the code
   - Sets up Python environment
   - Installs Ollama and required dependencies

2. **Testing**
   - Runs unit tests with pytest
   - Generates code coverage report
   - Uploads coverage to Codecov (if token is provided)

3. **Deployment**
   - Deploys to staging environment (on main/master branch)
   - Only runs if all tests pass

4. **Notifications**
   - Sends success/failure notifications to:
     - GitHub Actions UI
     - Slack (if configured)
     - Telegram (if configured)

## Manual Deployment

To manually deploy a project:

```bash
python deploy_project.py <project_name> [--project-path PATH] [--no-test] [--force]
```

## Monitoring

- View workflow runs in the GitHub Actions tab
- Check deployment logs in the `deploy_logs` directory
- Monitor application logs in the deployment directory

## Troubleshooting

### Common Issues

1. **Tests failing**
   - Check the test logs in GitHub Actions
   - Run tests locally with `pytest -v`

2. **Deployment failures**
   - Verify all required environment variables are set
   - Check the deployment logs in `deploy_logs`

3. **Notification issues**
   - Verify webhook URLs and tokens
   - Check the workflow logs for authentication errors

## Security Considerations

- Never commit sensitive information to the repository
- Use GitHub Secrets for all credentials
- Review third-party actions before using them
- Regularly update dependencies for security patches
