#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Responder module for autoapply-x

This module is responsible for generating customized responses to freelance orders
using LLM APIs (OpenRouter, Mistral, etc.)
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
import httpx
from string import Template
from datetime import datetime

class Responder:
    def __init__(self, config_path: str):
        """
        Initialize the responder with configuration
        
        Args:
            config_path: Path to the configuration file with API keys and templates
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.logger = logging.getLogger('autoapply.responder')
        self.api_key = self.config.get('openrouter_api_key') or os.getenv('OPENROUTER_API_KEY')
        self.templates = self.config.get('templates', {})
    
    def _load_config(self) -> Dict:
        """
        Load responder configuration from file
        
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
    
    async def generate_response(self, order: Dict) -> Optional[str]:
        """
        Generate a personalized response for an order using LLM
        
        Args:
            order: Order dictionary with details
            
        Returns:
            str: Generated response text or None if generation failed
        """
        try:
            # Choose template based on order category or default
            template_key = 'default'
            for category, keywords in self.config.get('categories', {}).items():
                for keyword in keywords:
                    if (keyword.lower() in order.get('title', '').lower() or 
                        keyword.lower() in order.get('description', '').lower()):
                        template_key = category
                        break
                if template_key != 'default':
                    break
            
            template_text = self.templates.get(template_key, self.templates.get('default', ''))
            if not template_text:
                self.logger.error(f"No template found for key: {template_key}")
                return None
            
            # Process template with order details
            template = Template(template_text)
            prompt_text = template.safe_substitute(
                title=order.get('title', ''),
                description=order.get('description', ''),
                price=order.get('price', ''),
                source=order.get('source', ''),
                timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            )
            
            # Choose LLM model based on configuration
            model = self.config.get('model', 'mistralai/mistral-7b-instruct')
            
            # Call LLM API based on provider
            if 'openrouter' in self.config.get('provider', '').lower():
                return await self._call_openrouter(prompt_text, model)
            else:
                # Default to OpenRouter if not specified
                return await self._call_openrouter(prompt_text, model)
                
        except Exception as e:
            self.logger.error(f"Error generating response: {e}")
            return None
    
    async def _call_openrouter(self, prompt: str, model: str) -> Optional[str]:
        """
        Call OpenRouter API to generate response
        
        Args:
            prompt: Prompt text for the LLM
            model: Model identifier
            
        Returns:
            str: Generated text or None if API call failed
        """
        if not self.api_key:
            self.logger.error("OpenRouter API key not found")
            return None
            
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a professional freelancer writing a response to a potential client. Write a confident, concise response (5-6 lines maximum) that shows your expertise. Be direct and ready to start work. Use a professional but friendly tone. Don't introduce yourself or use closing phrases - just focus on the client's specific needs. Your response should be in Russian unless the order is clearly in another language."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data['choices'][0]['message']['content']
                else:
                    self.logger.error(f"OpenRouter API error: {response.status_code} {response.text}")
                    return None
                    
        except Exception as e:
            self.logger.error(f"Error calling OpenRouter API: {e}")
            return None
            
    def format_response(self, text: str, order: Dict) -> str:
        """
        Format the response text for the specific marketplace
        
        Args:
            text: Generated response text
            order: Order details
            
        Returns:
            str: Formatted response according to marketplace requirements
        """
        source = order.get('source', '').lower()
        
        # Apply marketplace-specific formatting
        if source == 'kwork':
            # Kwork may have specific formatting requirements
            # Add any special formatting here
            return text
        else:
            # Default formatting
            return text
            
    async def process_order(self, order: Dict) -> Dict:
        """
        Process an order and generate a complete response
        
        Args:
            order: Order dictionary
            
        Returns:
            Dict: Order with added response field
        """
        result = order.copy()
        
        # Generate response text
        response_text = await self.generate_response(order)
        
        if response_text:
            # Format response for the specific marketplace
            formatted_response = self.format_response(response_text, order)
            result['response'] = formatted_response
            result['response_generated'] = True
            result['response_timestamp'] = datetime.now().isoformat()
        else:
            result['response'] = None
            result['response_generated'] = False
            
        return result
