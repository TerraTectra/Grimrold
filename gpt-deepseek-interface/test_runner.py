import os
import sys
import subprocess
import unittest
import time
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

# Configure logging
LOG_DIR = Path("test_logs")
LOG_DIR.mkdir(exist_ok=True)

# Create a timestamp for the log file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = LOG_DIR / f"test_run_{timestamp}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class TestCalculator(unittest.TestCase):
    """Test cases for the calculator application."""
    
    def test_addition(self):
        """Test addition operation."""
        result = self.run_calculator_operation('1', '5', '3')  # 5 + 3
        self.assertIn('8.0', result, "Addition test failed")
    
    def test_subtraction(self):
        """Test subtraction operation."""
        result = self.run_calculator_operation('2', '10', '4')  # 10 - 4
        self.assertIn('6.0', result, "Subtraction test failed")
    
    def test_multiplication(self):
        """Test multiplication operation."""
        result = self.run_calculator_operation('3', '7', '6')  # 7 * 6
        self.assertIn('42.0', result, "Multiplication test failed")
    
    def test_division(self):
        """Test division operation."""
        result = self.run_calculator_operation('4', '20', '5')  # 20 / 5
        self.assertIn('4.0', result, "Division test failed")
    
    def test_division_by_zero(self):
        """Test division by zero handling."""
        result = self.run_calculator_operation('4', '10', '0')  # 10 / 0
        self.assertIn('Cannot divide by zero', result, "Division by zero test failed")
    
    def run_calculator_operation(self, operation: str, num1: str, num2: str) -> str:
        """Run the calculator with the given inputs and return the output."""
        process = subprocess.Popen(
            [sys.executable, str(self.calculator_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send inputs
        inputs = [operation, num1, num2, '5']  # 5 to exit after operation
        output, error = process.communicate('\n'.join(inputs) + '\n')
        
        if error:
            logger.error(f"Error running calculator: {error}")
        
        return output + error

    @classmethod
    def setUpClass(cls):
        """Set up the test class."""
        cls.calculator_path = Path("generated_projects/calculator/simple_calculator.py")
        if not cls.calculator_path.exists():
            raise FileNotFoundError(f"Calculator not found at {cls.calculator_path}")
        logger.info(f"Testing calculator at: {cls.calculator_path}")

class TestRunner:
    """Main test runner for generated programs."""
    
    def __init__(self, project_dir: Path):
        """Initialize the test runner with the project directory."""
        self.project_dir = Path(project_dir).resolve()
        self.results = {
            "project": str(self.project_dir),
            "timestamp": datetime.now().isoformat(),
            "tests": []
        }
    
    def run_tests(self) -> bool:
        """Run all tests and return True if all tests passed."""
        logger.info(f"Starting tests for project: {self.project_dir}")
        
        # Run unit tests
        test_suite = unittest.TestLoader().loadTestsFromTestCase(TestCalculator)
        test_runner = unittest.TextTestRunner(verbosity=2)
        result = test_runner.run(test_suite)
        
        # Log results
        self.results["tests_passed"] = result.testsRun - len(result.failures) - len(result.errors)
        self.results["tests_failed"] = len(result.failures) + len(result.errors)
        self.results["success"] = result.wasSuccessful()
        
        # Save detailed results
        self._save_results()
        
        return result.wasSuccessful()
    
    def _save_results(self):
        """Save test results to a JSON file."""
        results_file = LOG_DIR / f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2)
        logger.info(f"Test results saved to: {results_file}")

def main():
    """Main entry point for the test runner."""
    try:
        project_dir = Path("generated_projects/calculator")
        if not project_dir.exists():
            raise FileNotFoundError(f"Project directory not found: {project_dir}")
        
        runner = TestRunner(project_dir)
        success = runner.run_tests()
        
        if success:
            logger.info("All tests passed successfully!")
        else:
            logger.error("Some tests failed. Check the logs for details.")
        
        return 0 if success else 1
        
    except Exception as e:
        logger.exception(f"Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
