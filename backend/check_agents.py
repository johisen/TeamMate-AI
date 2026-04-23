import sqlite3

conn = sqlite3.connect('teammateai.db')
c = conn.cursor()

# Get all agents
c.execute('SELECT id, name, knowledge_base_ids FROM agents')
print('Agents:')
for row in c.fetchall():
    print(f'  ID: {row[0]} (type: {type(row[0])})')
    print(f'  Name: {row[1]}')
    print(f'  Knowledge base IDs: {row[2]}')
    print()

conn.close()