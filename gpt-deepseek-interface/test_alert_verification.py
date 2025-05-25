import requests
import time
import random
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('alert_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('alert-test')

def test_high_error_rate(base_url, duration_min=2):
    """Test high error rate alert by generating errors"""
    logger.info("\n=== Testing High Error Rate Alert ===")
    logger.info(f"Generating errors for {duration_min} minutes...")
    
    end_time = datetime.now() + timedelta(minutes=duration_min)
    while datetime.now() < end_time:
        try:
            # 80% chance of error
            if random.random() < 0.8:
                response = requests.get(f"{base_url}/error")
                logger.debug(f"Error request: {response.status_code}")
            else:
                response = requests.get(base_url)
                logger.debug(f"Normal request: {response.status_code}")
            
            time.sleep(0.5)
        except Exception as e:
            logger.error(f"Request failed: {e}")
    
    logger.info("High error rate test completed")

def test_high_latency(base_url, duration_min=2):
    """Test high latency alert by generating slow responses"""
    logger.info("\n=== Testing High Latency Alert ===")
    logger.info(f"Generating slow responses for {duration_min} minutes...")
    
    end_time = datetime.now() + timedelta(minutes=duration_min)
    while datetime.now() < end_time:
        try:
            # Call the /load endpoint to simulate high CPU usage
            response = requests.get(f"{base_url}/load")
            logger.debug(f"Load request: {response.status_code}")
            time.sleep(1)
        except Exception as e:
            logger.error(f"Load request failed: {e}")
    
    logger.info("High latency test completed")

def test_service_down(base_url, duration_min=1):
    """Test service down alert by stopping the service"""
    logger.info("\n=== Testing Service Down Alert ===")
    logger.info("This test requires manual intervention to stop the service.")
    logger.info(f"Please stop the test application and wait for {duration_min} minute(s)...")
    
    # Wait for the specified duration
    time.sleep(duration_min * 60)
    
    logger.info("Service down test completed")
    logger.info("Please restart the test application when done.")

def verify_alerts(prometheus_url, alert_name, timeout_min=5):
    """Verify that an alert is firing in Prometheus"""
    logger.info(f"\nVerifying alert: {alert_name}")
    end_time = datetime.now() + timedelta(minutes=timeout_min)
    
    while datetime.now() < end_time:
        try:
            response = requests.get(
                f"{prometheus_url}/api/v1/alerts",
                params={'silenced': 'false', 'inhibited': 'false'}
            )
            alerts = response.json().get('data', {}).get('alerts', [])
            
            for alert in alerts:
                if alert['labels'].get('alertname') == alert_name and alert['state'] == 'firing':
                    logger.info(f"✅ Alert '{alert_name}' is firing")
                    return True
            
            logger.debug(f"Alert '{alert_name}' not yet firing, checking again in 10 seconds...")
            time.sleep(10)
            
        except Exception as e:
            logger.error(f"Error checking alerts: {e}")
            time.sleep(10)
    
    logger.warning(f"❌ Alert '{alert_name}' did not fire within {timeout_min} minutes")
    return False

def main():
    base_url = "http://localhost:8000"
    prometheus_url = "http://localhost:9090"
    
    logger.info("Starting alert verification tests...")
    
    # Test 1: High Error Rate
    test_high_error_rate(base_url, duration_min=2)
    verify_alerts(prometheus_url, "HighErrorRate")
    
    # Test 2: High Latency
    test_high_latency(base_url, duration_min=2)
    verify_alerts(prometheus_url, "HighRequestLatency")
    
    # Test 3: Service Down (requires manual intervention)
    test_service_down(base_url, duration_min=1)
    verify_alerts(prometheus_url, "AppDown")
    
    logger.info("\n=== Alert Verification Tests Complete ===")
    logger.info("Check the Alertmanager and Grafana dashboards to verify alerts were triggered correctly.")

if __name__ == "__main__":
    main()
