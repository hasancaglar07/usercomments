import asyncio
import os

from .main import main_async as _main_async


async def main_async() -> None:
    await _main_async()


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())
