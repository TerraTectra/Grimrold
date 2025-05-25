#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
autoapply-x main module

This is the main entry point for the autoapply-x application.
It handles the monitoring of freelance marketplaces and responding to orders.
"""

import os
import sys
import asyncio
import logging
import argparse
from datetime import datetime
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import project modules
from core.scraper import Scraper
from core.responder import Responder
from core.sender import Sender

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join('data', 'autoapply.log'), encoding='utf-8')
    ]
)

logger = logging.getLogger('autoapply')

async def main():
    """
    Main function to run the scraper and display results
    """
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='autoapply-x: Automatic freelance order finder and responder')
    parser.add_argument('--scraper-config', type=str, default='config/scraper_config.yaml', help='Path to scraper configuration file')
    parser.add_argument('--responder-config', type=str, default='config/responder_config.yaml', help='Path to responder configuration file')
    parser.add_argument('--auth-state', action='store_true', help='Create authentication state file')
    parser.add_argument('--username', type=str, help='Username for authentication state creation')
    parser.add_argument('--password', type=str, help='Password for authentication state creation')
    parser.add_argument('--output', type=str, default='config/auth_state.json', help='Output path for authentication state file')
    parser.add_argument('--submit', action='store_true', help='Submit responses automatically')
    args = parser.parse_args()
    
    # Handle authentication state creation if requested
    if args.auth_state:
        if not args.username or not args.password:
            logger.error("Username and password required for authentication state creation")
            return
            
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.output)
        logger.info(f"Creating authentication state at {output_path}")
        
        success = await Sender.create_auth_state(args.username, args.password, output_path)
        if success:
            logger.info("Authentication state created successfully")
        else:
            logger.error("Failed to create authentication state")
            
        return
        
    # Create absolute paths for config files
    scraper_config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.scraper_config)
    responder_config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.responder_config)
    
    # Log startup information
    logger.info(f"Starting autoapply-x at {datetime.now().isoformat()}")
    logger.info(f"Using scraper configuration from {scraper_config_path}")
    logger.info(f"Using responder configuration from {responder_config_path}")
    
    try:
        # Initialize scraper, responder, and sender
        scraper = Scraper(scraper_config_path)
        responder = Responder(responder_config_path)
        sender = Sender(responder_config_path)  # We'll use the same config for responder and sender
        
        # Run scraper and get filtered orders
        logger.info("Running scraper...")
        orders = await scraper.run()
        
        # Generate responses for orders
        if orders:
            logger.info("Generating responses...")
            for i, order in enumerate(orders):
                logger.info(f"Processing order {i+1}/{len(orders)}: {order.get('title')}")
                processed_order = await responder.process_order(order)
                orders[i] = processed_order
            
            # Display results with new format
            print(f"\nFound {len(orders)} matching orders:\n")
            
            for i, order in enumerate(orders, 1):
                print(f"Order {i}:")
                print(f"🟩 {order.get('title')}")
                
                if order.get('response_generated', False):
                    print(f"🧠 {order.get('response')}")
                else:
                    print("🧠 [No response generated]")
                    
                print(f"📎 {order.get('link')}")
                
                # Submit response if enabled
                if args.submit:
                    logger.info(f"Submitting response for order: {order.get('title')}")
                    success, message = await sender.submit_response(order)
                    status = "👍 Успешно!" if success else f"👎 Ошибка: {message}"
                    print(f"📩 Статус отправки: {status}")
                
                print("-" * 80)
        else:
            print("No matching orders found.")
        
        # Save results to a file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        results_path = os.path.join('data', f'orders_{timestamp}.json')
        
        import json
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved {len(orders)} orders to {results_path}")
        
    except Exception as e:
        logger.error(f"Error running autoapply-x: {e}")

if __name__ == '__main__':
    # Run the async main function
    asyncio.run(main())
