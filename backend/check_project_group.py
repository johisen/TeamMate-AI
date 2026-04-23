import sqlite3

conn = sqlite3.connect('teammateai.db')
c = conn.cursor()

# Get all agents
c.execute('SELECT id, name FROM agents;')
print('Agents:')
for row in c.fetchall():
    print(f'  {row}')

# Get all project groups
c.execute('SELECT id, name, supervisor_id FROM project_groups;')
print('\nProject groups:')
for row in c.fetchall():
    print(f'  {row}')

# Get all project group members
c.execute('SELECT project_group_id, agent_id, role_in_group FROM project_group_members;')
print('\nProject group members:')
for row in c.fetchall():
    print(f'  {row}')

conn.close()