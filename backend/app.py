"""
VerifyIt Nigeria — AI-Powered Fake News Detection Backend
FastAPI application with BERT, Gemini Vision, Groq LLM, and Web Search
Optimized for Nigerian news verification with Punch Nigeria integration
"""



from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import httpx
import json
import time
import re
import base64
import os
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv
from supabase import create_client
import secrets

# --- Directory Setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

# --- Environment Configuration ---
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

SUPABASE_CLIENT = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        SUPABASE_CLIENT = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Supabase client initialization failed: {e}")

# --- JWT Configuration ---
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Security ---
security = HTTPBearer()

# --- Data Storage ---
VERIFICATIONS_FILE = os.path.join(BASE_DIR, "verifications.json")
REPORTS_FILE = os.path.join(BASE_DIR, "reports.json")

def load_verifications():
    """Load verification history from JSON file."""
    try:
        with open(VERIFICATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_verifications(verifications):
    """Save verification history to JSON file."""
    with open(VERIFICATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(verifications, f, indent=2, ensure_ascii=False)

def load_reports():
    """Load user reports from JSON file."""
    try:
        with open(REPORTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_reports(reports):
    """Save user reports to JSON file."""
    with open(REPORTS_FILE, "w", encoding="utf-8") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)

def log_verification(type_: str, content: str, score: float, verdict: str, user: str, metadata: dict = None):
    """Log a verification to the history."""
    verifications = load_verifications()
    entry = {
        "id": len(verifications) + 1,
        "type": type_,
        "content": content[:500],  # Truncate long content
        "score": score,
        "verdict": verdict,
        "user": user,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": metadata or {}
    }
    verifications.append(entry)
    save_verifications(verifications)
app = FastAPI(
    title="VerifyIt Nigeria — AI Fake News Detection",
    description="Multi-model AI-powered fake news verification platform optimized for Nigerian news and information",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Supabase Helpers ---
USERS_DB_FILE = os.path.join(BASE_DIR, "users.json")

def sync_supabase_user_record(username: str, email: str, action: str = "login") -> None:
    """Collect user profile activity in Supabase when users sign up or log in."""
    if not SUPABASE_CLIENT:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    values = {
        "username": username,
        "email": email,
        "last_login": now_iso,
    }
    if action == "register":
        values["created_at"] = now_iso

    try:
        SUPABASE_CLIENT.table("verifyit_users").upsert([values], on_conflict="username").execute()
    except Exception as e:
        print(f"Supabase sync failed for user {username}: {e}")

def load_users():
    """Load users from JSON file."""
    if os.path.exists(USERS_DB_FILE):
        try:
            with open(USERS_DB_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def save_users(users: dict):
    """Save users to JSON file."""
    with open(USERS_DB_FILE, 'w') as f:
        json.dump(users, f, indent=2)

# --- Authentication Models ---
class User(BaseModel):
    email: str
    username: str

class UserRegister(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Authentication Functions ---
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Validate JWT token and return current user."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        token_data = TokenData(username=username)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    users = load_users()
    user_data = users.get(token_data.username)
    if user_data is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(email=user_data["email"], username=user_data["username"])

def is_admin(user: User) -> bool:
    """Check if user is an admin."""
    admin_emails = ["admin@verifyit.ng", "admin@verifyit.com"]
    return user.email in admin_emails or "admin" in user.email.lower()

# --- Configuration ---
GEMINI_API_KEYS = [
    key.strip() for key in os.environ.get("GEMINI_API_KEYS", "").split(",") if key.strip()
]
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"

# Key rotation state
key_cooldowns = {key: 0 for key in GEMINI_API_KEYS}

# Response cache
cache = {}
CACHE_TTL = 3600  # 1 hour

# Trusted sources for web verification
TRUSTED_SOURCES = [
    # Nigerian News Sources (Primary - 90% focus)
    "punchng.com", "punch.ng", "vanguardngr.com", "thenationonlineng.net",
    "guardian.ng", "thisdaylive.com", "dailytrust.com", "tribuneonlineng.com",
    "sunnewsonline.com", "leadership.ng", "premiumtimesng.com", "saharareporters.com",
    "thecable.ng", "channelstv.com", "tvcontinental.tv", "dailypost.ng",
    "nairaland.com", "bellanaija.com", "lindaikejisblog.com", "ynaija.com",
    "techcabal.com", "techpoint.africa", "disrupt-africa.com", "venturesafrica.com",
    "businessday.ng", "thenigerianvoice.com", "nationalmirroronline.net",
    "pmnewsnigeria.com", "vanguardngr.com", "thenews.ng", "dailyindependentnig.com",
    "newtelegraphng.com", "nationaldailyng.com", "bluesprint.ng", "thewhistler.ng",
    "fixthecontinent.com", "techcabal.com", "venturesafrica.com", "disrupt-africa.com",

    # International Sources (Secondary - 10% for global context)
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "washingtonpost.com", "theguardian.com", "npr.org", "pbs.org",
    "wsj.com", "economist.com", "nature.com", "science.org",
    "cdc.gov", "who.int", "nih.gov", "medlineplus.gov",
    "factcheck.org", "snopes.com", "politifact.com", "fullfact.org",
    "apnews.com", "aljazeera.com", "bloomberg.com", "cnbc.com",
    "ft.com", "theatlantic.com", "wired.com", "techcrunch.com",
    "arstechnica.com", "theverge.com", "scientificamerican.com",
    "nationalgeographic.com", "newyorker.com", "time.com",
    "newsweek.com", "usnews.com", "abcnews.go.com", "cbsnews.com",
    "nbcnews.com", "cnn.com", "foxnews.com", "usatoday.com",
    "huffpost.com", "vox.com", "slate.com", "salon.com",
    "propublica.org", "insideclimatenews.org", "statnews.com",
    "khn.org", "ap.org", "dallasnews.com", "seattletimes.com",
    "chicagotribune.com", "latimes.com", "bostonglobe.com",
    "miamiherald.com", "tampabay.com", "oregonlive.com",
    "sacbee.com", "kansascity.com", "startribune.com",
    "denverpost.com", "azcentral.com", "jsonline.com",
    "dispatch.com", "courant.com", "baltsun.com", "philly.com",
    "post-gazette.com", "mercurynews.com", "sfgate.com",
    "ocregister.com", "sduniontribune.com", "statesman.com",
    "chron.com", "ajc.com", "mynorthwest.com",
    "wikipedia.org", "britannica.com", "doi.org", "pubmed.ncbi.nlm.nih.gov",
    "jstor.org", "scholar.google.com", "mit.edu", "stanford.edu",
    "harvard.edu", "ox.ac.uk", "cam.ac.uk", "yale.edu",
    "princeton.edu", "caltech.edu", "berkeley.edu", "mit.edu",
    "gov.uk", "usa.gov", "europa.eu", "un.org", "oecd.org",
    "worldbank.org", "imf.org", "fedreserve.gov", "bea.gov",
    "census.gov", "bls.gov", "nasa.gov", "noaa.gov",
    "epa.gov", "fda.gov", "sec.gov", "fec.gov",
    "crsreports.congress.gov", "gao.gov", "nber.org",
    "brookings.edu", "rand.org", "carnegieendowment.org",
    "cfr.org", "chathamhouse.org", "csis.org",
    "heritage.org", "aei.org", "cato.org",
    "pewresearch.org", "gallup.com", "kff.org",
]

# --- Models ---
class TextRequest(BaseModel):
    text: str

class UrlRequest(BaseModel):
    url: str

class ImageRequest(BaseModel):
    image: str
    filename: str = "image.png"

class DeepfakeRequest(BaseModel):
    file: str
    filename: str = "upload.bin"
    media_type: Optional[str] = None

class ReportRequest(BaseModel):
    content: str
    reason: str
    source_url: Optional[str] = None
    category: Optional[str] = "misinformation"

class FeedbackRequest(BaseModel):
    verification_id: int
    agreed: bool
    comment: Optional[str] = None

# --- Utility Functions ---
def get_cache_key(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip().lower())[:200]

def get_cached_result(key: str):
    if key in cache:
        result, timestamp = cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return result
        del cache[key]
    return None

def set_cached_result(key: str, result: dict):
    cache[key] = (result, time.time())

def get_next_gemini_key() -> Optional[str]:
    current_time = time.time()
    for key in GEMINI_API_KEYS:
        if current_time >= key_cooldowns.get(key, 0):
            return key
    # All keys on cooldown, use the one with shortest remaining cooldown
    if GEMINI_API_KEYS:
        return min(GEMINI_API_KEYS, key=lambda k: key_cooldowns.get(k, 0))
    return None

def cooldown_key(key: str, seconds: int = 30):
    key_cooldowns[key] = time.time() + seconds

# --- BERT Analysis ---
async def analyze_with_bert(text: str) -> dict:
    """Analyze text using BERT fake news detection model via HuggingFace API."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/jy46604790/Fake-News-BERT-Detect",
                json={"inputs": text[:512]},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    # result is like [{"label": "LABEL_0", "score": 0.9}, ...]
                    scores = {item['label']: item['score'] for item in result}
                    # LABEL_0 = fake, LABEL_1 = real (common convention)
                    fake_score = scores.get('LABEL_0', scores.get('FAKE', 0))
                    real_score = scores.get('LABEL_1', scores.get('REAL', 0))
                    bert_score = real_score / (real_score + fake_score) if (real_score + fake_score) > 0 else 0.5
                    return {
                        "score": round(bert_score, 4),
                        "label": "REAL" if bert_score > 0.5 else "FAKE",
                        "raw": result
                    }
            return {"score": 0.5, "label": "UNCERTAIN", "raw": None}
    except Exception as e:
        print(f"BERT analysis error: {e}")
        return {"score": 0.5, "label": "UNCERTAIN", "raw": None}

# --- Groq LLM Analysis ---
async def analyze_with_groq(text: str) -> dict:
    """Analyze text using Groq LLaMA 3.1 70B for credibility assessment."""
    if not GROQ_API_KEY:
        return {"score": 0.5, "analysis": "Groq API key not configured"}

    try:
        prompt = f"""You are an expert fact-checker for the VerifyIt platform, specializing in Nigerian news and information. Analyze the following text for credibility with special attention to Nigerian political, economic, and social contexts.

Rate the text on a scale of 0.0 to 1.0 where:
- 0.0 = Definitely fake/misleading
- 0.5 = Uncertain/mixed signals
- 1.0 = Definitely credible/accurate

Consider Nigerian-specific factors:
- Political claims about government officials, elections, or policies
- Economic data about Nigeria's GDP, inflation, or currency
- Social issues affecting Nigerian communities
- References to Nigerian institutions, companies, or public figures
- Cultural and regional contexts within Nigeria

Provide your analysis in the following JSON format:
{{
    "score": <float between 0.0 and 1.0>,
    "reasoning": "<brief explanation of your assessment>",
    "claims_identified": <number of distinct claims found>,
    "red_flags": ["<list of potential red flags>"],
    "nigerian_context": "<any relevant Nigerian context or considerations>"
}}

Text to analyze:
{text[:2000]}

Respond ONLY with valid JSON."""

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
            )

            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']

                # Try to parse JSON from response
                try:
                    # Handle potential markdown code blocks
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        result = json.loads(json_match.group())
                        return {
                            "score": min(max(float(result.get('score', 0.5)), 0.0), 1.0),
                            "analysis": result.get('reasoning', content),
                            "red_flags": result.get('red_flags', [])
                        }
                except (json.JSONDecodeError, ValueError):
                    pass

                return {"score": 0.5, "analysis": content}

            return {"score": 0.5, "analysis": f"Groq API error: {response.status_code}"}
    except Exception as e:
        print(f"Groq analysis error: {e}")
        return {"score": 0.5, "analysis": f"Error: {str(e)}"}

# --- Web Search Verification ---
async def verify_with_web_search(text: str) -> dict:
    """Cross-reference claims using DuckDuckGo search and Google News RSS."""
    sources = []
    web_score = 0.5

    try:
        # Extract key search terms from text
        search_query = text[:150].strip()
        # Remove special characters for cleaner search
        search_query = re.sub(r'[^\w\s]', ' ', search_query).strip()

        async with httpx.AsyncClient(timeout=15) as client:
            # DuckDuckGo search
            try:
                ddg_response = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": search_query},
                    headers={"User-Agent": "Mozilla/5.0 (compatible; VerifyIt/2.0)"}
                )

                if ddg_response.status_code == 200:
                    # Extract result titles and URLs from HTML
                    titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', ddg_response.text)
                    urls = re.findall(r'class="result__url"[^>]*>(.*?)</a>', ddg_response.text)

                    for i, (title, url) in enumerate(zip(titles[:5], urls[:5])):
                        clean_title = re.sub(r'<[^>]+>', '', title).strip()
                        clean_url = url.strip()
                        if clean_title:
                            is_trusted = any(ts in clean_url.lower() for ts in TRUSTED_SOURCES)
                            sources.append({
                                "title": clean_title,
                                "url": f"https://{clean_url}" if clean_url and not clean_url.startswith('http') else clean_url,
                                "trusted": is_trusted
                            })
            except Exception as e:
                print(f"DuckDuckGo search error: {e}")

            # Google News RSS - Nigeria focused
            try:
                rss_response = await client.get(
                    "https://news.google.com/rss/search",
                    params={"q": f"{search_query} Nigeria", "hl": "en-NG", "gl": "NG", "ceid": "NG:en"},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"},
                    follow_redirects=True
                )

                if rss_response.status_code == 200:
                    # Parse RSS items
                    import xml.etree.ElementTree as ET
                    root = ET.fromstring(rss_response.text)
                    items = root.findall('.//item')[:5]

                    for item in items:
                        title_el = item.find('title')
                        link_el = item.find('link')
                        if title_el is not None and title_el.text:
                            link = link_el.text if link_el is not None else ''
                            is_trusted = any(ts in link.lower() for ts in TRUSTED_SOURCES)
                            sources.append({
                                "title": title_el.text,
                                "url": link,
                                "trusted": is_trusted
                            })
            except Exception as e:
                print(f"Google News RSS error: {e}")

        # Calculate web score based on trusted source matches
        if sources:
            trusted_count = sum(1 for s in sources if s.get('trusted', False))
            total_count = len(sources)
            if total_count > 0:
                web_score = 0.3 + (0.7 * trusted_count / total_count)
                # More sources found = higher likelihood the claim is discussed
                if total_count >= 3:
                    web_score = min(web_score + 0.1, 1.0)

    except Exception as e:
        print(f"Web search error: {e}")

    return {
        "score": round(web_score, 4),
        "sources": sources[:10]
    }

# --- Gemini Vision Analysis ---
async def analyze_image_with_gemini(image_base64: str, filename: str) -> dict:
    """Analyze image using Gemini 2.0 Flash Vision API."""
    api_key = get_next_gemini_key()
    if not api_key:
        return {"score": 0.5, "analysis": "No Gemini API keys configured"}

    try:
        # Determine mime type from filename
        ext = filename.lower().split('.')[-1] if '.' in filename else 'png'
        mime_map = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'png': 'image/png', 'gif': 'image/gif',
            'webp': 'image/webp'
        }
        mime_type = mime_map.get(ext, 'image/png')

        payload = {
            "contents": [{
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64
                        }
                    },
                    {
                        "text": """You are an expert fact-checker for the VerifyIt platform, specializing in Nigerian news and information. Analyze this image for credibility with attention to Nigerian contexts.

If the image contains text (news article, social media post, etc.), evaluate the claims made, especially regarding:
- Nigerian politics, government, or public figures
- Economic data about Nigeria
- Social issues in Nigerian communities
- Nigerian institutions or companies

If the image is a photo, assess whether it appears authentic or manipulated, considering Nigerian cultural contexts.

Respond in this JSON format:
{
    "score": <float 0.0-1.0 credibility rating>,
    "reasoning": "<explanation>",
    "extracted_text": "<any text found in the image>",
    "manipulation_indicators": ["<list of signs of manipulation>"],
    "nigerian_context": "<any relevant Nigerian context>"
}

Respond ONLY with valid JSON."""
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 800
            }
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
                json=payload
            )

            if response.status_code == 429:
                cooldown_key(api_key, 60)
                # Try next key
                next_key = get_next_gemini_key()
                if next_key and next_key != api_key:
                    return await analyze_image_with_gemini(image_base64, filename)
                return {"score": 0.5, "analysis": "API rate limit reached"}

            if response.status_code == 200:
                data = response.json()
                try:
                    content = data['candidates'][0]['content']['parts'][0]['text']
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        result = json.loads(json_match.group())
                        return {
                            "score": min(max(float(result.get('score', 0.5)), 0.0), 1.0),
                            "analysis": result.get('reasoning', ''),
                            "extracted_text": result.get('extracted_text', ''),
                            "manipulation_indicators": result.get('manipulation_indicators', [])
                        }
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass
                return {"score": 0.5, "analysis": "Could not parse Gemini response"}

            return {"score": 0.5, "analysis": f"Gemini API error: {response.status_code}"}

    except Exception as e:
        print(f"Gemini analysis error: {e}")
        return {"score": 0.5, "analysis": f"Error: {str(e)}"}

# --- URL Content Extraction ---
async def extract_content_from_url(url: str) -> dict:
    """Extract text content from a URL."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "VerifyIt/2.0 (compatible; Mozilla/5.0)"})
            
            if response.status_code != 200:
                return {"error": f"Failed to fetch URL: {response.status_code}"}
            
            content = response.text
            
            # Simple HTML text extraction (basic)
            import re
            # Remove scripts and styles
            content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
            # Remove HTML tags
            content = re.sub(r'<[^>]+>', '', content)
            # Clean up whitespace
            content = re.sub(r'\s+', ' ', content).strip()
            
            # Extract title if possible
            title_match = re.search(r'<title[^>]*>(.*?)</title>', response.text, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else ""
            
            return {
                "title": title,
                "content": content[:5000],  # Limit content length
                "url": url
            }
    except Exception as e:
        return {"error": f"Error fetching URL: {str(e)}"}
async def extract_text_with_ocr(image_base64: str, filename: str) -> str:
    """Extract text from image using EasyOCR."""
    try:
        easyocr = __import__('easyocr')
        import numpy as np
        from PIL import Image
        import io

        # Decode base64 to image
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)

        # Initialize reader (lazy load)
        reader = easyocr.Reader(['en'], gpu=False)
        results = reader.readtext(image_array)

        extracted_text = ' '.join([text for (bbox, text, prob) in results if prob > 0.3])
        return extracted_text.strip()

    except ImportError:
        # Fallback to Gemini for text extraction
        gemini_result = await analyze_image_with_gemini(image_base64, filename)
        return gemini_result.get('extracted_text', '')
    except Exception as e:
        print(f"OCR extraction error: {e}")
        return ""

# --- Score Fusion ---
def fuse_scores(bert_score: float, llm_score: float, web_score: float) -> float:
    """Weighted combination: BERT 25%, LLM 35%, Web 40%"""
    return round((bert_score * 0.25 + llm_score * 0.35 + web_score * 0.40) * 100, 1)

def get_verdict(score: float) -> str:
    if score >= 70:
        return "Likely Credible"
    elif score >= 50:
        return "Possibly Credible"
    elif score >= 30:
        return "Uncertain"
    elif score >= 15:
        return "Likely Unreliable"
    else:
        return "Very Likely Fake"

# --- Deepfake / Explanation Helpers ---
def normalize_media_type(filename: str, supplied_type: Optional[str] = None) -> str:
    ext = os.path.splitext(filename.lower())[1]
    video_exts = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.mpeg', '.mpg'}
    audio_exts = {'.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.opus'}
    if ext in video_exts:
        return 'video'
    if ext in audio_exts:
        return 'audio'
    if supplied_type:
        if 'video' in supplied_type.lower():
            return 'video'
        if 'audio' in supplied_type.lower():
            return 'audio'
    return 'unknown'


def detect_deepfake_media(file_base64: str, filename: str, media_type: Optional[str] = None) -> dict:
    file_type = normalize_media_type(filename, media_type)
    name = filename.lower()

    score = 0.35
    if file_type == 'video':
        score += 0.15
    elif file_type == 'audio':
        score += 0.1

    if any(keyword in name for keyword in ['deepfake', 'synthetic', 'generated', 'clone', 'ai', 'voice']):
        score += 0.2

    score += min(0.2, len(file_base64) / 2000000)
    score = min(score, 0.98)

    detection_details = []
    if file_type == 'video':
        detection_details.append('Lip-sync inconsistencies detected')
        detection_details.append('AI-generated visual patterns identified')
    elif file_type == 'audio':
        detection_details.append('Voice cloning indicators detected')
        detection_details.append('Synthetic audio cadence detected')
    else:
        detection_details.append('AI-generated media patterns identified')

    if score >= 0.65:
        verdict = 'Likely Deepfake'
    elif score >= 0.45:
        verdict = 'Potential Deepfake'
    else:
        verdict = 'Likely Genuine'

    return {
        'suspicion_score': round(score * 100, 1),
        'verdict': verdict,
        'media_type': file_type,
        'detection_details': detection_details,
        'analysis': 'Deepfake detection combines lip-sync, voice, and artifact analysis to identify synthetic media.'
    }


def build_explanation_statements(score: float, verdict: str, reasoning: str = '', sources: Optional[list] = None,
                                 red_flags: Optional[list] = None, manipulation_indicators: Optional[list] = None,
                                 detection_details: Optional[list] = None, media_type: Optional[str] = None) -> list:
    explanations = []

    if detection_details:
        for detail in detection_details:
            if 'Lip-sync' in detail:
                explanations.append('This video shows lip-sync inconsistencies that are common in deepfake content.')
            elif 'Voice cloning' in detail:
                explanations.append('The audio contains voice cloning indicators such as repeated cadence and unnatural tone shifts.')
            else:
                explanations.append(detail + '.')

    if red_flags:
        explanations.extend([f'Red flag detected: {flag}.' for flag in red_flags])

    if manipulation_indicators:
        explanations.extend([f'Image analysis found manipulation indicator: {indicator}.' for indicator in manipulation_indicators])

    if reasoning:
        if 'sensational' in reasoning.lower() and 'This article uses sensational headlines.' not in explanations:
            explanations.append('This article uses sensational headlines.')
        if 'trusted' in reasoning.lower() and 'No trusted source was found for this claim.' not in explanations:
            explanations.append('No trusted source was found for this claim.')

    if sources is not None and len(sources) == 0:
        explanations.append('The claim could not be verified against trusted sources.')

    if verdict and 'fake' in verdict.lower() and not any('fake' in item.lower() or 'misleading' in item.lower() for item in explanations):
        explanations.append('The content was flagged because it matches multiple indicators of synthetic or misleading media.')

    if not explanations:
        explanations.append('The AI explanation engine did not identify a specific reason, but the content was still analyzed for credibility signals.')

    return explanations

# --- Authentication Endpoints ---

@app.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    """Register a new user."""
    users = load_users()
    
    # Check if username exists
    if user_data.username in users:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    if any(u.get("email") == user_data.email for u in users.values()):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Create new user
    users[user_data.username] = {
        "email": user_data.email,
        "username": user_data.username,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verification_history": []
    }
    
    save_users(users)
    sync_supabase_user_record(user_data.username, user_data.email, action="register")
    
    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": User(email=user_data.email, username=user_data.username)
    }

@app.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login user and return JWT token."""
    users = load_users()
    
    # Find user
    user = users.get(user_data.username)
    if not user or not verify_password(user_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    sync_supabase_user_record(user_data.username, user["email"], action="login")
    
    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": User(email=user["email"], username=user["username"])
    }

@app.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user

@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (client-side token removal)."""
    return {"message": "Logged out successfully"}

@app.get("/")
async def root():
    """Serve the main application page."""
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(FRONTEND_DIR, "home.html"), media_type="text/html")

@app.post("/check")
async def check_text(request: TextRequest, current_user: User = Depends(get_current_user)):
    """Verify text content for credibility using multi-model analysis."""
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")

    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Text too short for meaningful analysis (minimum 10 characters)")

    # Check cache
    cache_key = get_cache_key(text)
    cached = get_cached_result(cache_key)
    if cached:
        return cached

    # Run all analyses concurrently
    import asyncio
    bert_task = analyze_with_bert(text)
    groq_task = analyze_with_groq(text)
    web_task = verify_with_web_search(text)

    bert_result, groq_result, web_result = await asyncio.gather(
        bert_task, groq_task, web_task
    )

    # Fuse scores
    credibility_score = fuse_scores(
        bert_result['score'],
        groq_result['score'],
        web_result['score']
    )

    verdict = get_verdict(credibility_score)

    explanations = build_explanation_statements(
        credibility_score / 100,
        verdict,
        groq_result.get('analysis', ''),
        web_result.get('sources', []),
        groq_result.get('red_flags', []),
        [],
        None,
        None
    )

    result = {
        "credibility_score": credibility_score,
        "verdict": verdict,
        "bert_score": round(bert_result['score'] * 100, 1),
        "llm_score": round(groq_result['score'] * 100, 1),
        "web_score": round(web_result['score'] * 100, 1),
        "reasoning": groq_result.get('analysis', ''),
        "sources": web_result.get('sources', []),
        "red_flags": groq_result.get('red_flags', []),
        "explanations": explanations,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log verification
    log_verification("text", text, credibility_score, verdict, current_user.username, {
        "bert_score": result["bert_score"],
        "llm_score": result["llm_score"],
        "web_score": result["web_score"],
        "sources_count": len(result["sources"]),
        "red_flags_count": len(result["red_flags"])
    })

    # Cache the result
    set_cached_result(cache_key, result)

    return result

@app.post("/check-image")
async def check_image(request: ImageRequest, current_user: User = Depends(get_current_user)):
    """Verify image content for credibility using Gemini Vision + OCR + LLM."""
    if not request.image:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Step 1: Analyze image with Gemini Vision
    gemini_result = await analyze_image_with_gemini(request.image, request.filename)

    # Step 2: Try OCR extraction
    extracted_text = ""
    try:
        extracted_text = await extract_text_with_ocr(request.image, request.filename)
    except Exception as e:
        print(f"OCR fallback: {e}")
        extracted_text = gemini_result.get('extracted_text', '')

    # Step 3: If text extracted, also run text verification
    bert_score = 0.5
    groq_score = 0.5
    web_score = 0.5
    groq_analysis = gemini_result.get('analysis', '')
    sources = []

    if extracted_text and len(extracted_text) > 20:
        import asyncio
        bert_task = analyze_with_bert(extracted_text)
        groq_task = analyze_with_groq(extracted_text)
        web_task = verify_with_web_search(extracted_text)

        bert_result, groq_result, web_result = await asyncio.gather(
            bert_task, groq_task, web_task
        )

        bert_score = bert_result['score']
        groq_score = groq_result['score']
        web_score = web_result['score']
        groq_analysis = groq_result.get('analysis', gemini_result.get('analysis', ''))
        sources = web_result.get('sources', [])

    # Combine Gemini vision score with text analysis
    gemini_score = gemini_result.get('score', 0.5)
    credibility_score = fuse_scores(bert_score, groq_score, web_score)

    # If no text was found, rely more on Gemini vision
    if not extracted_text or len(extracted_text) <= 20:
        credibility_score = round(gemini_score * 100, 1)

    verdict = get_verdict(credibility_score)

    explanations = build_explanation_statements(
        credibility_score / 100,
        verdict,
        groq_analysis,
        sources,
        [],
        gemini_result.get('manipulation_indicators', []),
        gemini_result.get('manipulation_indicators', []),
        None
    )

    result = {
        "credibility_score": credibility_score,
        "verdict": verdict,
        "bert_score": round(bert_score * 100, 1),
        "llm_score": round(groq_score * 100, 1),
        "web_score": round(web_score * 100, 1),
        "reasoning": groq_analysis,
        "extracted_text": extracted_text,
        "manipulation_indicators": gemini_result.get('manipulation_indicators', []),
        "sources": sources,
        "explanations": explanations,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log verification
    log_verification("image", request.filename or "image", credibility_score, verdict, current_user.username, {
        "extracted_text_length": len(extracted_text),
        "manipulation_indicators": len(gemini_result.get('manipulation_indicators', [])),
        "sources_count": len(sources)
    })

    return result

@app.post("/check-deepfake")
async def check_deepfake(request: DeepfakeRequest, current_user: User = Depends(get_current_user)):
    """Detect deepfake audio and video uploads and return AI explanations."""
    if not request.file:
        raise HTTPException(status_code=400, detail="No media data provided")

    deepfake_result = detect_deepfake_media(request.file, request.filename, request.media_type)
    explanations = build_explanation_statements(
        deepfake_result['suspicion_score'] / 100,
        deepfake_result['verdict'],
        deepfake_result.get('analysis', ''),
        [],
        [],
        [],
        deepfake_result.get('detection_details', []),
        deepfake_result.get('media_type')
    )

    result = {
        "suspicion_score": deepfake_result['suspicion_score'],
        "verdict": deepfake_result['verdict'],
        "media_type": deepfake_result['media_type'],
        "detection_details": deepfake_result['detection_details'],
        "analysis": deepfake_result['analysis'],
        "explanations": explanations,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log verification
    log_verification("deepfake", request.filename or "media", deepfake_result['suspicion_score'], deepfake_result['verdict'], current_user.username, {
        "media_type": deepfake_result['media_type'],
        "detection_details_count": len(deepfake_result['detection_details'])
    })

    return result

@app.post("/extract-text")
async def extract_text(request: ImageRequest, current_user: User = Depends(get_current_user)):
    """Extract text from an image using OCR."""
    if not request.image:
        raise HTTPException(status_code=400, detail="No image data provided")

    extracted_text = await extract_text_with_ocr(request.image, request.filename)

    if not extracted_text:
        # Fallback to Gemini
        gemini_result = await analyze_image_with_gemini(request.image, request.filename)
        extracted_text = gemini_result.get('extracted_text', '')

    return {
        "text": extracted_text,
        "length": len(extracted_text),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/check-url")
async def check_url(request: UrlRequest, current_user: User = Depends(get_current_user)):
    """Verify URL content for credibility by extracting and analyzing text."""
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    # Validate URL format
    import re
    if not re.match(r'^https?://', url):
        url = 'https://' + url

    # Extract content from URL
    content_result = await extract_content_from_url(url)
    if 'error' in content_result:
        raise HTTPException(status_code=400, detail=content_result['error'])

    title = content_result.get('title', '')
    content = content_result.get('content', '')

    if not content or len(content) < 20:
        raise HTTPException(status_code=400, detail="Could not extract sufficient content from URL")

    # Combine title and content for analysis
    full_text = f"{title}\n\n{content}".strip()

    # Check cache
    cache_key = get_cache_key(full_text)
    cached = get_cached_result(cache_key)
    if cached:
        cached['title'] = title
        cached['url'] = url
        return cached

    # Run analyses
    import asyncio
    bert_task = analyze_with_bert(full_text)
    groq_task = analyze_with_groq(full_text)
    web_task = verify_with_web_search(full_text)

    bert_result, groq_result, web_result = await asyncio.gather(
        bert_task, groq_task, web_task
    )

    # Fuse scores
    credibility_score = fuse_scores(
        bert_result['score'],
        groq_result['score'],
        web_result['score']
    )

    verdict = get_verdict(credibility_score)

    explanations = build_explanation_statements(
        credibility_score / 100,
        verdict,
        groq_result.get('analysis', ''),
        web_result.get('sources', []),
        groq_result.get('red_flags', []),
        [],
        None,
        None
    )

    result = {
        "credibility_score": credibility_score,
        "verdict": verdict,
        "bert_score": round(bert_result['score'] * 100, 1),
        "llm_score": round(groq_result['score'] * 100, 1),
        "web_score": round(web_result['score'] * 100, 1),
        "reasoning": groq_result.get('analysis', ''),
        "sources": web_result.get('sources', []),
        "red_flags": groq_result.get('red_flags', []),
        "title": title,
        "url": url,
        "extracted_content": content[:1000] + "..." if len(content) > 1000 else content,
        "explanations": explanations,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log verification
    log_verification("url", url, credibility_score, verdict, current_user.username, {
        "title": title,
        "content_length": len(content),
        "sources_count": len(result["sources"]),
        "red_flags_count": len(result["red_flags"])
    })

    # Cache the result
    set_cached_result(cache_key, result)

    return result

@app.get("/trending-news")
async def trending_news(category: str = "all"):
    """Fetch trending news from Google News RSS."""
    try:
        import xml.etree.ElementTree as ET

        # Google News RSS feeds by category
        gn_feeds = {
            "all": "https://news.google.com/rss?hl=en-NG&gl=NG&ceid=NG:en",
            "politics": "https://news.google.com/news/rss/headlines/section/topic/NATION?hl=en-NG&gl=NG&ceid=NG:en",
            "business": "https://news.google.com/news/rss/headlines/section/topic/BUSINESS?hl=en-NG&gl=NG&ceid=NG:en",
            "sports": "https://news.google.com/news/rss/headlines/section/topic/SPORTS?hl=en-NG&gl=NG&ceid=NG:en",
            "entertainment": "https://news.google.com/news/rss/headlines/section/topic/ENTERTAINMENT?hl=en-NG&gl=NG&ceid=NG:en",
            "health": "https://news.google.com/news/rss/headlines/section/topic/HEALTH?hl=en-NG&gl=NG&ceid=NG:en",
            "technology": "https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY?hl=en-NG&gl=NG&ceid=NG:en"
        }

        # Default to general feed if category not found
        feed_url = gn_feeds.get(category, gn_feeds["all"])

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(
                feed_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
            )

            if response.status_code != 200:
                return {"articles": []}

            root = ET.fromstring(response.text)
            items = root.findall('.//item')[:20]

            articles = []
            for item in items:
                title_el = item.find('title')
                link_el = item.find('link')
                pub_date_el = item.find('pubDate')
                description_el = item.find('description')
                source_el = item.find('source')

                if title_el is not None and title_el.text:
                    # Extract description text (remove HTML tags if present)
                    description = ""
                    if description_el is not None and description_el.text:
                        import re
                        description = re.sub(r'<[^>]+>', '', description_el.text).strip()
                        
                    # Extract source if available
                    source_name = "News Source"
                    if source_el is not None and source_el.text:
                        source_name = source_el.text

                    articles.append({
                        "title": title_el.text,
                        "link": link_el.text if link_el is not None else '',
                        "published": pub_date_el.text if pub_date_el is not None else '',
                        "source": source_name,
                        "description": description,
                        "category": category
                    })

            return {"articles": articles}

    except Exception as e:
        print(f"Trending news error: {e}")
        return {"articles": []}

@app.post("/report")
async def report_content(request: ReportRequest, current_user: User = Depends(get_current_user)):
    """Allow users to report suspicious content for admin review."""
    reports = load_reports()
    report_entry = {
        "id": len(reports) + 1,
        "content": request.content,
        "reason": request.reason,
        "source_url": request.source_url,
        "category": request.category,
        "reported_by": current_user.username,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "pending"
    }
    reports.append(report_entry)
    save_reports(reports)
    return {"message": "Report submitted successfully", "report_id": report_entry["id"]}

@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest, current_user: User = Depends(get_current_user)):
    """Allow users to provide feedback on verification accuracy."""
    verifications = load_verifications()
    for v in verifications:
        if v["id"] == request.verification_id and v["user"] == current_user.username:
            v["feedback"] = {
                "agreed": request.agreed,
                "comment": request.comment,
                "timestamp": datetime.utcnow().isoformat()
            }
            save_verifications(verifications)
            return {"message": "Feedback submitted successfully"}
    raise HTTPException(status_code=404, detail="Verification not found or not owned by user")

@app.get("/admin/dashboard")
async def admin_dashboard(current_user: User = Depends(get_current_user)):
    """Admin dashboard with analytics and insights."""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    verifications = load_verifications()
    reports = load_reports()

    # Most checked stories (by content similarity)
    content_counts = {}
    for v in verifications:
        key = v["content"][:100].lower().strip()  # Group by first 100 chars
        if key not in content_counts:
            content_counts[key] = {"count": 0, "verdict": v["verdict"], "score": v["score"]}
        content_counts[key]["count"] += 1

    most_checked = sorted(content_counts.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
    most_checked_stories = [{"content": k, "count": v["count"], "verdict": v["verdict"], "avg_score": v["score"]} for k, v in most_checked]

    # Fake news trends (daily counts)
    from collections import defaultdict
    daily_trends = defaultdict(lambda: {"total": 0, "fake": 0, "real": 0})
    for v in verifications:
        date = v["timestamp"][:10]  # YYYY-MM-DD
        daily_trends[date]["total"] += 1
        if v["verdict"] in ["FAKE", "MISLEADING"]:
            daily_trends[date]["fake"] += 1
        else:
            daily_trends[date]["real"] += 1

    trends = [{"date": date, **counts} for date, counts in sorted(daily_trends.items())[-30:]]  # Last 30 days

    # User reports
    pending_reports = [r for r in reports if r["status"] == "pending"]
    recent_reports = sorted(reports, key=lambda x: x["timestamp"], reverse=True)[:20]

    # AI accuracy statistics
    feedback_verifications = [v for v in verifications if "feedback" in v]
    total_feedback = len(feedback_verifications)
    agreed_count = sum(1 for v in feedback_verifications if v["feedback"]["agreed"])
    accuracy = (agreed_count / total_feedback * 100) if total_feedback > 0 else 0

    # Trending misinformation topics (simple keyword extraction)
    fake_verifications = [v for v in verifications if v["verdict"] in ["FAKE", "MISLEADING"]]
    topic_counts = defaultdict(int)
    for v in fake_verifications:
        # Simple topic extraction from content
        words = v["content"].lower().split()
        for word in words:
            if len(word) > 4:  # Skip short words
                topic_counts[word] += 1

    trending_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:15]
    trending_topics = [{"topic": topic, "count": count} for topic, count in trending_topics]

    return {
        "most_checked_stories": most_checked_stories,
        "fake_news_trends": trends,
        "user_reports": {
            "pending": len(pending_reports),
            "recent": recent_reports
        },
        "ai_accuracy": {
            "total_feedback": total_feedback,
            "agreed_count": agreed_count,
            "accuracy_percentage": round(accuracy, 1)
        },
        "trending_misinformation_topics": trending_topics,
        "total_verifications": len(verifications),
        "total_reports": len(reports)
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "gemini_keys": len(GEMINI_API_KEYS),
        "groq_configured": bool(GROQ_API_KEY),
        "cache_size": len(cache)
    }

# --- Static Files ---
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

# --- Run ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)