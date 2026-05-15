# 🔍 VerifyIt Nigeria - AI-Powered News Verification Platform

![Process Flow](verifai_process_flow_diagram.png)

## 🚀 Overview

VerifyIt Nigeria is an AI-powered platform that combats misinformation by verifying news articles and images using multiple AI models and web search verification, with a special focus on Nigerian news sources and contexts.

## ✨ Features

- **Text Verification** - Analyze news articles and claims for credibility
- **Image Verification** - Detect manipulated images and extract text via OCR
- **Fake News Quiz** - Practice your misinformation detection skills with interactive quizzes
- **Deepfake Detection** - Upload audio/video files to detect synthetic media and deepfake indicators
- **AI Explanation Engine** - Get clear model-based reasoning and flag explanations for every verification result
- **WhatsApp Verification Helper** - Generate WhatsApp-ready reporting messages for suspicious claims
- **Local Language Support** - Switch the site to Yoruba, Hausa, or Igbo for easier use
- **Admin Intelligence Dashboard** - Monitor verification trends, user reports, and AI performance metrics
- **Multi-Model AI Analysis** - BERT + LLM + Web Search combined scoring
- **Trusted Source Matching** - 60+ verified news sources worldwide
- **Trending News** - Live news feed from multiple categories
- **Multi-Theme Support** - Dark, Light, Ocean, Forest, Cream themes

---

## 📋 Prerequisites

| Requirement | Version | Download Link                                                         |
| ----------- | ------- | --------------------------------------------------------------------- |
| **Python**  | 3.9+    | [python.org/downloads](https://www.python.org/downloads/)             |
| **Git**     | Any     | [git-scm.com/downloads](https://git-scm.com/downloads) (Optional)     |
| **VS Code** | Any     | [code.visualstudio.com](https://code.visualstudio.com/) (Recommended) |

> ⚠️ **Important:** During Python installation, **check "Add Python to PATH"**

---

## 🔑 Get Your Free API Key

### Gemini API (Required)

1. Go to [https://aistudio.google.com/](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **"Get API Key"** → **"Create API Key"**
4. Copy your key (starts with `AIza...`)

---

## 📥 Step-by-Step Installation Guide

### Step 1: Download/Clone the Project

**Option A - Download ZIP:**

1. Click the green **"Code"** button on GitHub
2. Select **"Download ZIP"**
3. Extract to a folder (e.g., `C:\VerifAI` or `D:\My Projects\VerifAI`)

**Option B - Clone with Git:**

```bash
git clone https://github.com/YOUR-USERNAME/verifai.git
cd verifai
```

---

### Step 2: Install Python Dependencies

Open Terminal/Command Prompt in the project folder and run:

```bash
pip install -r requirements.txt
```

**This installs:**

- `fastapi`, `uvicorn` - API server
- `transformers`, `torch` - BERT model (AI)
- `google-generativeai` - Gemini AI
- `easyocr` - OCR for images
- `duckduckgo-search` - Web verification
- `Pillow` - Image processing

> ⏱️ **Note:** First installation takes 5-10 minutes to download packages.

---

### Step 3: BERT Model (Auto-Download)

The **Fake News BERT model** is automatically downloaded on first run:

| Model                              | Size    | Source                                                                     |
| ---------------------------------- | ------- | -------------------------------------------------------------------------- |
| `jy46604790/Fake-News-BERT-Detect` | ~440 MB | [HuggingFace Hub](https://huggingface.co/jy46604790/Fake-News-BERT-Detect) |

**Direct Link:** [https://huggingface.co/jy46604790/Fake-News-BERT-Detect](https://huggingface.co/jy46604790/Fake-News-BERT-Detect)

> 📦 The model downloads automatically when you start the backend for the first time. It gets cached in `~/.cache/huggingface/` for future runs.

**Manual Download (Optional):**
If you prefer to pre-download the model:

```bash
python -c "from transformers import AutoTokenizer, AutoModelForSequenceClassification; AutoTokenizer.from_pretrained('jy46604790/Fake-News-BERT-Detect'); AutoModelForSequenceClassification.from_pretrained('jy46604790/Fake-News-BERT-Detect')"
```

---

### Step 4: Add Your API Key

Open `app.py` and find line ~59. Replace the API key:

```python
GEMINI_API_KEYS = [
    "YOUR-GEMINI-API-KEY-HERE",  # Add your key here
    ...
]
```

**Or use environment variables:**

| OS                     | Command                             |
| ---------------------- | ----------------------------------- |
| **Windows PowerShell** | `$env:GEMINI_API_KEY_1 = "AIza..."` |
| **Windows CMD**        | `set GEMINI_API_KEY_1=AIza...`      |
| **Linux/Mac**          | `export GEMINI_API_KEY_1="AIza..."` |

---

## 🖥️ Running with VS Code (Recommended)

### Method 1: Using VS Code Integrated Terminal

1. **Open the project folder in VS Code:**
   - File → Open Folder → Select your VerifAI folder

2. **Open Terminal:**
   - Press `` Ctrl+` `` or go to Terminal → New Terminal

3. **Start the Backend (Terminal 1):**

   ```bash
   python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
   ```

4. **Start the Frontend (Terminal 2):**
   - Click the **+** button to open a new terminal tab

   ```bash
   python -m http.server 5500
   ```

5. **Open the website:**
   - Go to: **http://127.0.0.1:5500/home.html**

### Method 2: Using VS Code Live Server Extension

1. Install the **Live Server** extension from VS Code marketplace
2. Right-click on `home.html` → **"Open with Live Server"**
3. The backend still needs to run in terminal:
   ```bash
   python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
   ```

---

## � Running with Other IDEs/Command Line

### PyCharm / IntelliJ

1. Open the project folder
2. Open Terminal (Alt+F12)
3. Run the backend:
   ```bash
   python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
   ```
4. Open another terminal for frontend:
   ```bash
   python -m http.server 5500
   ```

### Command Prompt / PowerShell (Windows)

**Terminal 1 - Backend:**

```bash
cd C:\path\to\VerifAI
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 - Frontend:**

```bash
cd C:\path\to\VerifAI
python -m http.server 5500
```

### Linux/Mac Terminal

```bash
# Terminal 1 - Backend
cd /path/to/VerifAI
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd /path/to/VerifAI
python3 -m http.server 5500
```

---

## 🌐 Access URLs

| Service                | URL                             |
| ---------------------- | ------------------------------- |
| **Frontend (Website)** | http://127.0.0.1:5500/home.html |
| **Backend API**        | http://127.0.0.1:8000           |
| **API Documentation**  | http://127.0.0.1:8000/docs      |
| **API Health Check**   | http://127.0.0.1:8000/          |

---

## ✅ Verify Installation

When the backend starts successfully, you should see:

```
✅ Using Gemini key #1: AIzaSy...
✅ Gemini API configured with 1 keys (smart rotation enabled)
✅ Groq API configured as fallback
🚀 Loading EasyOCR...
🧠 Loading Fake News BERT model: jy46604790/Fake-News-BERT-Detect
✅ Fake News BERT model loaded successfully!
INFO:     Application startup complete.
```

---

## 📁 Project Structure

```
VerifAI/
├── backend/
│   ├── app.py              # 🔧 Backend API server (FastAPI)
│   ├── requirements.txt    # 📦 Python dependencies
│   ├── users.json          # 👤 Auth user store
│   ├── reports.json        # 📝 Report storage
│   └── verifications.json  # 📊 Verification history
├── frontend/
│   ├── index.html          # 🚪 Landing page
│   ├── home.html           # 🏠 Main verification page
│   ├── about.html          # ℹ️ About page
│   ├── admin.html          # 🔧 Admin dashboard
│   ├── login.html          # 🔐 Login page
│   ├── register.html       # ✍️ Registration page
│   ├── styles.css          # 🎨 Themes & styling
│   ├── scripts.js          # ⚡ Frontend JavaScript logic
│   ├── auth.js             # 🔐 Authentication helpers
│   └── favicon.png         # 🖼️ Site icon
├── .env.example            # 🌱 Environment variable example
├── README.md               # 📖 This file
├── LICENSE                # 📜 License
└── .gitignore              # 🚫 Git ignore rules
```

---

## 📊 How It Works

### Scoring System

| Component    | Weight | Description                    |
| ------------ | ------ | ------------------------------ |
| BERT Model   | 25%    | Pre-trained Fake News Detector |
| LLM (Gemini) | 35%    | AI Fact Evaluation             |
| Web Search   | 40%    | Trusted Source Verification    |

### Verdict Meanings

| Score  | Verdict        | Meaning                   |
| ------ | -------------- | ------------------------- |
| ≥70%   | ✅ VERIFIED    | Found in trusted sources  |
| 55-69% | 🟢 LIKELY REAL | Appears credible          |
| 45-54% | 🟡 UNCERTAIN   | Needs manual verification |
| <45%   | 🔴 LIKELY FAKE | Potential misinformation  |

---

## 🔧 Troubleshooting

### "python not found"

- Reinstall Python and check **"Add to PATH"**
- Or try `python3` instead of `python`

### "pip not found"

```bash
python -m pip install -r requirements.txt
```

### "Module not found" errors

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Backend not reachable from frontend

- Make sure backend is running on port **8000**
- Check that `scripts.js` has: `const API_BASE_URL = 'http://127.0.0.1:8000'`

### CORS errors

- The backend already has CORS enabled for all origins
- Try opening frontend via `python -m http.server` instead of double-clicking HTML

### Slow first run

- First run downloads AI models (~500MB total)
- Models are cached after first download

---

## 🎨 Themes

Click the theme button (🎨) in the navigation to switch:

| Theme     | Style               |
| --------- | ------------------- |
| 🌙 Dark   | Dark mode (default) |
| ☀️ Light  | Bright mode         |
| 🌊 Ocean  | Blue tones          |
| 🌲 Forest | Green tones         |
| 🍂 Cream  | Warm sepia          |

---

## 📝 API Endpoints

| Endpoint              | Method | Description                   |
| --------------------- | ------ | ----------------------------- |
| `/`                   | GET    | Health check                  |
| `/check`              | POST   | Verify text content           |
| `/check-image`        | POST   | Verify image (base64)         |
| `/check-image-upload` | POST   | Verify image (file upload)    |
| `/extract-text`       | POST   | OCR - Extract text from image |
| `/trending-news`      | GET    | Fetch trending news           |
| `/api-status`         | GET    | API key status                |

---

## 📝 License

MIT License - Free to use and modify

## 👨‍💻 Author

**VerifAI Team - Alex & Knight**

---

_Combat misinformation with AI! 🛡️_
