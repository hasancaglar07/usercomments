from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient

config = Config.from_env()
db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)

targets = [
    'Красота и здоровье',
    'Детское',
    'Техника',
    'Туризм',
    'Животные',
    'Кино и ТВ',
    'Кино',
    'Книги',
    'Продукты',
    'Посуда',
    'Авто'
]

results = []
for name in targets:
    # Try exact match first on top level
    res = db.select('categories', columns='id, name', filters=[('eq', 'name', name), ('is', 'parent_id', 'null')])
    if res:
        results.append(res[0])
    else:
        # Try ilike on top level
        res = db.select('categories', columns='id, name', filters=[('ilike', 'name', f'%{name}%'), ('is', 'parent_id', 'null')])
        if res:
            results.append(res[0])

# Deduplicate by ID
seen_ids = set()
final_results = []
for r in results:
    if r['id'] not in seen_ids:
        final_results.append(r)
        seen_ids.add(r['id'])

for r in final_results:
    print(f"ID: {r['id']}, Name: {r['name']}")
