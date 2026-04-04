import requests
import json

queries = [
    'Efforts by politicians to silence or threaten people involved with the unsealed documents',
    'Coordinated campaigns or astroturfing to suppress the release of the flight logs',
    'Conspiracy theories regarding the timing of the file release'
]

for q in queries:
    res = requests.get('http://localhost:8000/api/topic/search', params={'q': q, 'sort_by': 'semantic', 'limit': 1})
    data = res.json()
    post = data['results'][0]
    title = post.get('title', 'N/A')
    stxt = post.get('selftext', '') or 'N/A'
    stxt = str(stxt)[:200].replace('\n', ' ')
    print(f'\nQuery: {q}')
    print(f'Title: {title}')
    print(f'Snippet: {stxt}')
