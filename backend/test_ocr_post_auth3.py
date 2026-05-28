import base64
import io
import requests
from PIL import Image, ImageDraw, ImageFont

BASE='https://verifyit-3.onrender.com'

# Create sample image with clear text
img = Image.new('RGB', (700, 140), 'white')
d = ImageDraw.Draw(img)
try:
    font = ImageFont.load_default()
except Exception:
    font = None

d.text((10, 10), "Hello OCR 123", fill='black', font=font)
d.text((10, 50), "Yoruba: ìwífún", fill='black', font=font)

buf = io.BytesIO()
img.save(buf, format='PNG')
img_bytes = buf.getvalue()
img_b64 = base64.b64encode(img_bytes).decode('utf-8')

# Register a temporary user
reg_payload = {
    'email': 'ocrtester@example.local',
    'username': 'ocrtester',
    'password': 'testpass123'
}
try:
    r = requests.post(BASE + '/auth/register', json=reg_payload, timeout=120)
    if r.status_code not in (200,201):
        # If user exists, try login
        login_payload = {'username': reg_payload['username'], 'password': reg_payload['password']}
        r2 = requests.post(BASE + '/auth/login', json=login_payload, timeout=120)
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
    payload = {'image': img_b64, 'filename': 'test.png', 'language': 'en'}
    r3 = requests.post(BASE + '/extract-text', json=payload, headers=headers, timeout=240)
    print('EXTRACT STATUS', r3.status_code)
    print(r3.text)
except Exception as e:
    print('ERR', e)
