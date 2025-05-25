import os
import sys
import argparse
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List
import json
import requests
from dotenv import load_dotenv

# Import GPT Engineer components
from gpt_engineer.core.files_dict import FilesDict
from gpt_engineer.core.default.disk_memory import DiskMemory
from gpt_engineer.core.default.paths import PREPROMPTS_PATH, memory_path
from gpt_engineer.core.default.steps import (  
    simple_gen,
    lite_gen,
    clarify,
    gen_clarified_code,
    execute_entrypoint,
    improve_fn,
    gen_spec,
    respec,
    use_feedback,
    curr_fn,
    setup_sys_logger,
    get_retrieval_index,
    retrieve,
    retrieve_edit,
)
from gpt_engineer.core.default.disk_execution_env import DiskExecutionEnv
from gpt_engineer.core.default.steps import curr_fn, setup_sys_logger
from gpt_engineer.cli.learning import (
    learning_system_prompt,
    collect_consent,
    collect_consent_telemetry,
    collect_learnings,
    steps_file,
    STEPS,
    gen_new_instructions,
    get_modified_consent,
)
from gpt_engineer.cli.cli_agent import CliAgent
from gpt_engineer.cli.collect import collect_learnings
from gpt_engineer.core.default.git_utils import (
    add_original_files,
    add_original_files_legacy,
    init_gp_repo,
    is_git_installed,
    is_git_repo,
    is_inside_git_repo,
    is_on_branch_with_commits,
    preprocess_repository,
    update_gitignore,
)
from gpt_engineer.core.default.paths import ENTRYPOINT_FILE, memory_path
from gpt_engineer.core.prompt import PromptStyle, setup_shortcut
from gpt_engineer.tools.custom_steps import (
    clarified_gen,
    lite_gen,
    self_heal,
)

class GPTDeepSeekInterface:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        load_dotenv()
        self.ollama_base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model_name = os.getenv('DEEPSEEK_MODEL', 'deepseek-coder-v2:16b')
        
    def run_gpt_engineer(self, project_dir: Path, prompt: str) -> str:
        """Run GPT Engineer with the given prompt"""
        try:
            project_dir.mkdir(parents=True, exist_ok=True)
            prompt_file = project_dir / 'prompt'
            with open(prompt_file, 'w', encoding='utf-8') as f:
                f.write(prompt)
            
            # Используем полный путь к gpte.exe
            gpte_path = Path(os.environ.get('APPDATA'), 'Python', 'Python310', 'Scripts', 'gpte.exe')
            if not gpte_path.exists():
                raise FileNotFoundError(f"gpte.exe not found at {gpte_path}")
                
            cmd = [str(gpte_path), '--model', self.model_name, '--project', str(project_dir)]
            print(f"Running command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.base_dir,
                shell=True  # Используем shell=True для корректного запуска .exe
            )
            
            if result.returncode != 0:
                error_msg = f"GPT Engineer error (code {result.returncode}): {result.stderr}"
                if not error_msg.strip() and result.stdout:
                    error_msg = f"GPT Engineer error (code {result.returncode}): {result.stdout}"
                raise Exception(error_msg)
                
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to run GPT Engineer: {str(e)}")
    
    def query_deepseek(self, prompt: str) -> str:
        """Query DeepSeek model through Ollama"""
        try:
            url = f"{self.ollama_base_url}/api/generate"
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False
            }
            
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            return response.json().get('response', '')
            
        except Exception as e:
            raise Exception(f"Failed to query DeepSeek: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='GPT Engineer + DeepSeek Interface')
    parser.add_argument('--project', required=True, help='Project directory')
    parser.add_argument('--prompt', help='Task description')
    parser.add_argument('--model', help='Model to use (default: deepseek-coder-v2:16b)')
    
    args = parser.parse_args()
    
    interface = GPTDeepSeekInterface()
    if args.model:
        interface.model_name = args.model
    
    try:
        if not args.prompt:
            print("Please provide a prompt with --prompt")
            sys.exit(1)
            
        project_dir = Path(args.project).resolve()
        print(f"Processing project in: {project_dir}")
        print(f"Prompt: {args.prompt}")
        
        # Generate code with GPT Engineer
        print("\nRunning GPT Engineer...")
        gpt_output = interface.run_gpt_engineer(project_dir, args.prompt)
        print("GPT Engineer completed successfully!")
        
        # Get additional code from DeepSeek
        print("\nQuerying DeepSeek for additional code...")
        deepseek_prompt = f"""
        Based on the following task and GPT Engineer's output, 
        provide additional implementation details or improvements:
        
        Task: {args.prompt}
        
        GPT Engineer Output:
        {gpt_output}
        """
        
        deepseek_response = interface.query_deepseek(deepseek_prompt)
        print("\nDeepSeek Response:")
        print("="*50)
        print(deepseek_response)
        print("="*50)
        
        # Save the complete output
        output_file = project_dir / 'deepseek_response.txt'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(deepseek_response)
            
        print(f"\nComplete output saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
