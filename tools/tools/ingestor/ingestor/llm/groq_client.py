import logging
from typing import List, Dict, Any
from groq import Groq


class GroqClient:
    def __init__(self, api_key: str, model: str, logger: logging.Logger, vision_model: str = "llama-3.2-11b-vision-preview") -> None:
        self.client = Groq(api_key=api_key)
        self.model = model
        self.vision_model = vision_model
        self.logger = logger
    
    def analyze_image(self, image_url: str, prompt: str) -> str:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
        
        try:
            response = self.client.chat.completions.create(
                model=self.vision_model,
                messages=messages,
                temperature=0.1,
                max_tokens=1024,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            self.logger.warning(f"Groq Vision failed: {e}")
            return ""

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.2, max_tokens: int = 8192) -> str:
        import time
        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                content = response.choices[0].message.content
                if not content:
                    raise RuntimeError("Groq returned empty response")
                return content
            except Exception as e:
                if attempt == max_attempts - 1:
                    raise e
                # Exponential backoff: 5s, 10s, 20s, 40s
                wait_time = 5 * (2 ** attempt)
                self.logger.warning(f"Groq chat failed (attempt {attempt+1}/{max_attempts}): {e}")
                self.logger.info(f"Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
        raise RuntimeError("Max retries exceeded")

    def chat_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.2, max_tokens: int = 8192) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.chat(messages=messages, temperature=temperature, max_tokens=max_tokens)
