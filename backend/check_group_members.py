from app.core.database import get_db
from app.models.models import ProjectGroup, ProjectGroupMember, Agent
import asyncio

async def check_group_members():
    db = await get_db().__anext__()
    try:
        # Get project group
        group = await db.get(ProjectGroup, 'c0e5ca16-4f80-4cc7-9f00-b115f33da5a1')
        print(f"Project Group: {group.name}")
        
        # Get members
        members = await db.execute(
            ProjectGroupMember.__table__.select().where(
                ProjectGroupMember.project_group_id == 'c0e5ca16-4f80-4cc7-9f00-b115f33da5a1'
            )
        )
        
        member_ids = [m.agent_id for m in members.all()]
        print(f"Number of members: {len(member_ids)}")
        
        # Get agent details
        for agent_id in member_ids:
            agent = await db.get(Agent, agent_id)
            print(f'Agent: {agent.name} ({agent.role}) - ID: {agent.id}')
            
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_group_members())