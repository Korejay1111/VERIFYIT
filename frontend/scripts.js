/* ============================================================
  VerifyIt — Frontend JavaScript
  AI-Powered Fake News Detection Platform
   ============================================================ */

// --- Theme Management ---
function initTheme() {
  const saved = localStorage.getItem('verifyit-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButtons(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('verifyit-theme', theme);
  updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
  document.querySelectorAll('.theme-dot, .settings-theme-button').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

// --- Navbar Scroll ---
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  });
}

// --- Mobile Menu ---
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    links.classList.toggle('mobile-open');
  });

  // Close on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('mobile-open'));
  });
}

// --- Character Count ---
function initCharCount() {
  const textarea = document.getElementById('textInput');
  const counter = document.getElementById('charCount');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
  });
}

const BASE_API_URL = "https://verifyit-3.onrender.com";
// (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'http://127.0.0.1:8000';
// --- Image Upload ---
function initImageUpload() {
  const zone = document.getElementById('imageUploadZone');
  const input = document.getElementById('imageInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleImageFile(file);
  });
}

let currentImageFile = null;

function handleImageFile(file) {
  currentImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('imagePreview');
    const container = document.getElementById('imagePreviewContainer');
    const zone = document.getElementById('imageUploadZone');
    if (preview && container && zone) {
      preview.src = e.target.result;
      container.style.display = 'block';
      zone.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  currentImageFile = null;
  const preview = document.getElementById('imagePreview');
  const container = document.getElementById('imagePreviewContainer');
  const zone = document.getElementById('imageUploadZone');
  const input = document.getElementById('imageInput');
  if (preview) preview.src = '';
  if (container) container.style.display = 'none';
  if (zone) zone.style.display = 'flex';
  if (input) input.value = '';
}

let currentDeepfakeFile = null;

function initDeepfakeUpload() {
  const fileInput = document.getElementById('deepfakeFileInput');
  const fileLabel = document.getElementById('deepfakeFileSelected');
  if (!fileInput || !fileLabel) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleDeepfakeFile(file);
  });
}

function handleDeepfakeFile(file) {
  currentDeepfakeFile = file;
  const label = document.getElementById('deepfakeFileSelected');
  if (label) {
    label.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

function clearDeepfakeFile() {
  currentDeepfakeFile = null;
  const fileInput = document.getElementById('deepfakeFileInput');
  const label = document.getElementById('deepfakeFileSelected');
  if (fileInput) fileInput.value = '';
  if (label) label.textContent = getTranslation('deepfake_input_placeholder') || 'No file selected';
}

async function verifyDeepfake() {
  const resultsDiv = document.getElementById('deepfakeResults');
  if (!requireAuth()) return;
  const file = currentDeepfakeFile;

  if (!file) {
    showToast('Please upload an audio or video file first.', 'warning');
    return;
  }

  resultsDiv.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Analyzing media for deepfake indicators...</div>
    </div>
  `;

  try {
    const base64 = await fileToBase64(file);
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BASE_API_URL}/check-deepfake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        file: base64,
        filename: file.name,
        media_type: file.type
      })
    });

    if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    renderDeepfakeResults(resultsDiv, data);
    saveToHistory('deepfake', file.name, data.suspicion_score, data.verdict);
    showToast('Deepfake analysis complete!', 'success');
  } catch (error) {
    console.error('Deepfake verification error:', error);
    const message = error.message || 'Unknown error';
    const hint = message.includes('Not authenticated')
      ? 'Please log in first to analyze media.'
      : 'Please ensure the backend server is running.';
    resultsDiv.innerHTML = `
      <div class="loading-overlay">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <div class="loading-text" style="color: var(--danger);">Failed to analyze media. ${hint}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${escapeHtml(message)}</div>
      </div>
    `;
    showToast('Deepfake detection failed.', 'error');
  }
}

function renderDeepfakeResults(container, data) {
  const score = Math.round(data.suspicion_score || 0);
  const verdict = data.verdict || 'Uncertain';
  const mediaType = data.media_type || 'media';

  let resultColor = 'var(--danger)';
  let resultEmoji = '⚠️';
  if (score >= 65) {
    resultColor = 'var(--danger)';
    resultEmoji = '⚠️';
  } else if (score >= 45) {
    resultColor = 'var(--warning)';
    resultEmoji = '🔶';
  } else {
    resultColor = 'var(--success)';
    resultEmoji = '✅';
  }

  container.innerHTML = `
    <div class="results-panel">
      <div class="results-header">
        <h3>🎬 Deepfake Analysis</h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.results-panel').remove()">✕</button>
      </div>
      <div class="results-body">
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: var(--radius-sm);">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${escapeHtml(mediaType.toUpperCase())}</div>
          <div style="font-size: 0.95rem; color: var(--text-secondary);">${escapeHtml(data.analysis || 'Synthetic media patterns were evaluated.')}</div>
        </div>

        <div class="score-gauge">
          <div class="gauge-ring">
            <svg viewBox="0 0 100 100">
              <circle class="gauge-bg" cx="50" cy="50" r="46"/>
              <circle class="gauge-fill" cx="50" cy="50" r="46"
                stroke="${resultColor}"
                stroke-dasharray="${2 * Math.PI * 46}"
                stroke-dashoffset="${2 * Math.PI * 46 - (score / 100) * 2 * Math.PI * 46}"/>
            </svg>
            <div class="gauge-text" style="color: ${resultColor};">${score}%</div>
          </div>
          <div class="gauge-label">
            <div class="verdict">${resultEmoji} ${escapeHtml(verdict)}</div>
            <div class="verdict-desc">${score >= 65 ? 'The uploaded media is likely manipulated or synthetic.' : score >= 45 ? 'The media may contain synthetic signals. Review carefully.' : 'The media appears largely genuine based on the analysis.'}</div>
          </div>
        </div>

        ${data.detection_details && data.detection_details.length > 0 ? `
          <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">🔍 Detection Details</h4>
            <ul style="margin: 0; padding-left: 1.2rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">
              ${data.detection_details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${data.explanations && data.explanations.length > 0 ? `
          <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">💡 ${getTranslation('result_ai_analysis')}</h4>
            <ul style="margin: 0; padding-left: 1.2rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">
              ${data.explanations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Verification History ---
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('verifyit-verification-history') || '[]');
  } catch {
    return [];
  }
}

function saveToHistory(type, text, score, verdict) {
  const history = getHistory();
  history.unshift({
    type,
    text: text.substring(0, 200),
    score,
    verdict,
    timestamp: new Date().toISOString()
  });
  // Keep only last 50 entries
  if (history.length > 50) history.pop();
  localStorage.setItem('verifyit-verification-history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  const history = getHistory();
  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No verifications yet. Start by verifying some content!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = history.map((item, idx) => {
    const date = new Date(item.timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const scoreColor = item.score >= 70 ? 'var(--success)' : item.score >= 40 ? 'var(--warning)' : 'var(--danger)';
    const typeLabel = item.type === 'text' ? '📝 Text'
      : item.type === 'url' ? '🔗 URL'
      : item.type === 'image' ? '🖼️ Image'
      : item.type === 'deepfake' ? '🎥 Deepfake' : '🔎 Other';

    return `
      <div class="history-item">
        <div class="history-type">${typeLabel}</div>
        <div class="history-text">${escapeHtml(item.text)}</div>
        <div class="history-meta">
          <span>${date}</span>
          <span style="color: ${scoreColor}; font-weight: 700;">${item.score}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function toggleHistory() {
  const panel = document.getElementById('historyPanel');
  const backdrop = document.getElementById('historyBackdrop');

  if (!panel || !backdrop) return;

  const isOpen = panel.classList.contains('open');

  panel.classList.toggle('open');
  backdrop.classList.toggle('show');

  if (!isOpen) {
    renderHistory();
  }
}


function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const LANGUAGE_KEY = 'verifyit-language';
const WHATSAPP_SHARE_BASE = 'https://api.whatsapp.com/send?text=';

function getSelectedLanguage() {
  return document.getElementById('settingsLanguageSelect')?.value || localStorage.getItem(LANGUAGE_KEY) || 'en';
}

const translations = {
  en: {
    nav_verify: 'Verify',
    nav_about: 'About',
    hero_badge: 'AI-Powered Verification',
    hero_heading: 'Welcome to fake news detection platform with Iconfam',
    hero_paragraph: 'Paste an article or upload a screenshot — our multi-model AI engine analyzes text, cross-references sources, and delivers a credibility score in seconds.',
    hero_start: 'Start Confirming ↓',
    hero_trending: 'Trending News',
    verify_title: 'Verify Your Content',
    verify_subtitle: 'Choose your verification method below and get instant results.',
    text_card_title: 'Text Verification',
    text_card_desc: 'Paste an article or claim to analyze',
    url_card_title: 'URL Verification',
    url_card_desc: 'Enter a news article URL to analyze',
    image_card_title: 'Image Verification',
    image_card_desc: 'Upload a news screenshot to analyze',
    play_learn_title: 'Play and Share',
    play_learn_subtitle: 'Improve your fact-checking skills and report suspicious news with WhatsApp.',
    quiz_title: 'Fake News Quiz',
    quiz_desc: 'Challenge yourself with short quiz questions to spot misinformation.',
    start_quiz_btn: 'Start Quiz',
    whatsapp_title: 'WhatsApp Verification Helper',
    whatsapp_desc: 'Generate a ready-made WhatsApp message to report or verify suspicious claims.',
    whatsapp_input_placeholder: 'Paste the claim or headline you want to verify...',
    whatsapp_generate: 'Generate Message',
    whatsapp_copy: 'Copy Message',
    whatsapp_open: 'Open WhatsApp',
    feedback_title: 'User Feedback',
feedback_desc: 'Help us improve iConfam by sharing your experience, suggestions, or feedback about the verification service.',
feedback_button: 'Give Feedback',
feedback_name: 'Your Name',
feedback_email: 'Email',
feedback_experience: 'How was your experience?',
feedback_message: 'Feedback',
feedback_message_placeholder: 'Tell us what you liked, what could be improved, or any suggestions you have...',
feedback_submit: 'Submit Feedback',
feedback_cancel: 'Cancel',
feedback_title_modal: 'Share Your Feedback',
feedback_subtitle: 'Tell us how we can make iConfam better.',
feedback_success: 'Thank you! Your feedback has been submitted.',
feedback_rating_required: 'Please rate your experience.',
feedback_required: 'Please provide your name and feedback.',
    result_title: 'Verification Result',
    result_ai_analysis: 'AI Analysis',
    result_sources: 'Sources Found',
    no_analysis_available: 'No detailed analysis available.',
    verdict_likely_credible: 'Likely Credible',
    verdict_possibly_credible: 'Possibly Credible',
    verdict_uncertain: 'Uncertain',
    verdict_likely_unreliable: 'Likely Unreliable',
    verdict_very_likely_fake: 'Very Likely Fake',
    verdict_desc_high: 'This content appears highly credible and is well-supported by trusted sources.',
    verdict_desc_medium: 'This content seems mostly credible but some claims could not be fully verified.',
    verdict_desc_mixed: 'This content has mixed signals — some claims check out while others are questionable.',
    verdict_desc_warning: 'This content shows significant warning signs of being unreliable or misleading.',
    verdict_desc_fake: 'This content is very likely to be fake or heavily misleading. Exercise extreme caution.'
  },
  yo: {
    nav_verify: 'Ṣàyẹwo',
    nav_about: 'Nipa',
    hero_badge: 'Ìmúlòlùfẹ́ AI',
    hero_heading: 'Ṣàwárí Ìròyìn Asán pẹ̀lú Iconfam',
    hero_paragraph: 'Da àpilẹ̀kọ sílẹ̀ tàbí gbe àwòrán kan sórí — Ẹ̀rọ AI wa yóò ṣe àyẹ̀wò àti fí ìtẹ́numọ́ hàn ní ìsẹ́jú.',
    hero_start: 'Bẹrẹ Ṣàtúnṣe ↓',
    hero_trending: 'Ìròyìn tó ń gbajú',
    verify_title: 'Ṣàyẹwo Àkóónú Rẹ',
    verify_subtitle: 'Yan ọ̀nà ṣàyẹwo rẹ̀ ní isalẹ kí o sì gba esi lẹ́sẹkẹsẹ.',
    text_card_title: 'Ṣàyẹwo Ọ̀rọ̀',
    text_card_desc: 'Da àpilẹ̀kọ tàbí ẹ̀sùn sílẹ̀ láti ṣe àyẹ̀wò',
    url_card_title: 'Ṣàyẹwo URL',
    url_card_desc: 'Tẹ URL ìròyìn kan láti ṣe àyẹ̀wò',
    image_card_title: 'Ṣàyẹwo Aworan',
    image_card_desc: 'Gbe aworan iṣawari tabi iroyin kan sórí',
    deepfake_section_title: 'Ìmúlòlùfẹ́ Deepfake',
    deepfake_section_subtitle: 'Gbe fidio tàbí ohun àfihàn sórí fún ìtúpalẹ̀ amuṣẹ́fún.',
    deepfake_card_title: 'Olùwádìí Deepfake',
    deepfake_card_desc: 'Gbe ohun tàbí fíìmù sórí láti ṣàyẹwo amuṣẹ́fún àti gba ìtumọ̀ AI.',
    deepfake_input_placeholder: 'Yan faili ohun tabi fidio...',
    deepfake_button: 'Gbe Media',
    deepfake_detect_btn: 'Ṣàyẹwo Deepfake',
    play_learn_title: 'Ṣeré àti Pín',
    play_learn_subtitle: 'Mu ogbontarigi rẹ pọ̀ nípa kíkẹ́kọ̀ọ́ àti fí WhatsApp ránṣẹ́.',
    quiz_title: 'Ìdánwò Ìròyìn Asán',
    quiz_desc: 'Kọ ẹ̀kọ bí a ṣe ń rí iroyin asán nípasẹ̀ ìbéèrè kúkúrú.',
    start_quiz_btn: 'Bẹrẹ Ìdánwò',
    whatsapp_title: 'Iranlọwọ WhatsApp',
    whatsapp_desc: 'Ṣẹda ifiranṣẹ WhatsApp tí ó ṣetan láti jabo tàbí ṣe àyẹ̀wò ẹ̀sùn.',
    whatsapp_input_placeholder: 'Da ẹ̀sùn tàbí akọle tí o fẹ́ ṣe àyẹ̀wò sílẹ̀...',
    whatsapp_generate: 'Ṣẹda Ifiranṣẹ',
    whatsapp_copy: 'Daakọ Ifiranṣẹ',
    whatsapp_open: 'Ṣí WhatsApp',
    feedback_title: 'Èrò àti Àbá Olùlò',
feedback_desc: 'Ràn wá lọ́wọ́ láti mú iConfam dára sí i nípa pínpín ìrírí, àbá, tàbí èrò rẹ nípa iṣẹ́ ìṣàyẹ̀wò wa.',
feedback_button: 'Fún Wa Ní Èrò Rẹ',
feedback_name: 'Orúkọ Rẹ',
feedback_email: 'Imeeli',
feedback_experience: 'Báwo ni ìrírí rẹ ṣe rí?',
feedback_message: 'Èrò àti Àbá',
feedback_message_placeholder: 'Sọ fún wa ohun tí o fẹ́ràn, ohun tí a lè mú dára sí i, tàbí àbá tí o ní...',
feedback_submit: 'Firanṣẹ́ Èrò',
feedback_cancel: 'Fagilé',
feedback_title_modal: 'Pín Èrò Rẹ',
feedback_subtitle: 'Sọ fún wa bí a ṣe lè mú iConfam dára sí i.',
feedback_success: 'O ṣeun! A ti gba èrò rẹ.',
feedback_rating_required: 'Jọ̀wọ́ fún wa ní ìdíyelé ìrírí rẹ.',
feedback_required: 'Jọ̀wọ́ tẹ orúkọ rẹ àti èrò rẹ sílẹ̀.',
    result_title: 'Esi Ṣàyẹwo',
    result_ai_analysis: 'Ìtúpalẹ̀ AI',
    result_sources: 'Orísun Tó Rí',
    no_analysis_available: 'Kò sí àlàyé pípa tó wà.',
    verdict_likely_credible: 'Ẹ̀rí Òótọ́ Ló Wà',
    verdict_possibly_credible: 'Ṣeé Ṣàtúnṣe',
    verdict_uncertain: 'Aìdánidájọ́',
    verdict_likely_unreliable: 'Kò Dáa Gẹ́gẹ́ Bí Ó Tó',
    verdict_very_likely_fake: 'Ẹ̀rí Ọ̀tító Kò Dáa',
    verdict_desc_high: 'Àkóónú yìí dàbí ẹni pé ó ní ìmúlòlùfẹ́ gíga àti orísun tó dájú.',
    verdict_desc_medium: 'Àkóónú yìí dàbí ẹni pé ó lè jẹ́ gidi ṣùgbọ́n ìkan nínú rẹ̀ kò tíì jẹ́ kó dájú.',
    verdict_desc_mixed: 'Àkóónú yìí ní ami àìmọ̀kan — diẹ̀ nínú ẹ̀rí wà, ṣugbọn àwọn míì ṣòro láti jẹ́ kó dájú.',
    verdict_desc_warning: 'Àkóónú yìí fi àfihàn ìkìlọ̀ hàn pé ó lè jẹ́ aláìdánidájọ́ tàbí ẹ̀sùn.',
    verdict_desc_fake: 'Àkóónú yìí dájú pé ó ṣeé ṣe kí ó jẹ́ ìròyìn asán. Ṣọra gan-an.'
  },
  ha: {
    nav_verify: 'Tabbatar',
    nav_about: 'Game da',
    hero_badge: 'Bincike na AI',
    hero_heading: 'Gano Karya Labarai tare da Iconfam',
    hero_paragraph: 'Manna labarin ko ɗora hoton allo — ƙirar AI namu zata bincika sannan ta bayar da sakamako cikin sauri.',
    hero_start: 'Fara Tabbatarwa ↓',
    hero_trending: 'Labarai Masu Ƙarfi',
    verify_title: 'Tabbatar Abun Cikin Ka',
    verify_subtitle: 'Zaɓi hanyar tabbaci a ƙasa ka samu sakamako nan da nan.',
    text_card_title: 'Tabbatar Rubutu',
    text_card_desc: 'Manna labarin ko ƙila don a bincika',
    url_card_title: 'Tabbatar URL',
    url_card_desc: 'Shigar da URL ɗin labari don a bincika',
    image_card_title: 'Tabbatar Hoton',
    image_card_desc: 'Loda hoto na labari ko allo',
    deepfake_section_title: 'Gano Deepfake',
    deepfake_section_subtitle: 'Loda sauti ko bidiyo don nazarin kafofin watsa labarai na ƙarya.',
    deepfake_card_title: 'Mai Ganowa Deepfake',
    deepfake_card_desc: 'Loda sauti ko bidiyo don gano hanyoyin kirkirar AI da samun bayani.',
    deepfake_input_placeholder: 'Zaɓi fayil na sauti ko bidiyo...',
    deepfake_button: 'Loda Media',
    deepfake_detect_btn: 'Gano Deepfake',
    play_learn_title: 'Yi Wasan Koyo',
    play_learn_subtitle: 'Inganta ƙwarewar ka ta hanyar wasa da kuma raba via WhatsApp.',
    quiz_title: 'Gwajin Karya Labarai',
    quiz_desc: 'Gwada kanka da tambayoyi don gano labarai mara gaskiya.',
    start_quiz_btn: 'Fara Gwaji',
    whatsapp_title: 'Taimakon WhatsApp',
    whatsapp_desc: 'Ƙirƙiri saƙon WhatsApp da za a iya tura wa don tantance gaskiya.',
    whatsapp_input_placeholder: 'Manna ikirari ko taken da kake son tantancewa...',
    whatsapp_generate: 'Ƙirƙiri Saƙo',
    whatsapp_copy: 'Kwafi Saƙo',
    whatsapp_open: 'Bude WhatsApp',
    language_title: 'Taimako na Yanki',
    language_desc: 'Canza zuwa Yorùbá, Hausa, ko Igbo don ƙwarewa mafi sauƙi.',
    language_info: 'Yi amfani da zaɓin harshe a sama don zaɓar harshen ka.',
    result_title: 'Sakamakon Tabbatarwa',
    result_ai_analysis: 'Binciken AI',
    result_sources: 'Tushen da aka samu',
    no_analysis_available: 'Babu cikakken bayani da aka samu.',
    verdict_likely_credible: 'Mai Yuwuwar Amincewa',
    verdict_possibly_credible: 'Yiwuwar Amincewa',
    verdict_uncertain: 'Ba a Tabbatar ba',
    verdict_likely_unreliable: 'Mai Yuwuwar Rashin Amincewa',
    verdict_very_likely_fake: 'Mai Yuwuwar Karya',
    verdict_desc_high: 'Wannan abun cikin yana nuna alamun gaskiya sosai kuma ana tallafawa da tushen da suka dace.',
    verdict_desc_medium: 'Wannan abun cikin yana da alamar gaskiya amma wasu ƙididdiga ba a iya tabbatar da su ba.',
    verdict_desc_mixed: 'Wannan abun cikin yana da alamun gauraye — wasu abubuwa sun dace amma wasu suna da tambaya.',
    verdict_desc_warning: 'Wannan abun cikin yana nuna manyan alamun cewa ba a iya dogaro da shi ba ko kuma yana iya zama mai yaudara.',
    verdict_desc_fake: 'Wannan abun cikin yana iya zama ƙarya sosai ko kuma yaudara. Kasance mai matukar hankali.'
  },
  ig: {
    nav_verify: 'Nyocha',
    nav_about: 'Banyere',
    hero_badge: 'Nyocha AI',
    hero_heading: 'Chọta Akwụkwọ Akụkọ Ụgha na Iconfam',
    hero_paragraph: 'Tinye akụkọ ma ọ bụ bulite onyonyo — igwe AI anyị ga-enyocha ma nye akara ntụkwasị obi n’oge.',
    hero_start: 'Malite Nyocha ↓',
    hero_trending: 'Akụkọ Na-apụta',
    verify_title: 'Nyocha Ebumnuche Gị',
    verify_subtitle: 'Họrọ ụzọ nnyocha gị n’okpuru ma nweta nsonaazụ ozugbo.',
    text_card_title: 'Nyocha Okwu',
    text_card_desc: 'Tinye akụkọ ma ọ bụ nkwupụta iji nyochaa',
    url_card_title: 'Nyocha URL',
    url_card_desc: 'Tinye URL akụkọ iji nyochaa',
    image_card_title: 'Nyocha Ihe Onyonyo',
    image_card_desc: 'Bulite eserese akụkọ ma ọ bụ screenshot',
    deepfake_section_title: 'Nyocha Deepfake',
    deepfake_section_subtitle: 'Bulite faịlụ vidiyo ma ọ bụ ụda maka nyocha mgbakwunye.',
    deepfake_card_title: 'Ngwa Nyocha Deepfake',
    deepfake_card_desc: 'Bulite faịlụ ụda ma ọ bụ vidiyo iji chọpụta ọnụọgụ AI na inweta nkọwa.',
    deepfake_input_placeholder: 'Họrọ faịlụ ụda ma ọ bụ vidiyo...',
    deepfake_button: 'Bulite Media',
    deepfake_detect_btn: 'Chọpụta Deepfake',
    play_learn_title: 'Mee Ihe Ọma',
    play_learn_subtitle: 'Melite nkà nne gị site n’ịmụta na ịkekọrịta na WhatsApp.',
    quiz_title: 'Nzaghachi Akụkọ Ụgha',
    quiz_desc: 'Nwalee onwe gị na ajụjụ dị mkpụmkpụ iji chọpụta ozi ụgha.',
    start_quiz_btn: 'Malite Nzaghachi',
    whatsapp_title: 'Nkwado WhatsApp',
    whatsapp_desc: 'Mepụta ozi WhatsApp dị njikere ịkekọrịta maka ịlele okwu.',
    whatsapp_input_placeholder: 'Tinye nkwupụta ma ọ bụ isiokwu ịchọrọ iji nyochaa...',
    whatsapp_generate: 'Mepụta Ozi',
    whatsapp_copy: 'Detuo Ozi',
    whatsapp_open: 'Meghee WhatsApp',
    language_title: 'Nkwado Asụsụ Ọgbakọ',
    language_desc: 'Họrọ Yoruba, Hausa, ma ọ bụ Igbo maka ahụmịhe nchegharị ka mma.',
    language_info: 'Jiri onye nhọpụta asụsụ n’elu họrọ asụsụ mpaghara gị.',
    result_title: 'Nsonaazụ Nyocha',
    result_ai_analysis: 'Nyocha AI',
    result_sources: 'Isi iyi e hụrụ',
    no_analysis_available: 'Enweghị nkọwa zuru ezu dị.',
    verdict_likely_credible: 'O yiri ka ọ bụ eziokwu',
    verdict_possibly_credible: 'O nwere ike ịbụ eziokwu',
    verdict_uncertain: 'E nweghị nkenke',
    verdict_likely_unreliable: 'O yiri ka ọ bụghị ntụkwasị obi',
    verdict_very_likely_fake: 'O yiri ka ọ bụ ụgha',
    verdict_desc_high: 'Ihe a yiri ka ọ ga-adị ezigbo ntụkwasị obi ma kwado ya site na isi iyi a pụrụ ịdabere na ya.',
    verdict_desc_medium: 'Ihe a yiri ka ọ pụrụ ịbụ eziokwu mana ụfọdụ nkwupụta adịghị edozi.',
    verdict_desc_mixed: 'Ihe a nwere akara ngwakọta — ụfọdụ ihe doro anya ma ụfọdụ adịghị mma.',
    verdict_desc_warning: 'Ihe a na-egosi ihe ngosi siri ike na ọ gaghị adị ntụkwasị obi ma ọ bụ nwere ike ịghọgharia.',
    verdict_desc_fake: 'Ihe a ga-adị ọtụtụ oge ụgha ma ọ bụ nke a na-ezighị ezi. Nwee nchegbu nke ukwuu.'
  }
};

function getTranslation(key) {
  const lang = localStorage.getItem(LANGUAGE_KEY) || 'en';
  return translations[lang]?.[key] || translations.en[key] || '';
}

function localizeVerdict(verdict) {
  const mapping = {
    'Likely Credible': 'verdict_likely_credible',
    'Possibly Credible': 'verdict_possibly_credible',
    'Uncertain': 'verdict_uncertain',
    'Likely Unreliable': 'verdict_likely_unreliable',
    'Very Likely Fake': 'verdict_very_likely_fake'
  };
  const key = mapping[verdict] || 'verdict_uncertain';
  return getTranslation(key) || verdict;
}

function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = getTranslation(key);
    if (!value) return;
    el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const value = getTranslation(key);
    if (!value) return;
    el.setAttribute('placeholder', value);
  });
  const langSelect = document.getElementById('settingsLanguageSelect');
  if (langSelect) {
    langSelect.value = localStorage.getItem(LANGUAGE_KEY) || 'en';
  }
}

function setLanguage(lang) {
  localStorage.setItem(LANGUAGE_KEY, lang);
  translatePage();
}

function initLanguageSelector() {
  const selector = document.getElementById('settingsLanguageSelect');
  if (!selector) return;
  selector.addEventListener('change', () => setLanguage(selector.value));
  const saved = localStorage.getItem(LANGUAGE_KEY) || 'en';
  selector.value = saved;
  translatePage();
}

// --- Profile Save / Settings Save ---
function saveProfile() {
  const name = document.getElementById('profileNameInput')?.value?.trim();
  const email = document.getElementById('profileEmailInput')?.value?.trim();
  const location = document.getElementById('profileLocationInput')?.value?.trim();
  const bio = document.getElementById('profileBioInput')?.value?.trim();

  if (!name) {
    showToast('Please enter your name before saving.', 'warning');
    return;
  }

  // Update local current user
  const current = getCurrentUser() || {};
  const updated = Object.assign({}, current, {
    username: name,
    email: email || current.email || '',
    location: location || current.location || '',
    bio: bio || current.bio || ''
  });
  setCurrentUser(updated);

  // Update UI
  const userNameElem = document.getElementById('userName');
  const userAvatarElem = document.getElementById('userAvatar');
  if (userNameElem) userNameElem.textContent = updated.username;
  if (userAvatarElem) userAvatarElem.textContent = updated.username.charAt(0).toUpperCase();

  showToast('Profile saved locally.', 'success');

  // Try to persist to backend if authenticated — best-effort
  (async () => {
    try {
      if (isAuthenticated()) {
        // Attempt to call a common user-update endpoint. If it fails, ignore but log.
        const payload = { username: updated.username, location: updated.location, bio: updated.bio };
        await apiCall('/user', { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Profile saved to server.', 'success');
      }
    } catch (err) {
      console.warn('Server profile save failed:', err.message || err);
    }
  })();

  // Close modal
  openProfile(false);
}

function populateProfileForm() {
  const user = getCurrentUser() || {};
  const nameInput = document.getElementById('profileNameInput');
  const emailInput = document.getElementById('profileEmailInput');
  const locationInput = document.getElementById('profileLocationInput');
  const bioInput = document.getElementById('profileBioInput');
  const avatar = document.getElementById('profileAvatar');
  if (nameInput) nameInput.value = user.username || '';
  if (emailInput) emailInput.value = user.email || '';
  if (locationInput) locationInput.value = user.location || '';
  if (bioInput) bioInput.value = user.bio || '';
  if (avatar) avatar.textContent = (user.username || 'U').charAt(0).toUpperCase();
}

function saveSettings() {
  const lang = document.getElementById('settingsLanguageSelect')?.value || localStorage.getItem(LANGUAGE_KEY) || 'en';
  setLanguage(lang); // immediate preview + persist
  // Theme is applied immediately via the theme buttons
  showToast('Settings updated.', 'success');
  openSettings(false);
}

// ============================================================
// FAKE NEWS QUIZ
// ============================================================

const quizQuestions = [
  {
    question: "A message says: 'Share this immediately or your bank account will be blocked today.' What should you do?",
    options: [
      "Share it immediately",
      "Verify the claim through an official source",
      "Send it to all your contacts",
      "Ignore every warning message"
    ],
    answer: 1,
    explanation: "Urgent messages that pressure you to share information should be verified through an official source before taking action."
  },

  {
    question: "Which is the strongest sign that an online news story may be unreliable?",
    options: [
      "It has a professional-looking website",
      "It contains a sensational headline with no credible sources",
      "It has a photograph",
      "It is shared by a friend"
    ],
    answer: 1,
    explanation: "Sensational claims without credible sources are a common warning sign of misinformation."
  },

  {
    question: "You receive a screenshot claiming that a famous person made a controversial statement. What should you do first?",
    options: [
      "Share the screenshot",
      "Assume it is true",
      "Look for the original statement from a credible source",
      "Edit the screenshot"
    ],
    answer: 2,
    explanation: "Screenshots can be edited or taken out of context. Look for the original statement or credible reporting."
  },

  {
    question: "What does fact-checking involve?",
    options: [
      "Believing information that agrees with you",
      "Checking claims against reliable evidence and sources",
      "Sharing information quickly",
      "Reading only social media comments"
    ],
    answer: 1,
    explanation: "Fact-checking means examining claims against evidence and trustworthy sources."
  },

  {
    question: "What should you do when an AI verification result is uncertain?",
    options: [
      "Treat it as definitely true",
      "Treat it as definitely fake",
      "Check additional trusted sources",
      "Share it anyway"
    ],
    answer: 2,
    explanation: "AI tools can make mistakes. An uncertain result means you should conduct additional verification."
  }
];

let currentQuizQuestion = 0;
let quizScore = 0;
let quizAnswered = false;


// Open / close quiz
function toggleQuiz() {
    console.log("QUIZ BUTTON CLICKED");

    const quizModal = document.getElementById("quizModalBackdrop");

    if (!quizModal) {
        console.error("quizModalBackdrop NOT FOUND");
        alert("Quiz HTML container was not found.");
        return;
    }

    quizModal.classList.remove("hidden");

    quizState = {
        current: 0,
        score: 0,
        answered: false,
        completed: false
    };

    renderQuizQuestion();
}


// Render current question
function renderQuizQuestion() {
  const body = document.getElementById('quizBody');
  const progress = document.getElementById('quizProgress');
  const nextBtn = document.getElementById('quizNextBtn');
  const restartBtn = document.getElementById('quizRestartBtn');

  if (!body) {
    console.error('quizBody element not found.');
    return;
  }

  const question = quizQuestions[currentQuizQuestion];

  if (!question) {
    showQuizResult();
    return;
  }

  quizAnswered = false;

  if (progress) {
    progress.textContent =
      `Question ${currentQuizQuestion + 1} of ${quizQuestions.length}`;
  }

  if (nextBtn) {
    nextBtn.classList.remove('hidden');
    nextBtn.disabled = true;
    nextBtn.textContent =
      currentQuizQuestion === quizQuestions.length - 1
        ? 'Finish Quiz'
        : 'Next Question';
  }

  if (restartBtn) {
    restartBtn.classList.add('hidden');
  }

  body.innerHTML = `
    <div class="quiz-question">
      <h4 style="
        font-size: 1.15rem;
        line-height: 1.6;
        margin-bottom: 1.25rem;
      ">
        ${escapeHtml(question.question)}
      </h4>

      <div class="quiz-options">
        ${question.options.map((option, index) => `
          <button
            type="button"
            class="quiz-option"
            onclick="selectQuizAnswer(${index})"
          >
            <span class="quiz-option-number">
              ${String.fromCharCode(65 + index)}
            </span>

            <span>
              ${escapeHtml(option)}
            </span>
          </button>
        `).join('')}
      </div>

      <div
        id="quizExplanation"
        style="
          display:none;
          margin-top:1rem;
          padding:1rem;
          border-radius:8px;
          background:var(--bg-secondary);
          color:var(--text-secondary);
          line-height:1.6;
        "
      ></div>
    </div>
  `;
}


// Select answer
function selectQuizAnswer(selectedIndex) {
  if (quizAnswered) return;

  const question = quizQuestions[currentQuizQuestion];

  if (!question) return;

  quizAnswered = true;

  const options = document.querySelectorAll('.quiz-option');
  const nextBtn = document.getElementById('quizNextBtn');
  const explanation = document.getElementById('quizExplanation');

  options.forEach((button, index) => {
    button.disabled = true;

    if (index === question.answer) {
      button.classList.add('correct');
    }

    if (
      index === selectedIndex &&
      selectedIndex !== question.answer
    ) {
      button.classList.add('incorrect');
    }
  });

  if (selectedIndex === question.answer) {
    quizScore++;
    showToast('Correct! 🎉', 'success');
  } else {
    showToast('Not quite. Check the explanation.', 'warning');
  }

  if (explanation) {
    explanation.style.display = 'block';

    explanation.innerHTML = `
      <strong>
        ${selectedIndex === question.answer ? '✅ Correct!' : '💡 Explanation'}
      </strong>

      <div style="margin-top:0.4rem;">
        ${escapeHtml(question.explanation)}
      </div>
    `;
  }

  if (nextBtn) {
    nextBtn.disabled = false;
  }
}


// Next question
function quizNext() {
  if (!quizAnswered) {
    showToast('Please select an answer first.', 'warning');
    return;
  }

  currentQuizQuestion++;

  if (currentQuizQuestion >= quizQuestions.length) {
    showQuizResult();
    return;
  }

  renderQuizQuestion();
}


// Show final score
function showQuizResult() {
  const body = document.getElementById('quizBody');
  const progress = document.getElementById('quizProgress');
  const nextBtn = document.getElementById('quizNextBtn');
  const restartBtn = document.getElementById('quizRestartBtn');

  if (!body) return;

  const percentage = Math.round(
    (quizScore / quizQuestions.length) * 100
  );

  let message = '';

  if (percentage >= 80) {
    message = 'Excellent! You have a strong eye for misinformation.';
  } else if (percentage >= 60) {
    message = 'Good job! Keep improving your fact-checking skills.';
  } else {
    message = 'Keep learning! Always verify suspicious information before sharing.';
  }

  if (progress) {
    progress.textContent = 'Quiz Complete';
  }

  if (nextBtn) {
    nextBtn.classList.add('hidden');
  }

  if (restartBtn) {
    restartBtn.classList.remove('hidden');
  }

  body.innerHTML = `
    <div style="
      text-align:center;
      padding:2rem 1rem;
    ">

      <div style="
        font-size:4rem;
        margin-bottom:1rem;
      ">
        ${percentage >= 80 ? '🏆' : percentage >= 60 ? '🎉' : '📚'}
      </div>

      <h3 style="
        font-size:1.5rem;
        margin-bottom:0.75rem;
      ">
        Quiz Completed!
      </h3>

      <div style="
        font-size:3rem;
        font-weight:800;
        margin:1rem 0;
      ">
        ${quizScore}/${quizQuestions.length}
      </div>

      <p style="
        color:var(--text-secondary);
        line-height:1.6;
      ">
        ${escapeHtml(message)}
      </p>

      <div style="
        margin-top:1rem;
        font-weight:700;
      ">
        Score: ${percentage}%
      </div>

    </div>
  `;

  quizAnswered = true;
}


// Restart quiz
function resetQuiz() {
  currentQuizQuestion = 0;
  quizScore = 0;
  quizAnswered = false;

  renderQuizQuestion();
}

function generateWhatsAppShare() {
  const input = document.getElementById('whatsappClaimInput');
  const output = document.getElementById('whatsappMessageOutput');
  const shareLink = document.getElementById('whatsappShareLink');

  if (!input || !output || !shareLink) return;
  const claim = input.value.trim();
  if (!claim) {
    showToast('Please enter a claim or headline first.', 'warning');
    return;
  }

  const displayMessage = `Hello VerifyIt team!\n\nPlease help verify the following claim:\n\n"${claim}"\n\nThank you.`;
  const message = encodeURIComponent(displayMessage);

  output.textContent = displayMessage;
  shareLink.href = `${WHATSAPP_SHARE_BASE}${message}`;
  shareLink.classList.remove('hidden');
  showToast('WhatsApp message prepared. Open it to share.', 'success');
}

function copyWhatsAppMessage() {
  const output = document.getElementById('whatsappMessageOutput');
  if (!output || !output.textContent.trim()) {
    showToast('No message to copy yet.', 'warning');
    return;
  }

  navigator.clipboard.writeText(output.textContent.trim()).then(() => {
    showToast('WhatsApp message copied to clipboard.', 'success');
  }).catch(() => {
    showToast('Unable to copy message on this browser.', 'error');
  });
}

function openWhatsApp() {
  const shareLink = document.getElementById('whatsappShareLink');
  if (!shareLink || !shareLink.href) {
    showToast('Generate a WhatsApp message first.', 'warning');
    return;
  }
  window.open(shareLink.href, '_blank');
}

// --- Text Verification ---
async function verifyText() {
  const textarea = document.getElementById('textInput');
  const resultsDiv = document.getElementById('textResults');
  const btn = document.getElementById('verifyTextBtn');

  if (!textarea || !resultsDiv) return;
  if (!requireAuth()) return;

  const text = textarea.value.trim();
  if (!text) {
    showToast('Please enter some text to verify.', 'warning');
    return;
  }

  if (text.length < 20) {
    showToast('Please enter at least 20 characters for accurate analysis.', 'warning');
    return;
  }

  // Show loading
  btn.disabled = true;
  resultsDiv.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Analyzing with BERT + LLM + Web Search...</div>
    </div>
  `;

  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BASE_API_URL}/check`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text, language: getSelectedLanguage() })
    });

    if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${errorData.detail || `Server error: ${response.status}`} (endpoint: ${BASE_API_URL}/check)`);
    }

    const data = await response.json();
    renderResults(resultsDiv, data, 'text');
    saveToHistory('text', text, data.credibility_score, data.verdict);
    showToast('Verification complete!', 'success');
  } catch (error) {
    console.error('Verification error:', error);
    const message = error.message || 'Unknown error';
    const hint = message.includes('Not authenticated')
      ? 'Please log in first to verify content.'
      : 'Please ensure the backend server is running.';
    resultsDiv.innerHTML = `
      <div class="loading-overlay">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <div class="loading-text" style="color: var(--danger);">Failed to verify. ${hint}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${escapeHtml(message)}</div>
      </div>
    `;
    showToast('Verification failed.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// --- URL Verification ---
async function verifyUrl() {
  const input = document.getElementById('urlInput');
  const resultsDiv = document.getElementById('urlResults');
  const btn = document.getElementById('verifyUrlBtn');

  if (!input || !resultsDiv) return;
  if (!requireAuth()) return;

  const url = input.value.trim();
  if (!url) {
    showToast('Please enter a URL to verify.', 'warning');
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    showToast('Please enter a valid URL.', 'warning');
    return;
  }

  // Show loading
  btn.disabled = true;
  resultsDiv.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Fetching content and analyzing...</div>
    </div>
  `;

  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BASE_API_URL}/check-url`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url, language: getSelectedLanguage() })
    });

    if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${errorData.detail || `Server error: ${response.status}`} (endpoint: ${BASE_API_URL}/check-url)`);
    }

    const data = await response.json();
    renderResults(resultsDiv, data, 'url');
    saveToHistory('url', data.title || url, data.credibility_score, data.verdict);
    showToast('URL verification complete!', 'success');
  } catch (error) {
    console.error('URL verification error:', error);
    const message = error.message || 'Unknown error';
    const hint = message.includes('Not authenticated')
      ? 'Please log in first to verify content.'
      : 'Please check the URL and ensure the backend server is running.';
    resultsDiv.innerHTML = `
      <div class="loading-overlay">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <div class="loading-text" style="color: var(--danger);">Failed to verify URL. ${hint}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${escapeHtml(message)}</div>
      </div>
    `;
    showToast('URL verification failed.', 'error');
  } finally {
    btn.disabled = false;
  }
}

function clearUrl() {
  const input = document.getElementById('urlInput');
  const resultsDiv = document.getElementById('urlResults');
  if (input) input.value = '';
  if (resultsDiv) resultsDiv.innerHTML = '';
}

// --- Image Verification ---
async function verifyImage() {
  if (!requireAuth()) return;
  const resultsDiv = document.getElementById('imageResults');
  const btn = document.getElementById('verifyImageBtn');

  if (!currentImageFile) {
    showToast('Please upload an image first.', 'warning');
    return;
  }

  btn.disabled = true;
  resultsDiv.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Analyzing image with Gemini Vision + AI...</div>
    </div>
  `;

  try {
    const base64 = await fileToBase64(currentImageFile);
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BASE_API_URL}/check-image`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64,
        filename: currentImageFile.name,
        language: getSelectedLanguage()
      })
    });

    if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    renderResults(resultsDiv, data, 'image');
    saveToHistory('image', data.extracted_text || currentImageFile.name, data.credibility_score, data.verdict);
    showToast('Image verification complete!', 'success');
  } catch (error) {
    console.error('Image verification error:', error);
    const message = error.message || 'Unknown error';
    const hint = message.includes('Not authenticated')
      ? 'Please log in first to verify content.'
      : 'Please ensure the backend server is running.';
    resultsDiv.innerHTML = `
      <div class="loading-overlay">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <div class="loading-text" style="color: var(--danger);">Failed to verify image. ${hint}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${escapeHtml(message)}</div>
      </div>
    `;
    showToast('Image verification failed.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// --- Extract Text from Image ---
async function extractTextFromImage() {
  if (!requireAuth()) return;
  const resultsDiv = document.getElementById('imageResults');

  if (!currentImageFile) {
    showToast('Please upload an image first.', 'warning');
    return;
  }

  resultsDiv.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Extracting text with OCR...</div>
    </div>
  `;

  try {
    const base64 = await fileToBase64(currentImageFile);
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BASE_API_URL}/extract-text`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64,
        filename: currentImageFile.name,
        language: getSelectedLanguage()
      })
    });

    if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data.text && data.text.trim()) {
      // Put extracted text into the text area
      const textarea = document.getElementById('textInput');
      if (textarea) {
        textarea.value = data.text;
        textarea.dispatchEvent(new Event('input'));
      }
      showToast('Text extracted! You can now verify it using Text Verification.', 'success');
      resultsDiv.innerHTML = `
        <div class="results-panel">
          <div class="results-header">
            <h3>📄 Extracted Text</h3>
          </div>
          <div class="results-body">
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">${escapeHtml(data.text)}</p>
            <div style="margin-top: 1rem;">
              <button class="btn btn-primary btn-sm" onclick="document.getElementById('textInput').value = ${JSON.stringify(data.text).replace(/"/g, '"')}; document.getElementById('textInput').dispatchEvent(new Event('input')); document.getElementById('verifyTextBtn').click();">
                🔍 Verify This Text
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      resultsDiv.innerHTML = `
        <div class="loading-overlay">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
          <div class="loading-text">No readable text could be extracted. Try a clearer image or crop closer to the text.</div>
        </div>
      `;
      showToast('No text found in the image.', 'warning');
    }
  } catch (error) {
    console.error('OCR error:', error);
    resultsDiv.innerHTML = `
      <div class="loading-overlay">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <div class="loading-text" style="color: var(--danger);">OCR extraction failed. Is the server running?</div>
      </div>
    `;
    showToast('Text extraction failed.', 'error');
  }
}

// --- Render Results ---
function renderResults(container, data, type) {
  const score = Math.round(data.credibility_score || 0);
  const verdict = localizeVerdict(data.verdict || 'Uncertain');
  const reasoning = data.reasoning || data.llm_analysis || getTranslation('no_analysis_available');

  // Determine color based on score
  let scoreColor = 'var(--danger)';
  let verdictEmoji = '🔴';
  if (score >= 70) {
    scoreColor = 'var(--success)';
    verdictEmoji = '🟢';
  } else if (score >= 40) {
    scoreColor = 'var(--warning)';
    verdictEmoji = '🟡';
  }

  // Breakdown scores
  const bertScore = Math.round((data.bert_score || 0) * 100);
  const llmScore = Math.round((data.llm_score || 0) * 100);
  const webScore = Math.round((data.web_score || 0) * 100);

  // Gauge SVG
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;

  container.innerHTML = `
    <div class="results-panel">
      <div class="results-header">
        <h3>${type === 'text' ? '📝' : type === 'url' ? '🔗' : '🖼️'} ${getTranslation('result_title')}</h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.results-panel').remove()">✕</button>
      </div>
      <div class="results-body">
        ${type === 'url' && data.title ? `
          <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: var(--radius-sm);">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${escapeHtml(data.title)}</div>
            <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener" style="font-size: 0.85rem; color: var(--accent-primary);">${escapeHtml(data.url)}</a>
          </div>
        ` : ''}
        <div class="score-gauge">
          <div class="gauge-ring">
            <svg viewBox="0 0 100 100">
              <circle class="gauge-bg" cx="50" cy="50" r="46"/>
              <circle class="gauge-fill" cx="50" cy="50" r="46"
                stroke="${scoreColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <div class="gauge-text" style="color: ${scoreColor};">${score}%</div>
          </div>
          <div class="gauge-label">
            <div class="verdict">${verdictEmoji} ${verdict}</div>
            <div class="verdict-desc">${getVerdictDescription(score)}</div>
          </div>
        </div>

        <div class="breakdown">
          <div class="breakdown-item">
            <span class="breakdown-label">BERT Model</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${bertScore}%; background: var(--accent-primary);"></div>
            </div>
            <span class="breakdown-value" style="color: var(--accent-primary);">${bertScore}%</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">LLM Analysis</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${llmScore}%; background: var(--accent-secondary);"></div>
            </div>
            <span class="breakdown-value" style="color: var(--accent-secondary);">${llmScore}%</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Web Search</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${webScore}%; background: var(--accent-tertiary);"></div>
            </div>
            <span class="breakdown-value" style="color: var(--accent-tertiary);">${webScore}%</span>
          </div>
        </div>

        ${reasoning ? `
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">💡 ${getTranslation('result_ai_analysis')}</h4>
            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.7;">${escapeHtml(reasoning)}</p>
          </div>
        ` : ''}

        ${data.explanations && data.explanations.length > 0 ? `
          <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">💬 AI Explanation</h4>
            <ul style="margin: 0; padding-left: 1.2rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">
              ${data.explanations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${data.sources && data.sources.length > 0 ? `
          <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">🔗 ${getTranslation('result_sources')}</h4>
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              ${data.sources.slice(0, 5).map(s => `
                <a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener"
                   style="font-size: 0.85rem; color: var(--accent-primary); display: flex; align-items: center; gap: 0.35rem;">
                  🔗 ${escapeHtml(s.title || s.url || 'Source')}
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function getVerdictDescription(score) {
  if (score >= 70) return getTranslation('verdict_desc_high');
  if (score >= 50) return getTranslation('verdict_desc_medium');
  if (score >= 30) return getTranslation('verdict_desc_mixed');
  if (score >= 15) return getTranslation('verdict_desc_warning');
  return getTranslation('verdict_desc_fake');
}

// --- Report Content ---
async function reportContent(type, dataStr) {
  const data = JSON.parse(dataStr);
  const content = type === 'url' ? data.url : (data.extracted_text || data.title || 'Content verification result');

  const reason = prompt('Why are you reporting this content? (e.g., misleading, harmful, spam)');
  if (!reason) return;

  const category = prompt('Category: (misinformation, spam, harmful, other)', 'misinformation');
  if (!category) return;

  const sourceUrl = type === 'url' ? data.url : '';

  try {
    const token = getToken();
    if (!token) {
      showToast('Please log in to report content.', 'warning');
      return;
    }

    const response = await fetch(`${BASE_API_URL}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: content,
        reason: reason,
        category: category,
        source_url: sourceUrl
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to submit report');
    }

    const result = await response.json();
    showToast('Report submitted successfully!', 'success');
  } catch (error) {
    console.error('Report error:', error);
    showToast('Failed to submit report.', 'error');
  }
}

// --- Provide Feedback ---
async function provideFeedback(type, score, verdict) {
  const agreed = confirm(`You received a ${verdict} verdict (${score}% score). Did you agree with this assessment?`);
  const comment = prompt('Optional comment:');

  try {
    const token = getToken();
    if (!token) {
      showToast('Please log in to provide feedback.', 'warning');
      return;
    }

    // Find the verification ID - this is a simplification, in reality you'd need to track IDs
    const verifications = JSON.parse(localStorage.getItem('verifyit-verification-history') || '[]');
    const recentVerification = verifications.find(v => v.score === score && v.verdict === verdict);
    if (!recentVerification) {
      showToast('Could not find verification to provide feedback for.', 'warning');
      return;
    }

    const response = await fetch(`${BASE_API_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        verification_id: recentVerification.id || 1, // Fallback
        agreed: agreed,
        comment: comment || ''
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to submit feedback');
    }

    showToast('Feedback submitted successfully!', 'success');
  } catch (error) {
    console.error('Feedback error:', error);
    showToast('Failed to submit feedback.', 'error');
  }
}

// --- Utility ---
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clearText() {
  const textarea = document.getElementById('textInput');
  const counter = document.getElementById('charCount');
  const results = document.getElementById('textResults');
  if (textarea) textarea.value = '';
  if (counter) counter.textContent = '0';
  if (results) results.innerHTML = '';
}

// --- FAQ Toggle ---
function toggleFaq(button) {
  const item = button.closest('.faq-item');
  item.classList.toggle('open');
}

// --- Trending News ---
async function loadTrendingNews(category = 'all') {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-overlay" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
      <div class="loading-text">Loading trending news...</div>
    </div>
  `;

  try {
    // Trending news should be Nigeria-specific, but verification analysis is worldwide.
    const baseTrending = `${BASE_API_URL}/trending-news?region=nigeria`;
    const url = category === 'all'
      ? baseTrending
      : `${baseTrending}&category=${encodeURIComponent(category)}`;

    const token = getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (response.status === 401 && token) {
      removeToken();
      removeCurrentUser();
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📰</div>
          <p>No trending news found for this category.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = articles.map(article => `
      <a href="${escapeHtml(article.link || '#')}" target="_blank" rel="noopener" class="news-card" style="text-decoration: none; color: inherit;">
        <div class="news-category">📌 ${escapeHtml(article.category || category)}</div>
        <div class="news-title">${escapeHtml(article.title)}</div>
        <div class="news-source">
          <span>📡</span>
          ${escapeHtml(article.source || 'Unknown Source')}
          ${article.published ? ` · ${new Date(article.published).toLocaleDateString()}` : ''}
        </div>
      </a>
    `).join('');

  } catch (error) {
    console.error('Failed to load trending news:', error);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">⚠️</div>
        <p>Could not load trending news. Please ensure the backend server is running.</p>
      </div>
    `;
  }
}

function initCategoryFilters() {
  const filters = document.getElementById('categoryFilters');
  if (!filters) return;

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;

    filters.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    loadTrendingNews(btn.dataset.category);
  });
}

// --- Fade-in Animation on Scroll ---
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// --- Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initMobileMenu();
  initCharCount();
  initImageUpload();
  initDeepfakeUpload();
  initCategoryFilters();
  initScrollAnimations();
  initLanguageSelector();
  renderHistory();

  // Theme dot clicks
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => setTheme(dot.dataset.theme));
  });

  // History button
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) historyBtn.addEventListener('click', toggleHistory);

  // Quiz button fallback binding
  const quizToggleBtn = document.getElementById('quizToggleBtn');
  if (quizToggleBtn) quizToggleBtn.addEventListener('click', (event) => {
    event.preventDefault();
    toggleQuiz();
  });

  // History backdrop click
  const backdrop = document.getElementById('historyBackdrop');
  if (backdrop) backdrop.addEventListener('click', toggleHistory);

  // Load trending news if on home page
  if (document.getElementById('newsGrid')) {
    loadTrendingNews();
  }
});
// ============================================================
// USER FEEDBACK
// ============================================================

let selectedFeedbackRating = 0;

function openFeedback(open = true) {
  const backdrop = document.getElementById('feedbackModalBackdrop');

  if (!backdrop) return;

  if (open) {
    const user = typeof getCurrentUser === 'function'
      ? getCurrentUser()
      : null;

    if (user) {
      const nameInput = document.getElementById('feedbackName');
      const emailInput = document.getElementById('feedbackEmail');

      if (nameInput && user.username) {
        nameInput.value = user.username;
      }

      if (emailInput && user.email) {
        emailInput.value = user.email;
      }
    }

    backdrop.classList.remove('hidden');
  } else {
    backdrop.classList.add('hidden');
  }
}


function setFeedbackRating(rating) {
  selectedFeedbackRating = rating;

  const ratingInput = document.getElementById('feedbackRating');

  if (ratingInput) {
    ratingInput.value = rating;
  }

  document.querySelectorAll('.feedback-rating button').forEach(button => {
    const buttonRating = Number(button.dataset.rating);

    button.classList.toggle(
      'selected',
      buttonRating <= rating
    );
  });
}


function submitFeedback(event) {
  event.preventDefault();

  const name = document.getElementById('feedbackName')?.value.trim();
  const email = document.getElementById('feedbackEmail')?.value.trim();
  const message = document.getElementById('feedbackMessage')?.value.trim();

  if (!name || !message) {
    showToast(
      getTranslation('feedback_required') ||
      'Please provide your name and feedback.',
      'error'
    );
    return;
  }

  if (selectedFeedbackRating === 0) {
    showToast(
      getTranslation('feedback_rating_required') ||
      'Please rate your experience.',
      'warning'
    );
    return;
  }

  const feedback = {
    id: Date.now(),
    name: name,
    email: email,
    rating: selectedFeedbackRating,
    message: message,
    date: new Date().toISOString()
  };

  const existingFeedback = JSON.parse(
    localStorage.getItem('iconfam-feedback') || '[]'
  );

  existingFeedback.unshift(feedback);

  localStorage.setItem(
    'iconfam-feedback',
    JSON.stringify(existingFeedback)
  );

  document.getElementById('feedbackForm').reset();

  selectedFeedbackRating = 0;

  document.querySelectorAll('.feedback-rating button').forEach(button => {
    button.classList.remove('selected');
  });

  openFeedback(false);

  showToast(
    getTranslation('feedback_success') ||
    'Thank you! Your feedback has been submitted.',
    'success'
  );
}


function clearFeedback() {
  const form = document.getElementById('feedbackForm');

  if (form) {
    form.reset();
  }

  selectedFeedbackRating = 0;

  document.querySelectorAll('.feedback-rating button').forEach(button => {
    button.classList.remove('selected');
  });

  const counter = document.getElementById('feedbackCharCount');

  if (counter) {
    counter.textContent = '0';
  }
}


function initFeedback() {
  const message = document.getElementById('feedbackMessage');
  const counter = document.getElementById('feedbackCharCount');

  if (!message || !counter) return;

  message.addEventListener('input', () => {
    counter.textContent = message.value.length;
  });
}