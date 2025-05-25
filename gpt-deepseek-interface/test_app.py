from fastapi import FastAPI, Response, status
import random
import time
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import logging
from logging_config import setup_logging, get_logger

# Set up logging
setup_logging("test_app", "INFO")
logger = get_logger(__name__)

app = FastAPI()

# Prometheus metrics
REQUEST_COUNTER = Counter(
    'http_requests_total',
    'Total HTTP Requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP Request Latency',
    ['endpoint']
)

@app.get("/")
async def root():
    start_time = time.time()
    logger.info("Root endpoint called")
    REQUEST_COUNTER.labels(method="GET", endpoint="/", status="200").inc()
    REQUEST_LATENCY.labels(endpoint="/").observe(time.time() - start_time)
    return {"message": "Hello World"}

@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/error")
async def error_endpoint():
    start_time = time.time()
    try:
        logger.warning("Simulating an error")
        if random.random() > 0.5:
            raise Exception("Random error occurred")
        REQUEST_COUNTER.labels(method="GET", endpoint="/error", status="200").inc()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error in error_endpoint: {str(e)}")
        REQUEST_COUNTER.labels(method="GET", endpoint="/error", status="500").inc()
        raise
    finally:
        REQUEST_LATENCY.labels(endpoint="/error").observe(time.time() - start_time)

@app.get("/load")
async def generate_load():
    start_time = time.time()
    logger.info("Generating CPU load")
    # Generate some CPU load
    for _ in range(1000000):
        _ = random.random() * random.random()
    
    REQUEST_COUNTER.labels(method="GET", endpoint="/load", status="200").inc()
    REQUEST_LATENCY.labels(endpoint="/load").observe(time.time() - start_time)
    return {"status": "load generated"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
