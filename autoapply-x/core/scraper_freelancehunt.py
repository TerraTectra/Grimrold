#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
FreelanceHunt scraper module for autoapply-x

This module is responsible for parsing FreelanceHunt marketplace
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
import re

class FreelanceHuntScraper:
    def __init__(self, config):
        """
        Initialize the FreelanceHunt scraper with configuration
        
        Args:
            config: Configuration dictionary with marketplace settings
        """
        self.config = config
        self.logger = logging.getLogger('autoapply.scraper.freelancehunt')
        
    async def scrape_projects(self) -> List[Dict]:
        """
        Scrape orders from FreelanceHunt marketplace
        
        Returns:
            List[Dict]: List of order dictionaries
        """
        orders = []
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Navigate to FreelanceHunt projects page
                await page.goto('https://freelancehunt.com/projects')
                
                # Wait for projects to load
                await page.wait_for_selector('.project-card')
                
                # Extract orders
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                order_cards = soup.select('.project-card')
                
                for card in order_cards:
                    try:
                        # Extract title
                        title_elem = card.select_one('.project-card__title a')
                        title = title_elem.text.strip() if title_elem else 'No title'
                        
                        # Extract link
                        link = f"https://freelancehunt.com{title_elem['href']}" if title_elem and 'href' in title_elem.attrs else ''
                        
                        # Extract description
                        description_elem = card.select_one('.project-card__description')
                        description = description_elem.text.strip() if description_elem else 'No description'
                        
                        # Extract price
                        price_elem = card.select_one('.project-card__budget')
                        price = price_elem.text.strip() if price_elem else 'No price'
                        
                        # Extract ID from the URL
                        order_id = link.split('/')[-2] if link and '/' in link else f"unknown_{len(orders)}"
                        
                        # Create order dictionary
                        order = {
                            'id': order_id,
                            'title': title,
                            'description': description,
                            'price': price,
                            'link': link,
                            'source': 'freelancehunt',
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        orders.append(order)
                    except Exception as e:
                        self.logger.error(f"Error parsing FreelanceHunt project card: {e}")
                
                # Check if there are multiple pages and get more projects if needed
                # Limit to 3 pages for performance
                pagination = soup.select_one('.pagination')
                if pagination:
                    page_links = pagination.select('a.page-link')
                    max_page = 3  # Limit to 3 pages to avoid excessive scraping
                    
                    for page_num in range(2, max_page + 1):
                        try:
                            # Go to next page
                            await page.goto(f'https://freelancehunt.com/projects?page={page_num}')
                            await page.wait_for_selector('.project-card')
                            
                            # Extract orders from this page
                            content = await page.content()
                            soup = BeautifulSoup(content, 'html.parser')
                            
                            order_cards = soup.select('.project-card')
                            
                            for card in order_cards:
                                try:
                                    # Same extraction logic as above
                                    title_elem = card.select_one('.project-card__title a')
                                    title = title_elem.text.strip() if title_elem else 'No title'
                                    
                                    link = f"https://freelancehunt.com{title_elem['href']}" if title_elem and 'href' in title_elem.attrs else ''
                                    
                                    description_elem = card.select_one('.project-card__description')
                                    description = description_elem.text.strip() if description_elem else 'No description'
                                    
                                    price_elem = card.select_one('.project-card__budget')
                                    price = price_elem.text.strip() if price_elem else 'No price'
                                    
                                    order_id = link.split('/')[-2] if link and '/' in link else f"unknown_{len(orders)}"
                                    
                                    order = {
                                        'id': order_id,
                                        'title': title,
                                        'description': description,
                                        'price': price,
                                        'link': link,
                                        'source': 'freelancehunt',
                                        'timestamp': datetime.now().isoformat()
                                    }
                                    
                                    orders.append(order)
                                except Exception as e:
                                    self.logger.error(f"Error parsing FreelanceHunt project card on page {page_num}: {e}")
                        except Exception as e:
                            self.logger.error(f"Error scraping FreelanceHunt page {page_num}: {e}")
                            break
                
                await browser.close()
        except Exception as e:
            self.logger.error(f"Error scraping FreelanceHunt: {e}")
        
        self.logger.info(f"Scraped {len(orders)} projects from FreelanceHunt")
        return orders

    async def get_orders(self) -> List[Dict]:
        """
        Main method to get FreelanceHunt orders
        
        Returns:
            List[Dict]: List of order dictionaries
        """
        return await self.scrape_projects()
