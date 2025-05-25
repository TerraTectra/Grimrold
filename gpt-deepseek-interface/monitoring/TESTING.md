# Testing the Monitoring System

This document provides instructions for testing the monitoring and alerting setup.

## Prerequisites

1. Docker and Docker Compose installed
2. The monitoring stack running (`docker-compose up -d` in the monitoring directory)

## Running the Tests

### 1. Start the Monitoring Stack

```bash
cd monitoring
docker-compose up -d --build
```

### 2. Build and Start the Test Application

```bash
docker-compose up -d --build test-app
```

### 3. Verify the Monitoring Setup

```bash
# From the project root
python verify_monitoring.py
```

This will check if all monitoring components are working correctly.

### 4. Run the Load Test

```bash
# From the project root
python test_monitoring.py
```

This will:
1. Generate normal traffic for 2 minutes
2. Generate high load for 5 minutes (should trigger alerts)
3. Return to normal traffic for 2 minutes

## Accessing the Monitoring Tools

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **cAdvisor**: http://localhost:8080
- **Test Application**: http://localhost:8000

## Viewing Logs

Application logs are written to the `logs/` directory in the project root.

You can also view logs in Grafana using the Loki data source:
1. Go to http://localhost:3000/explore
2. Select "Loki" as the data source
3. Use this query: `{job="test-app"}`

## Testing Alerts

1. **High Error Rate**: The test script will generate random errors at the `/error` endpoint
2. **High Load**: The test script will generate CPU load at the `/load` endpoint
3. **System Metrics**: The monitoring stack will automatically track CPU, memory, and disk usage

## Cleanup

To stop and remove all containers:

```bash
cd monitoring
docker-compose down -v
```

## Troubleshooting

1. If Prometheus can't scrape metrics:
   - Check the Prometheus targets page: http://localhost:9090/targets
   - Ensure the test-app container is running: `docker ps | grep test-app`

2. If Grafana dashboards aren't showing data:
   - Check that the Prometheus data source is configured correctly in Grafana
   - Verify that metrics are being collected in Prometheus

3. If alerts aren't firing:
   - Check the Alertmanager status page: http://localhost:9093/#/alerts
   - Verify that the alert rules are loaded in Prometheus: http://localhost:9090/rules
