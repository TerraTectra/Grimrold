import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional
import requests
from dotenv import load_dotenv

class DeepSeekCoder:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "deepseek-coder-v2:16b"):
        self.base_url = base_url
        self.model = model
        self.session = requests.Session()
        
    def generate_code(self, prompt: str, max_retries: int = 3) -> str:
        """Generate code using DeepSeek model"""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        
        for attempt in range(max_retries):
            try:
                response = self.session.post(url, json=payload, timeout=60)
                response.raise_for_status()
                return response.json().get("response", "")
            except (requests.RequestException, json.JSONDecodeError) as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate code after {max_retries} attempts: {str(e)}")
                time.sleep(1)  # Wait before retrying

class CodeGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.coder = DeepSeekCoder()
        
    def create_project(self, project_name: str, description: str) -> Dict[str, Any]:
        """Create a new project with the given description"""
        project_dir = self.output_dir / project_name
        project_dir.mkdir(exist_ok=True)
        
        # Create prompt file
        prompt_file = project_dir / "prompt.txt"
        with open(prompt_file, "w", encoding="utf-8") as f:
            f.write(description)
        
        # Generate code
        code_prompt = f"""
        Task: {description}
        
        Requirements:
        1. Create a complete, working Python project
        2. Include all necessary files with proper imports
        3. Add clear comments and docstrings
        4. Handle errors appropriately
        5. Follow PEP 8 style guide
        
        Output the code in the following format:
        ```python
        # File: filename.py
        # Description: Brief description of the file
        [code content]
        ```
        """
        
        try:
            print("Generating code...")
            response = self.coder.generate_code(code_prompt)
            
            # Save the complete response
            output_file = project_dir / "generated_code.txt"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(response)
                
            # Extract and save individual code files
            self._extract_code_files(response, project_dir)
            
            return {
                "status": "success",
                "project_dir": str(project_dir),
                "files_created": [str(p.relative_to(project_dir)) 
                                for p in project_dir.glob("**/*") 
                                if p.is_file()]
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _extract_code_files(self, response: str, project_dir: Path):
        """Extract code blocks from the response and save them as files"""
        lines = response.split('\n')
        current_file = None
        file_content = []
        
        for line in lines:
            if line.startswith("```python"):
                if current_file is not None:
                    self._write_file(project_dir, current_file, file_content)
                current_file = None
                file_content = []
            elif line.startswith("# File: "):
                current_file = line.replace("# File: ", "").strip()
            elif current_file is not None:
                file_content.append(line)
        
        if current_file and file_content:
            self._write_file(project_dir, current_file, file_content)
    
    def _write_file(self, project_dir: Path, file_path: str, content_lines: list):
        """Write content to a file, creating directories as needed"""
        full_path = project_dir / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Remove any remaining markdown code block markers
        content = '\n'.join(
            line for line in content_lines 
            if not line.startswith('```')
        ).strip()
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Created file: {full_path}")

def main():
    # Load environment variables
    load_dotenv()
    
    # Set up argument parser
    import argparse
    parser = argparse.ArgumentParser(description='Generate code using DeepSeek Coder V2')
    parser.add_argument('--project', required=True, help='Project directory name')
    parser.add_argument('--prompt', required=True, help='Project description')
    parser.add_argument('--output', default='./generated_projects', 
                       help='Output directory for generated projects')
    
    args = parser.parse_args()
    
    # Initialize code generator
    output_dir = Path(args.output).resolve()
    generator = CodeGenerator(output_dir)
    
    # Generate project
    print(f"Generating project: {args.project}")
    print(f"Description: {args.prompt}")
    print("-" * 50)
    
    result = generator.create_project(args.project, args.prompt)
    
    # Display results
    print("\n" + "=" * 50)
    if result["status"] == "success":
        print(f"Project generated successfully in: {result['project_dir']}")
        print("\nFiles created:")
        for file in result["files_created"]:
            print(f"  - {file}")
    else:
        print("Error generating project:")
        print(result["message"])
    
    print("=" * 50)

if __name__ == "__main__":
    main()
