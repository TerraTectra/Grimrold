#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Sender module for autoapply-x

This module is responsible for automating the process of logging into freelance marketplaces,
navigating to order pages, and submitting responses.
"""

import os
import json
import logging
import asyncio
from typing import Dict, Optional, Tuple
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

class Sender:
    def __init__(self, config_path: str):
        """
        Initialize the sender with configuration
        
        Args:
            config_path: Path to the configuration file with marketplace credentials
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.logger = logging.getLogger('autoapply.sender')
        self.browser = None
        self.context = None
        
    def _load_config(self) -> Dict:
        """
        Load sender configuration from file
        
        Returns:
            Dict: Configuration dictionary
        """
        try:
            # Load configuration from YAML or JSON file
            with open(self.config_path, 'r', encoding='utf-8') as f:
                if self.config_path.endswith('.json'):
                    return json.load(f)
                else:
                    # Assuming YAML if not JSON
                    import yaml
                    return yaml.safe_load(f)
        except Exception as e:
            self.logger.error(f"Failed to load config: {e}")
            return {}
            
    async def initialize_browser(self):
        """
        Initialize browser with saved authentication state
        """
        try:
            # Get storage state path
            auth_state_path = os.path.join(os.path.dirname(self.config_path), 'auth_state.json')
            
            if not os.path.exists(auth_state_path):
                self.logger.error(f"Authentication state file not found: {auth_state_path}")
                return False
                
            # Start playwright and browser
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=self.config.get('headless', True)
            )
            
            # Create a context with saved storage state
            self.context = await self.browser.new_context(
                storage_state=auth_state_path,
                viewport={'width': 1280, 'height': 720}
            )
            
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize browser: {e}")
            return False
            
    async def close_browser(self):
        """
        Close browser and context
        """
        if self.context:
            await self.context.close()
            self.context = None
            
        if self.browser:
            await self.browser.close()
            self.browser = None
            
    async def check_login_status(self, marketplace: str) -> bool:
        """
        Check if we're still logged in to the marketplace
        
        Args:
            marketplace: Marketplace name (e.g., 'kwork')
            
        Returns:
            bool: True if logged in, False otherwise
        """
        if not self.context:
            return False
            
        try:
            page = await self.context.new_page()
            
            if marketplace.lower() == 'kwork':
                await page.goto('https://kwork.ru/user/settings')
                
                # Check if we're on the login page or settings page
                login_form = await page.query_selector('.js-signin-form')
                
                await page.close()
                return login_form is None  # If login form is not present, we're logged in
            else:
                self.logger.warning(f"Unsupported marketplace for login check: {marketplace}")
                await page.close()
                return False
        except Exception as e:
            self.logger.error(f"Error checking login status: {e}")
            if 'page' in locals() and page:
                await page.close()
            return False
            
    async def detect_captcha(self, page) -> bool:
        """
        Check if a CAPTCHA is present on the page
        
        Args:
            page: Playwright page object
            
        Returns:
            bool: True if CAPTCHA is detected, False otherwise
        """
        # Check for common CAPTCHA elements or text
        captcha_selectors = [
            '.captcha',
            '.g-recaptcha',
            'iframe[src*="recaptcha"]',
            'iframe[src*="captcha"]'
        ]
        
        for selector in captcha_selectors:
            captcha_element = await page.query_selector(selector)
            if captcha_element:
                return True
                
        # Check for CAPTCHA text
        page_content = await page.content()
        captcha_texts = ['captcha', 'подтвердите, что вы не робот', 'проверка безопасности']
        for text in captcha_texts:
            if text.lower() in page_content.lower():
                return True
                
        return False
        
    async def submit_response(self, order: Dict) -> Tuple[bool, str]:
        """
        Submit a response to an order
        
        Args:
            order: Order dictionary with response text
            
        Returns:
            Tuple[bool, str]: Success status and message
        """
        if not self.context:
            if not await self.initialize_browser():
                return False, "Failed to initialize browser"
                
        # Check if auto_submit is enabled
        if not self.config.get('auto_submit', False):
            return False, "Auto-submit is disabled in configuration"
            
        # Check if we have a response
        response_text = order.get('response')
        if not response_text:
            return False, "No response text available"
            
        # Get the order link
        link = order.get('link')
        if not link:
            return False, "No order link available"
            
        # Determine marketplace from the link
        marketplace = 'unknown'
        if 'kwork.ru' in link:
            marketplace = 'kwork'
        else:
            return False, f"Unsupported marketplace: {link}"
            
        # Check login status
        if not await self.check_login_status(marketplace):
            self.logger.warning("Not logged in, reinitializing browser")
            await self.close_browser()
            if not await self.initialize_browser():
                return False, "Failed to reinitialize browser"
                
            # Check login status again
            if not await self.check_login_status(marketplace):
                return False, "Not logged in, authentication required"
                
        try:
            # Create a new page
            page = await self.context.new_page()
            
            # Navigate to the order page
            self.logger.info(f"Navigating to {link}")
            await page.goto(link, wait_until='networkidle')
            
            # Check for CAPTCHA
            if await self.detect_captcha(page):
                self.logger.warning("CAPTCHA detected, manual intervention required")
                await page.close()
                return False, "CAPTCHA detected"
                
            # Handle marketplace-specific submission
            if marketplace == 'kwork':
                return await self._submit_kwork_response(page, response_text)
            else:
                await page.close()
                return False, f"Unsupported marketplace: {marketplace}"
                
        except PlaywrightTimeoutError as e:
            self.logger.error(f"Timeout error: {e}")
            if 'page' in locals() and page:
                await page.close()
            return False, f"Timeout error: {str(e)}"
        except Exception as e:
            self.logger.error(f"Error submitting response: {e}")
            if 'page' in locals() and page:
                await page.close()
            return False, f"Error: {str(e)}"
            
    async def _submit_kwork_response(self, page, response_text: str) -> Tuple[bool, str]:
        """
        Submit a response on Kwork marketplace
        
        Args:
            page: Playwright page object
            response_text: Response text to submit
            
        Returns:
            Tuple[bool, str]: Success status and message
        """
        try:
            # Check if we can respond to this order
            offer_button = await page.query_selector('.js-wants-offer-button, .btn_offer')
            
            if not offer_button:
                # Check if we already submitted a response
                already_submitted = await page.query_selector('.already-offer-alert')
                if already_submitted:
                    await page.close()
                    return False, "Already submitted a response to this order"
                    
                # Check if the order is no longer active
                inactive_order = await page.query_selector('.want-closed')
                if inactive_order:
                    await page.close()
                    return False, "Order is no longer active"
                    
                await page.close()
                return False, "No offer button found"
                
            # Click the offer button
            await offer_button.click()
            
            # Wait for the offer form to appear
            await page.wait_for_selector('.kwork-submit-offer-form, .js-kwork-submit-offer-form', timeout=10000)
            
            # Check if we have access to respond
            access_error = await page.query_selector('.want-no-access')
            if access_error:
                error_text = await access_error.text_content()
                await page.close()
                return False, f"Access error: {error_text}"
                
            # Fill in the response text
            await page.fill('.form-textarea-wrapper textarea, .submit-offer-comment-field textarea', response_text)
            
            # Submit the form
            if self.config.get('test_mode', True):
                # In test mode, don't actually submit
                self.logger.info("Test mode: would submit response here")
                await page.close()
                return True, "Test mode: Response prepared but not submitted"
            else:
                # In production mode, submit the form
                submit_button = await page.query_selector('button.kwork-submit-offer-form__submit, .js-wants-offer-send-button')
                
                if not submit_button:
                    await page.close()
                    return False, "Submit button not found"
                    
                await submit_button.click()
                
                # Wait for submission confirmation
                try:
                    await page.wait_for_selector('.already-offer-alert, .js-success-offer-sent', timeout=10000)
                    self.logger.info("Response submitted successfully")
                    await page.close()
                    return True, "Response submitted successfully"
                except PlaywrightTimeoutError:
                    # If we didn't get confirmation, check for errors
                    error_element = await page.query_selector('.js-error-text, .error-text')
                    if error_element:
                        error_text = await error_element.text_content()
                        await page.close()
                        return False, f"Submission error: {error_text}"
                    else:
                        await page.close()
                        return False, "Unknown submission error"
                        
        except Exception as e:
            self.logger.error(f"Error in Kwork submission: {e}")
            await page.close()
            return False, f"Error: {str(e)}"
            
    @staticmethod
    async def create_auth_state(username: str, password: str, output_path: str) -> bool:
        """
        Create authentication state file by logging in manually
        
        Args:
            username: Kwork username or email
            password: Kwork password
            output_path: Path to save the auth state file
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=False)
                context = await browser.new_context()
                page = await context.new_page()
                
                # Navigate to Kwork login page
                await page.goto('https://kwork.ru/login')
                
                # Fill in login form
                await page.fill('input[name="l_username"]', username)
                await page.fill('input[name="l_password"]', password)
                
                # Click login button
                await page.click('button.js-signin-button')
                
                # Wait for navigation to complete
                await page.wait_for_url('**/user/**', timeout=30000)
                
                # Save authentication state
                await context.storage_state(path=output_path)
                
                await browser.close()
                return True
        except Exception as e:
            print(f"Error creating auth state: {e}")
            return False
