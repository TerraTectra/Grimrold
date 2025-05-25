#!/usr/bin/env python3
"""
Deployment script for generated projects.

This script handles the deployment of generated projects to a target environment.
It includes testing, deployment, and notification capabilities.
"""
import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.absolute()))

from deploy.deployer import DeploymentManager, DeploymentError
from deploy.config import get_settings, DEPLOY_DIR, LOG_DIR

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'deploy.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Deploy a generated project.')
    
    parser.add_argument(
        'project_name',
        type=str,
        help='Name of the project to deploy'
    )
    
    parser.add_argument(
        '--project-path',
        type=str,
        default=None,
        help='Path to the project directory (default: generated_projects/<project_name>)'
    )
    
    parser.add_argument(
        '--no-test',
        action='store_true',
        help='Skip running tests before deployment'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force deployment even if tests fail'
    )
    
    return parser.parse_args()

def run_tests(project_path: Path) -> bool:
    """Run tests for the project.
    
    Args:
        project_path: Path to the project directory
        
    Returns:
        bool: True if tests passed, False otherwise
    """
    logger.info("Running tests...")
    
    try:
        # Import test_runner here to avoid circular imports
        from test_runner import TestRunner
        
        runner = TestRunner(project_path)
        return runner.run_tests()
    except Exception as e:
        logger.error(f"Error running tests: {str(e)}")
        return False

def main() -> int:
    """Main entry point for the deployment script."""
    args = parse_arguments()
    
    # Set up project paths
    project_name = args.project_name
    project_path = (
        Path(args.project_path) 
        if args.project_path 
        else Path("generated_projects") / project_name
    )
    
    if not project_path.exists():
        logger.error(f"Project directory not found: {project_path}")
        return 1
    
    # Run tests if not skipped
    if not args.no_test:
        logger.info("Running pre-deployment tests...")
        tests_passed = run_tests(project_path)
        
        if not tests_passed and not args.force:
            logger.error("Tests failed. Use --force to deploy anyway.")
            return 1
    
    # Deploy the project
    try:
        logger.info(f"Starting deployment of {project_name}")
        
        deployer = DeploymentManager(project_name, project_path)
        success = deployer.deploy()
        
        if success:
            logger.info(f"Successfully deployed {project_name}")
            return 0
        else:
            logger.error(f"Failed to deploy {project_name}")
            return 1
            
    except DeploymentError as e:
        logger.error(f"Deployment error: {str(e)}")
        return 1
    except Exception as e:
        logger.exception("Unexpected error during deployment")
        return 1

if __name__ == "__main__":
    sys.exit(main())
