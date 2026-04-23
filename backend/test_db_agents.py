import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import select
import sys
sys.path.insert(0, 'd:/teamily ai/teamily-ai/backend')

from app.core.config import settings
from app.models.models import Agent

async def test():
    print(f"Database URL: {settings.DATABASE_URL}")

    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with AsyncSession(engine) as session:
        result = await session.execute(select(Agent))
        agents = result.scalars().all()
        print(f"\nFound {len(agents)} agents in database")
        for agent in agents[:5]:  # Only show first 5
            print(f"  - {agent.id}: {agent.name} ({agent.role})")
        if len(agents) > 5:
            print(f"  ... and {len(agents) - 5} more")

    await engine.dispose()

asyncio.run(test())