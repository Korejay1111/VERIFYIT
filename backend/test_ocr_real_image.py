import base64
import requests
from pathlib import Path

BASE = 'http://127.0.0.1:8000'
IMAGE_PATH = Path(__file__).resolve().parent.parent / 'VerifyIT.png'

if not IMAGE_PATH.exists():
    raise SystemExit(f'Missing image file: {IMAGE_PATH}')

with IMAGE_PATH.open('rb') as f:
    img_bytes = f.read()
img_b64 = base64.b64encode(img_bytes).decode('utf-8')

reg_payload = {
    'email': 'ocrrealtester@example.local',
    'username': 'ocrrealtester',
    'password': 'realpass123'
}

try:
    r = requests.post(BASE + '/auth/register', json=reg_payload, timeout=60)
    if r.status_code not in (200, 201):
        login_payload = {'username': reg_payload['username'], 'password': reg_payload['password']}
        r2 = requests.post(BASE + '/auth/login', json=login_payload, timeout=60)
        if r2.status_code != 200:
            print('AUTH ERR', r.status_code, r.text)
            raise SystemExit(1)
        token = r2.json().get('access_token')
    else:
        token = r.json().get('access_token')

    if not token:
        print('No token returned', r.text)
        raise SystemExit(1)

    headers = {'Authorization': f'Bearer {token}'}
    payload = {'image': img_b64, 'filename': IMAGE_PATH.name, 'language': 'en'}
    r3 = requests.post(BASE + '/extract-text', json=payload, headers=headers, timeout=240)
    print('EXTRACT STATUS', r3.status_code)
    print(r3.text)
except Exception as e:
    print('ERR', e)
