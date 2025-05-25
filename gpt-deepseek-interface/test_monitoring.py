import requests
import random
import time
import logging
from logging_config import setup_logging, get_logger

# Set up logging
setup_logging("test_monitoring", "INFO")
logger = get_logger(__name__)

BASE_URL = "http://localhost:8000"

def test_normal_traffic(duration=60):
    """Generate normal traffic to the test application"""
    logger.info(f"Generating normal traffic for {duration} seconds")
    end_time = time.time() + duration
    request_count = 0
    
    while time.time() < end_time:
        try:
            # 80% chance of hitting the root endpoint
            if random.random() < 0.8:
                response = requests.get(f"{BASE_URL}/")
                logger.debug(f"GET / - {response.status_code}")
            # 15% chance of hitting the load endpoint
            elif random.random() < 0.15:
                response = requests.get(f"{BASE_URL}/load")
                logger.debug(f"GET /load - {response.status_code}")
            # 5% chance of hitting the error endpoint
            else:
                try:
                    response = requests.get(f"{BASE_URL}/error")
                    logger.debug(f"GET /error - {response.status_code}")
                except:
                    logger.debug("GET /error - 500 (expected error)")
            
            request_count += 1
            time.sleep(0.1)  # Small delay between requests
            
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            time.sleep(1)
    
    logger.info(f"Generated {request_count} requests")

def test_high_load(duration=60):
    """Generate high load to test alerts"""
    logger.info(f"Generating high load for {duration} seconds")
    end_time = time.time() + duration
    
    while time.time() < end_time:
        try:
            # Hit the load endpoint more frequently
            response = requests.get(f"{BASE_URL}/load")
            logger.debug(f"GET /load - {response.status_code}")
            
            # Also generate some errors
            if random.random() < 0.3:  # 30% chance of error
                try:
                    response = requests.get(f"{BASE_URL}/error")
                    logger.debug(f"GET /error - {response.status_code}")
                except:
                    logger.debug("GET /error - 500 (expected error)")
            
            time.sleep(0.05)  # Shorter delay for higher load
            
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            time.sleep(0.5)

if __name__ == "__main__":
    try:
        logger.info("Starting monitoring test")
        
        # Phase 1: Normal traffic
        logger.info("=== PHASE 1: Normal traffic ===")
        test_normal_traffic(120)  # 2 minutes of normal traffic
        
        # Phase 2: High load
        logger.info("=== PHASE 2: High load ===")
        test_high_load(300)  # 5 minutes of high load
        
        # Phase 3: Back to normal
        logger.info("=== PHASE 3: Back to normal ===")
        test_normal_traffic(120)  # 2 more minutes of normal traffic
        
        logger.info("Test completed successfully")
        
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Test failed: {str(e)}", exc_info=True)
