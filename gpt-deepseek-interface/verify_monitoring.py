import requests
import time
from datetime import datetime, timedelta
from logging_config import setup_logging, get_logger

# Set up logging
setup_logging("verify_monitoring", "INFO")
logger = get_logger(__name__)

PROMETHEUS_URL = "http://localhost:9090/api/v1/query"
GRAFANA_URL = "http://localhost:3000"
LOKI_URL = "http://localhost:3100/loki/api/v1/query_range"

def check_prometheus_metrics():
    """Check if Prometheus is collecting metrics"""
    try:
        # Check if Prometheus is up
        response = requests.get(f"{PROMETHEUS_URL}?query=up", timeout=5)
        response.raise_for_status()
        
        # Check if our test app metrics are being collected
        response = requests.get(f"{PROMETHEUS_URL}?query=up{{job='test-app'}}", timeout=5)
        data = response.json()
        
        if data['status'] != 'success':
            raise Exception("Prometheus query failed")
            
        if not data['data']['result']:
            raise Exception("No test-app metrics found in Prometheus")
            
        logger.info("✅ Prometheus is collecting metrics from test-app")
        return True
        
    except Exception as e:
        logger.error(f"❌ Prometheus check failed: {str(e)}")
        return False

def check_grafana_dashboard():
    """Check if Grafana dashboard is accessible"""
    try:
        # Try to access Grafana
        response = requests.get(GRAFANA_URL, timeout=5)
        response.raise_for_status()
        logger.info("✅ Grafana is accessible")
        return True
        
    except Exception as e:
        logger.error(f"❌ Grafana check failed: {str(e)}")
        return False

def check_loki_logs():
    """Check if Loki is collecting logs"""
    try:
        # Query logs from the last 5 minutes
        end = datetime.utcnow()
        start = end - timedelta(minutes=5)
        
        params = {
            'query': '{job=~"test-app|containers"}',
            'start': start.timestamp(),
            'end': end.timestamp(),
            'limit': 1
        }
        
        response = requests.get(LOKI_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] != 'success':
            raise Exception("Loki query failed")
            
        if not data['data']['result']:
            logger.warning("⚠️ No logs found in Loki (this might be normal if the test just started)")
            return True
            
        logger.info("✅ Loki is collecting logs")
        return True
        
    except Exception as e:
        logger.error(f"❌ Loki check failed: {str(e)}")
        return False

def check_alertmanager():
    """Check if Alertmanager is running"""
    try:
        # Check if Alertmanager is up
        response = requests.get("http://localhost:9093/-/healthy", timeout=5)
        response.raise_for_status()
        
        # Check if we can get alerts
        response = requests.get("http://localhost:9093/api/v2/alerts", timeout=5)
        response.raise_for_status()
        
        alerts = response.json()
        logger.info(f"✅ Alertmanager is running with {len(alerts)} active alerts")
        return True
        
    except Exception as e:
        logger.error(f"❌ Alertmanager check failed: {str(e)}")
        return False

def main():
    logger.info("=== Starting Monitoring Verification ===")
    
    checks = {
        "Prometheus": check_prometheus_metrics,
        "Grafana": check_grafana_dashboard,
        "Loki": check_loki_logs,
        "Alertmanager": check_alertmanager
    }
    
    all_passed = True
    for name, check_func in checks.items():
        logger.info(f"\n🔍 Checking {name}...")
        if not check_func():
            all_passed = False
    
    if all_passed:
        logger.info("\n✅ All monitoring components are working correctly!")
    else:
        logger.warning("\n⚠️ Some monitoring checks failed. Please review the logs above.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
