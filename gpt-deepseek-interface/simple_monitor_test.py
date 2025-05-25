import random
import time
import logging
import uvicorn
import requests
import threading
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST, make_asgi_app

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('test-app')

app = FastAPI()

# Prometheus metrics
REQUEST_COUNTER = Counter(
    'http_requests_total',
    'Total HTTP Requests',
    ['method', 'endpoint', 'http_status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint']
)

# Add middleware for metrics
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    method = request.method
    endpoint = request.url.path
    
    try:
        response = await call_next(request)
        status_code = response.status_code
        
        # Record metrics
        REQUEST_COUNTER.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(time.time() - start_time)
        
        return response
    except Exception as e:
        status_code = 500
        REQUEST_COUNTER.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
        raise e

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Hello World"}

@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/error")
async def error_endpoint():
    logger.warning("Simulating an error")
    try:
        if random.random() > 0.5:
            raise Exception("Random error occurred")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error in error_endpoint: {str(e)}")
        raise Exception("Error")

@app.get("/load")
async def generate_load():
    logger.info("Generating CPU load")
    # Generate some CPU load
    for _ in range(1000000):
        _ = random.random() * random.random()
    
    REQUEST_COUNTER.labels(method="GET", endpoint="/load", status="200").inc()
    REQUEST_LATENCY.labels(endpoint="/load").observe(time.time() - start_time)
    return {"status": "load generated"}

def run_test_traffic(duration=30):
    """Generate test traffic to the application"""
    logger.info(f"Generating test traffic for {duration} seconds...")
    end_time = time.time() + duration
    request_count = 0
    
    while time.time() < end_time:
        try:
            # 80% root, 15% load, 5% error
            r = random.random()
            if r < 0.8:
                response = requests.get("http://localhost:8001/")
                logger.debug(f"GET / - {response.status_code}")
            elif r < 0.95:
                response = requests.get("http://localhost:8001/load")
                logger.debug(f"GET /load - {response.status_code}")
            else:
                try:
                    response = requests.get("http://localhost:8001/error")
                    logger.debug(f"GET /error - {response.status_code}")
                except:
                    logger.debug("GET /error - 500 (expected error)")
            
            request_count += 1
            time.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            time.sleep(1)
    
    logger.info(f"Generated {request_count} requests")
    return request_count

def start_server():
    """Start the FastAPI server"""
    port = 8001
    logger.info(f"Starting test server on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Application with Metrics')
    parser.add_argument('--test', action='store_true', help='Run test traffic')
    args = parser.parse_args()
    
    if args.test:
        # Start the server in a separate thread
        import threading
        server_thread = threading.Thread(
            target=start_server,
            daemon=True
        )
        server_thread.start()
        
        # Give server time to start
        time.sleep(2)
        
        # Run test traffic
        try:
            run_test_traffic(60)  # Run for 1 minute
        except KeyboardInterrupt:
            logger.info("Test interrupted by user")
    else:
        # Just start the server
        start_server()
