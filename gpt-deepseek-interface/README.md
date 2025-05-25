# GPT Engineer + DeepSeek Interface

Интерфейс для интеграции GPT Engineer и DeepSeek-Coder V2 через Ollama.

## Установка

1. Клонируйте репозиторий:
   ```bash
   git clone <repository-url>
   cd gpt-deepseek-interface
   ```

2. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

3. Создайте файл `.env` в корне проекта:
   ```
   OLLAMA_BASE_URL=http://localhost:11434
   DEEPSEEK_MODEL=deepseek-coder-v2:16b
   ```

## Использование

```bash
python gpt_deepseek_interface.py --project path/to/project --prompt "Your task description here"
```

### Параметры командной строки:
- `--project`: Путь к директории проекта (обязательный)
- `--prompt`: Описание задачи (обязательный)
- `--model`: Модель для использования (по умолчанию: deepseek-coder-v2:16b)

## Пример

```bash
python gpt_deepseek_interface.py --project ./my_project --prompt "Create a simple web server with FastAPI"
```

## Логика работы

1. Скрипт создает директорию проекта (если её нет)
2. Сохраняет промпт в файл `prompt`
3. Запускает GPT Engineer с указанным промптом
4. Отправляет результат в DeepSeek для улучшения/дополнения
5. Сохраняет полный вывод в файл `deepseek_response.txt`

## Требования

- Python 3.8+
- Установленный и запущенный Ollama с моделью DeepSeek-Coder-V2
- Установленный GPT Engineer

## Лицензия

MIT
