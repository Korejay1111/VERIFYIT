# VerifyIt Authentication Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Server

```bash
python -m uvicorn app:app --reload
```

The server will start at `http://127.0.0.1:8000`

### 3. Access the Application

**First Time Users:**

- Go to `http://localhost:3000/register.html` (or open `register.html` in your browser)
- Create a new account with:
  - Email: your@email.com
  - Username: yourname
  - Password: at least 8 characters

**Returning Users:**

- Go to `http://localhost:3000/login.html` (or open `login.html` in your browser)
- Enter your username and password
- Click "Login"

### 4. Verify News

After logging in, you can:

- ✅ **Verify Text**: Paste articles or claims to check credibility
- 🖼️ **Verify Images**: Upload screenshots to analyze
- 📰 **View Trending**: See trending news from verified sources
- 📋 **Check History**: View your verification history

## New Pages

| Page     | URL             | Purpose                         |
| -------- | --------------- | ------------------------------- |
| Landing  | `index.html`    | Auto-redirects to login or home |
| Login    | `login.html`    | User login                      |
| Register | `register.html` | New account creation            |
| Home     | `home.html`     | Main verification interface     |
| About    | `about.html`    | About VerifyIt                  |

## Key Features Added

### ✅ Authentication

- Secure JWT token-based authentication
- Bcrypt password hashing
- 24-hour token expiration
- Automatic session management

### ✅ User Management

- User profile in navbar
- Logout button
- Secure session handling
- Automatic redirect for unauthorized access

### ✅ Protected Endpoints

- All verification endpoints require login
- Trending news requires authentication
- Real-time token validation

## Security Highlights

🔐 **Password Security**

- Minimum 8 characters required
- Bcrypt hashing (industry standard)
- No passwords stored in plain text

🔐 **Token Security**

- JWT tokens with HS256 algorithm
- 24-hour expiration
- Automatic refresh on page reload
- Bearer token in headers

🔐 **Session Security**

- Automatic logout on token expiration
- Secure token storage in localStorage
- CORS protection enabled

## Browser Tools

You can inspect authentication in your browser:

1. **Check Stored Token**
   - Open DevTools (F12)
   - Go to Application → LocalStorage

- Look for `verifyit-token` and `verifyit-user`

2. **View API Requests**
   - Open DevTools → Network tab
   - Look for Authorization header in requests
   - Should show: `Authorization: Bearer {token}`

## Troubleshooting

### Issue: "Not authenticated" appears

**Solution:**

- Clear localStorage: `localStorage.clear()`
- Log out and log back in
- Refresh the page

### Issue: Backend connection error

**Solution:**

- Verify the server is running on `http://127.0.0.1:8000`
- Check terminal for error messages
- Ensure all dependencies are installed: `pip install -r requirements.txt`

### Issue: "Password too weak"

**Solution:**

- Use at least 8 characters
- Mix of uppercase, lowercase, numbers, and symbols recommended

### Issue: CORS errors in console

**Solution:**

- Make sure API_BASE_URL matches your server (http://127.0.0.1:8000)
- Check that CORS middleware is enabled in app.py

## File Reference

### Backend (Python)

- `app.py` - FastAPI server with auth endpoints

### Frontend (HTML/JavaScript)

- `index.html` - Landing page (redirects to login/home)
- `login.html` - Login page
- `register.html` - Registration page
- `home.html` - Main application
- `auth.js` - Authentication utilities
- `scripts.js` - API calls (updated for auth)
- `styles.css` - Styling

### Data

- `users.json` - User database (auto-created)
- `requirements.txt` - Python dependencies

## API Examples

### Register

```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "user",
    "password": "pass123456"
  }'
```

### Login

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user",
    "password": "pass123456"
  }'
```

### Verify Text (with token)

```bash
curl -X POST http://127.0.0.1:8000/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "text": "Your article text here"
  }'
```

## Next Steps

1. ✅ Test registration with a new account
2. ✅ Test login with the created account
3. ✅ Try verifying some text/images
4. ✅ Check your verification history
5. ✅ Test logout functionality

## Support & Issues

- Check browser console (F12) for JavaScript errors
- Check server terminal for backend errors
- Review `AUTH_README.md` for detailed documentation
- Verify all files are in the correct location

---

**Ready to use?** Start with registration at `register.html` 🚀
