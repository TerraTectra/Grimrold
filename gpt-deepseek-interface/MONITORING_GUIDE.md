# Monitoring System Guide

This guide provides instructions for testing and verifying the monitoring system for the GPT-DeepSeek Interface application.

## Prerequisites

- Docker and Docker Compose
- Python 3.8+
- Required Python packages (install with `pip install -r requirements.txt`)

## Components

The monitoring stack consists of:

1. **Prometheus** - Metrics collection and alerting
2. **Alertmanager** - Handles alerts and sends notifications
3. **Grafana** - Visualization and dashboards
4. **Node Exporter** - System metrics
5. **cAdvisor** - Container metrics
6. **Test Application** - Sample FastAPI app with metrics endpoints

## Quick Start

1. **Start the monitoring stack**:
   ```bash
   cd monitoring
   docker-compose up -d
   ```

2. **Start the test application**:
   ```bash
   # In a separate terminal
   python simple_monitor_test.py
   ```

3. **Access the UIs**:
   - Grafana: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090
   - Alertmanager: http://localhost:9093
   - Test Application: http://localhost:8000

## Testing Alerts

### 1. Test Alert Verification Script

Run the test script to verify alerting functionality:

```bash
python test_alert_verification.py
```

This script will:
1. Generate high error rates
2. Create high latency conditions
3. Guide you through testing service down scenarios

### 2. Manual Testing

#### Test High Error Rate
```bash
# Generate errors (run for 1-2 minutes)
for i in {1..60}; do curl http://localhost:8000/error; sleep 1; done
```

#### Test High Latency
```bash
# Generate CPU load
curl http://localhost:8000/load
```

#### Test Service Down
```bash
# Stop the test application and wait for alerts
# Then restart it
python simple_monitor_test.py
```

## Verifying Alerts

1. **Prometheus Alerts**:
   - Visit http://localhost:9090/alerts
   - Check that alerts appear in the "Firing" state when conditions are met

2. **Alertmanager**:
   - Visit http://localhost:9093
   - Verify that alerts are received by Alertmanager
   - Check the "Silences" section to manage alert muting

3. **Grafana**:
   - Log in to http://localhost:3000
   - Import the "Test Application Dashboard" from the JSON file
   - Verify that metrics are being displayed correctly

## Alert Rules

Alert rules are defined in `monitoring/prometheus/alert.rules`. Key alerts include:

- **HighCpuUsage**: CPU usage > 80%
- **HighMemoryUsage**: Memory usage > 85%
- **HighDiskUsage**: Disk usage > 85%
- **AppDown**: Application is down
- **HighRequestLatency**: 95th percentile latency > 1s
- **HighErrorRate**: Error rate > 5%

## Customizing Alerts

1. Edit `monitoring/prometheus/alert.rules` to modify alert conditions
2. Update `monitoring/alertmanager/config.yml` to change notification settings
3. Restart the monitoring stack to apply changes:
   ```bash
   cd monitoring
   docker-compose restart prometheus alertmanager
   ```

## Troubleshooting

1. **No metrics in Prometheus**:
   - Check if the test application is running
   - Verify Prometheus targets at http://localhost:9090/targets

2. **Alerts not firing**:
   - Check alert rules in Prometheus at http://localhost:9090/rules
   - Verify that the alert conditions are being met

3. **No notifications**:
   - Check Alertmanager logs: `docker-compose logs alertmanager`
   - Verify notification configuration in `config.yml`

## Cleanup

To stop and remove all containers:

```bash
cd monitoring
docker-compose down -v
```

## Production Considerations

For production use:

1. Set up proper authentication for all services
2. Configure persistent storage for Prometheus and Grafana
3. Set up proper alert channels (Email, Slack, PagerDuty, etc.)
4. Configure proper retention policies for metrics
5. Set up monitoring for the monitoring stack itself

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [Grafana Documentation](https://grafana.com/docs/)
- [cAdvisor Documentation](https://github.com/google/cadvisor/)
