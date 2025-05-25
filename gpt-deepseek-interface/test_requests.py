import requests
import time
import random

import concurrent.futures
import threading

# Thread-local storage for session objects
thread_local = threading.local()

def get_session():
    if not hasattr(thread_local, 'session'):
        thread_local.session = requests.Session()
    return thread_local.session

def make_request(url):
    session = get_session()
    try:
        start_time = time.time()
        response = session.get(url, timeout=5)
        elapsed = (time.time() - start_time) * 1000  # in milliseconds
        return {
            'url': url,
            'status_code': response.status_code,
            'elapsed': elapsed,
            'success': True
        }
    except Exception as e:
        return {
            'url': url,
            'error': str(e),
            'success': False
        }

def test_endpoints(base_url="http://localhost:8001", num_requests=100, num_workers=10):
    endpoints = [
        ("/", 0.6),           # Root endpoint - 60%
        ("/load", 0.2),       # CPU load endpoint - 20%
        ("/error", 0.1),      # Error endpoint - 10%
        ("/metrics", 0.1)     # Metrics endpoint - 10%
    ]
    
    # Generate weighted endpoints list
    weighted_endpoints = []
    for endpoint, weight in endpoints:
        count = max(1, int(num_requests * weight))
        weighted_endpoints.extend([endpoint] * count)
    
    # Ensure we have exactly num_requests
    weighted_endpoints = weighted_endpoints[:num_requests]
    random.shuffle(weighted_endpoints)
    
    print(f"Testing {len(weighted_endpoints)} endpoints on {base_url} using {num_workers} workers")
    
    # Track statistics
    stats = {
        'total_requests': 0,
        'successful_requests': 0,
        'failed_requests': 0,
        'total_time': 0,
        'status_codes': {},
        'endpoint_stats': {}
    }
    
    # Function to process a batch of URLs
    def process_batch(batch, batch_num, total_batches):
        batch_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
            future_to_url = {executor.submit(make_request, f"{base_url}{endpoint}"): endpoint for endpoint in batch}
            for future in concurrent.futures.as_completed(future_to_url):
                result = future.result()
                batch_results.append(result)
                
                # Update statistics
                with threading.Lock():
                    stats['total_requests'] += 1
                    if result['success']:
                        stats['successful_requests'] += 1
                        status_code = result['status_code']
                        stats['status_codes'][status_code] = stats['status_codes'].get(status_code, 0) + 1
                        stats['total_time'] += result['elapsed']
                        
                        # Track endpoint stats
                        endpoint = result['url'].replace(base_url, '')
                        if endpoint not in stats['endpoint_stats']:
                            stats['endpoint_stats'][endpoint] = {
                                'count': 0,
                                'total_time': 0,
                                'min_time': float('inf'),
                                'max_time': 0
                            }
                        
                        endpoint_stats = stats['endpoint_stats'][endpoint]
                        endpoint_stats['count'] += 1
                        endpoint_stats['total_time'] += result['elapsed']
                        endpoint_stats['min_time'] = min(endpoint_stats['min_time'], result['elapsed'])
                        endpoint_stats['max_time'] = max(endpoint_stats['max_time'], result['elapsed'])
                    else:
                        stats['failed_requests'] += 1
                    
                    # Print progress
                    if stats['total_requests'] % 10 == 0 or stats['total_requests'] == len(weighted_endpoints):
                        print(f"\rProgress: {stats['total_requests']}/{len(weighted_endpoints)} "
                              f"({stats['successful_requests']} OK, {stats['failed_requests']} failed)", end='')
        
        return batch_results
    
    # Process in batches to avoid memory issues with large numbers of requests
    batch_size = 100
    all_results = []
    total_batches = (len(weighted_endpoints) + batch_size - 1) // batch_size
    
    for i in range(0, len(weighted_endpoints), batch_size):
        batch = weighted_endpoints[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        batch_results = process_batch(batch, batch_num, total_batches)
        all_results.extend(batch_results)
    
    # Print summary
    print("\n\n=== Test Summary ===")
    print(f"Total requests: {stats['total_requests']}")
    print(f"Successful requests: {stats['successful_requests']} ({(stats['successful_requests']/stats['total_requests'])*100:.1f}%)")
    print(f"Failed requests: {stats['failed_requests']} ({(stats['failed_requests']/stats['total_requests'])*100:.1f}%)")
    
    if stats['successful_requests'] > 0:
        avg_response_time = stats['total_time'] / stats['successful_requests']
        print(f"Average response time: {avg_response_time:.2f}ms")
    
    print("\nStatus Codes:")
    for code, count in stats['status_codes'].items():
        print(f"  {code}: {count} ({(count/stats['total_requests'])*100:.1f}%)")
    
    print("\nEndpoint Statistics:")
    for endpoint, ep_stats in stats['endpoint_stats'].items():
        avg_time = ep_stats['total_time'] / ep_stats['count']
        print(f"{endpoint}:")
        print(f"  Requests: {ep_stats['count']}")
        print(f"  Avg Time: {avg_time:.2f}ms")
        print(f"  Min Time: {ep_stats['min_time']:.2f}ms")
        print(f"  Max Time: {ep_stats['max_time']:.2f}ms")
    
    return all_results

if __name__ == "__main__":
    test_endpoints()
