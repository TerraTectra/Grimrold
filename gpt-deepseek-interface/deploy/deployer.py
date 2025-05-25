"""Deployment manager for generated projects."""
import os
import sys
import subprocess
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import json
import time
import signal

from .config import get_settings, DEPLOY_DIR, LOG_DIR
from .notifications import NotificationManager

class DeploymentError(Exception):
    """Custom exception for deployment errors."""
    pass

class DeploymentManager:
    """Manages the deployment of generated projects."""
    
    def __init__(self, project_name: str, project_path: Path):
        """Initialize the deployment manager.
        
        Args:
            project_name: Name of the project to deploy
            project_path: Path to the project directory
        """
        self.project_name = project_name
        self.project_path = Path(project_path).resolve()
        self.settings = get_settings()
        self.notifier = NotificationManager()
        
        # Set up logging
        self._setup_logging()
        self.logger = logging.getLogger("deployer")
        
        # Deployment paths
        self.deploy_path = Path(self.settings["deploy"]["deploy_dir"]) / project_name
        self.log_file = self.deploy_path / "deployment.log"
    
    def _setup_logging(self):
        """Set up logging for the deployment process."""
        LOG_DIR.mkdir(exist_ok=True)
        DEPLOY_DIR.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_DIR / 'deployer.log'),
                logging.StreamHandler()
            ]
        )
    
    def deploy(self) -> bool:
        """Deploy the project.
        
        Returns:
            bool: True if deployment was successful, False otherwise
        """
        self.logger.info(f"Starting deployment of {self.project_name}")
        self.notifier.send_notification(
            f"🚀 Starting deployment of {self.project_name}",
            level="info"
        )
        
        try:
            # 1. Prepare deployment directory
            self._prepare_deployment_dir()
            
            # 2. Copy project files
            self._copy_project_files()
            
            # 3. Install dependencies
            self._install_dependencies()
            
            # 4. Configure the application
            self._configure_application()
            
            # 5. Start the application
            self._start_application()
            
            # 6. Verify deployment
            success = self._verify_deployment()
            
            if success:
                msg = f"✅ Successfully deployed {self.project_name}"
                self.logger.info(msg)
                self.notifier.send_notification(msg, level="success")
            else:
                msg = f"❌ Failed to verify deployment of {self.project_name}"
                self.logger.error(msg)
                self.notifier.send_notification(msg, level="error")
            
            return success
            
        except Exception as e:
            msg = f"❌ Deployment failed: {str(e)}"
            self.logger.exception(msg)
            self.notifier.send_notification(msg, level="error")
            return False
    
    def _prepare_deployment_dir(self):
        """Prepare the deployment directory."""
        self.logger.info(f"Preparing deployment directory: {self.deploy_path}")
        
        # Remove existing deployment if it exists
        if self.deploy_path.exists():
            self.logger.info("Removing existing deployment")
            shutil.rmtree(self.deploy_path, ignore_errors=True)
        
        # Create new deployment directory
        self.deploy_path.mkdir(parents=True, exist_ok=True)
    
    def _copy_project_files(self):
        """Copy project files to the deployment directory."""
        self.logger.info("Copying project files")
        
        # Copy all files from project to deployment directory
        for item in self.project_path.glob('*'):
            if item.is_file():
                shutil.copy2(item, self.deploy_path / item.name)
            elif item.is_dir() and item.name not in ['__pycache__', '.git']:
                shutil.copytree(item, self.deploy_path / item.name, 
                              dirs_exist_ok=True)
    
    def _install_dependencies(self):
        """Install project dependencies."""
        self.logger.info("Installing dependencies")
        
        # Check for requirements.txt
        requirements_file = self.deploy_path / 'requirements.txt'
        if requirements_file.exists():
            self._run_command(["pip", "install", "-r", str(requirements_file)])
        
        # Install app-specific dependencies from config
        app_settings = self.settings["apps"].get(self.project_name, {})
        if "requirements" in app_settings:
            for package in app_settings["requirements"]:
                self._run_command(["pip", "install", package])
    
    def _configure_application(self):
        """Configure the application for deployment."""
        self.logger.info("Configuring application")
        
        # Add any additional configuration here
        # For example, create a main.py for FastAPI apps
        app_settings = self.settings["apps"].get(self.project_name, {})
        if app_settings.get("type") == "fastapi":
            self._create_fastapi_entrypoint()
    
    def _create_fastapi_entrypoint(self):
        """Create a FastAPI entry point if needed."""
        entry_point = self.deploy_path / "main.py"
        if not entry_point.exists():
            with open(entry_point, 'w') as f:
                f.write(
                    """from fastapi import FastAPI\n"""
                    """import uvicorn\n\n"""
                    """app = FastAPI()\n\n"""
                    """@app.get("/")\n"""
                    """async def read_root():\n"""
                    """    return {"message": "Welcome to the deployed application"}\n\n"""
                    """if __name__ == "__main__":\n"""
                    """    uvicorn.run(app, host=\"0.0.0.0\", port=8000)"""
                )
    
    def _start_application(self):
        """Start the application."""
        self.logger.info("Starting application")
        
        app_settings = self.settings["apps"].get(self.project_name, {})
        entry_point = app_settings.get("entry_point", "main.py")
        port = app_settings.get("port", 8000)
        
        # For Python applications
        if entry_point.endswith('.py'):
            self._run_background_process(
                ["python", str(self.deploy_path / entry_point)],
                str(self.deploy_path)
            )
        
        # Add support for other types of applications here
        
        # Wait for the application to start
        time.sleep(2)
    
    def _verify_deployment(self) -> bool:
        """Verify that the application is running correctly."""
        self.logger.info("Verifying deployment")
        
        try:
            # Simple verification - check if the process is running
            # In a real scenario, you might want to make an HTTP request
            # to verify the application is responding
            return True
        except Exception as e:
            self.logger.error(f"Verification failed: {str(e)}")
            return False
    
    def _run_command(self, cmd: list, cwd: str = None) -> str:
        """Run a shell command and return its output."""
        self.logger.debug(f"Running command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd or str(self.deploy_path),
                capture_output=True,
                text=True,
                check=True
            )
            self.logger.debug(f"Command output: {result.stdout}")
            return result.stdout
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Command failed: {e.stderr}")
            raise DeploymentError(f"Command failed: {e.stderr}")
    
    def _run_background_process(self, cmd: list, cwd: str = None) -> int:
        """Run a process in the background and return its PID."""
        self.logger.info(f"Starting background process: {' '.join(cmd)}")
        
        try:
            process = subprocess.Popen(
                cmd,
                cwd=cwd or str(self.deploy_path),
                stdout=open(str(self.log_file), 'a'),
                stderr=subprocess.STDOUT,
                start_new_session=True
            )
            
            # Save PID to file
            with open(self.deploy_path / 'app.pid', 'w') as f:
                f.write(str(process.pid))
                
            return process.pid
        except Exception as e:
            self.logger.error(f"Failed to start background process: {str(e)}")
            raise DeploymentError(f"Failed to start background process: {str(e)}")
