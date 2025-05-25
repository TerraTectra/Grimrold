#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Scraper module for autoapply-x

This module is responsible for parsing freelance marketplaces (Kwork, etc.)
to find new orders matching user's criteria.
"""

import asyncio
from typing import Dict, List, Optional
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import httpx
import json
import os
import logging
from datetime import datetime

# Import marketplace-specific scrapers
from core.scraper_freelancehunt import FreelanceHuntScraper

class Scraper:
    def __init__(self, config_path: str):
        """
        Initialize the scraper with configuration
        
        Args:
            config_path: Path to the configuration file with marketplace settings
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.logger = logging.getLogger('autoapply.scraper')
    
    def _load_config(self) -> Dict:
        """
        Load scraper configuration from file
        
        Returns:
            Dict: Configuration dictionary
        """
        config = {}
        try:
            # Load configuration from YAML or JSON file
            with open(self.config_path, 'r', encoding='utf-8') as f:
                if self.config_path.endswith('.json'):
                    config = json.load(f)
                else:
                    # Assuming YAML if not JSON
                    import yaml
                    config = yaml.safe_load(f)
                    
            # Load keywords from keywords.txt file
            keywords_path = os.path.join(os.path.dirname(self.config_path), 'keywords.txt')
            if os.path.exists(keywords_path):
                keywords, excluded_keywords = self._load_keywords(keywords_path)
                config['keywords'] = keywords
                config['excluded_keywords'] = excluded_keywords
                
            return config
        except Exception as e:
            self.logger.error(f"Failed to load config: {e}")
            return {}
            
    def _load_keywords(self, keywords_path: str) -> tuple:
        """
        Load keywords from a text file
        
        Args:
            keywords_path: Path to the keywords file
            
        Returns:
            tuple: (keywords, excluded_keywords)
        """
        keywords = []
        excluded_keywords = []
        
        try:
            with open(keywords_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # Skip empty lines and comments
                    if not line or line.startswith('#'):
                        continue
                        
                    # Check if it's an excluded keyword
                    if line.startswith('!'):
                        excluded_keywords.append(line[1:])
                    else:
                        keywords.append(line)
                        
            self.logger.info(f"Loaded {len(keywords)} keywords and {len(excluded_keywords)} excluded keywords")
            return keywords, excluded_keywords
        except Exception as e:
            self.logger.error(f"Failed to load keywords: {e}")
            return [], []
    
    async def scrape_kwork(self) -> List[Dict]:
        """
        Scrape orders from Kwork marketplace
        
        Returns:
            List[Dict]: List of order dictionaries
        """
        orders = []
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Navigate to Kwork orders page
                await page.goto(self.config.get('kwork', {}).get('url', 'https://kwork.ru/projects'))
                
                # Wait for projects to load
                await page.wait_for_selector('.card__content')
                
                # Extract orders
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                order_cards = soup.select('.card__content')
                
                for card in order_cards:
                    try:
                        title_elem = card.select_one('.wants-card__header-title')
                        title = title_elem.text.strip() if title_elem else 'No title'
                        
                        description_elem = card.select_one('.wants-card__description-text')
                        description = description_elem.text.strip() if description_elem else 'No description'
                        
                        price_elem = card.select_one('.wants-card__header-price')
                        price = price_elem.text.strip() if price_elem else 'No price'
                        
                        link_elem = card.select_one('a.wants-card__header-title')
                        link = f"https://kwork.ru{link_elem['href']}" if link_elem and 'href' in link_elem.attrs else ''
                        
                        order_id = link.split('/')[-1] if link else f"unknown_{len(orders)}"
                        
                        order = {
                            'id': order_id,
                            'title': title,
                            'description': description,
                            'price': price,
                            'link': link,
                            'source': 'kwork',
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        orders.append(order)
                    except Exception as e:
                        self.logger.error(f"Error parsing order card: {e}")
                
                await browser.close()
        except Exception as e:
            self.logger.error(f"Error scraping Kwork: {e}")
        
        return orders
    
    async def filter_orders(self, orders: List[Dict]) -> List[Dict]:
        """
        Filter orders based on keywords and other criteria
        
        Args:
            orders: List of orders to filter
            
        Returns:
            List[Dict]: Filtered list of orders
        """
        if not orders:
            return []
            
        filtered_orders = []
        keywords = self.config.get('keywords', [])
        excluded_keywords = self.config.get('excluded_keywords', [])
        min_price = self.config.get('min_price', 0)
        
        for order in orders:
            # Skip if price is below minimum
            try:
                # Extract numeric price value
                price_str = order.get('price', '0')
                # Remove non-numeric characters
                price_value = ''.join(c for c in price_str if c.isdigit() or c == '.')
                price = float(price_value) if price_value else 0
                
                if price < min_price:
                    continue
            except (ValueError, TypeError):
                # If price parsing fails, still consider the order
                pass
            
            # Check for keywords
            title = order.get('title', '').lower()
            description = order.get('description', '').lower()
            text = f"{title} {description}"
            
            # Skip if any excluded keyword is found
            if any(kw.lower() in text for kw in excluded_keywords):
                continue
                
            # Include if any required keyword is found
            if not keywords or any(kw.lower() in text for kw in keywords):
                filtered_orders.append(order)
        
        return filtered_orders
    
    async def run(self) -> List[Dict]:
        """
        Run the scraper for all configured marketplaces
        
        Returns:
            List[Dict]: List of filtered orders from all sources
        """
        all_orders = []
        
        # Get enabled marketplaces from config
        marketplaces = self.config.get('marketplaces', [])
        
        # Process each enabled marketplace
        for marketplace in marketplaces:
            name = marketplace.get('name', '').lower()
            enabled = marketplace.get('enabled', False)
            
            if not enabled:
                continue
                
            if name == 'kwork':
                # Scrape Kwork
                self.logger.info("Scraping Kwork marketplace...")
                kwork_orders = await self.scrape_kwork()
                all_orders.extend(kwork_orders)
                self.logger.info(f"Scraped {len(kwork_orders)} orders from Kwork")
            
            elif name == 'freelancehunt':
                # Scrape FreelanceHunt
                self.logger.info("Scraping FreelanceHunt marketplace...")
                freelancehunt_scraper = FreelanceHuntScraper(self.config)
                freelancehunt_orders = await freelancehunt_scraper.get_orders()
                all_orders.extend(freelancehunt_orders)
                self.logger.info(f"Scraped {len(freelancehunt_orders)} orders from FreelanceHunt")
            
            else:
                self.logger.warning(f"Unknown marketplace: {name}")
        
        # Filter orders based on criteria
        filtered_orders = await self.filter_orders(all_orders)
        self.logger.info(f"Filtered down to {len(filtered_orders)} matching orders")
        
        return filtered_orders
        
    def display_orders(self, orders: List[Dict]) -> None:
        """
        Display orders in a readable format
        
        Args:
            orders: List of orders to display
        """
        if not orders:
            print("No matching orders found.")
            return
            
        print(f"\nFound {len(orders)} matching orders:\n")
        
        for i, order in enumerate(orders, 1):
            print(f"Order {i}: {order.get('title')}")
            print(f"Price: {order.get('price')}")
            print(f"Description: {order.get('description', '')[:150]}..." if len(order.get('description', '')) > 150 else f"Description: {order.get('description', '')}")
            print(f"Link: {order.get('link')}")
            print("-" * 80)
