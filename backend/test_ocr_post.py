import base64
import io
import requests
from PIL import Image, ImageDraw, ImageFont

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

payload = {
    'image': img_b64,
    'filename': 'test.png',
    'language': 'en'
}

try:
    r = requests.post('https://verifyit-3.onrender.com/extract-text', json=payload, timeout=30)
    print('STATUS', r.status_code)
    print(r.text)
except Exception as e:
    print('ERR', e)
