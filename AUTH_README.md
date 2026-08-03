# VerifyIt Authentication System

## Overview

VerifyIt now includes a complete JWT-based authentication system with user registration and login functionality.

## Features

### Authentication

- **User Registration**: Create new accounts with email, username, and password
- **User Login**: Secure login with JWT tokens
- **Session Management**: 24-hour token expiration with automatic renewal
- **Password Security**: Bcrypt hashing for all passwords
- **Protected Endpoints**: All verification endpoints require authentication

### User Management

- User profile display in navbar
- Logout functionality
- Session persistence across page reloads
- Automatic redirect to login for unauthenticated access

## Getting Started

### Installation

1. Install new dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

```bash
python -m uvicorn app:app --reload
```

The server will run on `http://127.0.0.1:8000`

### Using the Application

#### Registration

1. Navigate to `register.html`
2. Fill in email, username, and password
3. Password must be at least 8 characters
4. Confirm password and click "Create Account"
5. You'll be automatically logged in and redirected to the home page

#### Login

1. Navigate to `login.html` or `index.html`
2. Enter your username and password
3. Click "Login"
4. You'll be redirected to the home page

#### Using Verified Features

1. All verification features (text, image, trending news) now require authentication
2. Your JWT token is automatically included in API requests
3. If your token expires, you'll be redirected to login

## API Endpoints

### Authentication Endpoints

#### Register

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "email": "user@example.com",
    "username": "username"
  }
}
```

#### Login

```
POST /auth/login
Content-Type: application/json

{
  "username": "username",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "email": "user@example.com",
    "username": "username"
  }
}
```

#### Get Current User

```
GET /auth/me
Authorization: Bearer {token}

Response:
{
  "email": "user@example.com",
  "username": "username"
}
```

#### Logout

```
POST /auth/logout
Authorization: Bearer {token}

Response:
{
  "message": "Logged out successfully"
}
```

### Protected Verification Endpoints

All these endpoints now require a valid JWT token in the Authorization header:

```
Authorization: Bearer {access_token}
```

- `POST /check` - Verify text
- `POST /check-image` - Verify images
- `POST /extract-text` - Extract text from images
- `GET /trending-news` - Get trending news

## File Structure

### New Files

- `login.html` - User login page
- `register.html` - User registration page
- `auth.js` - Authentication utilities and token management

### Modified Files

- `app.py` - Added authentication endpoints and protected verification endpoints
- `index.html` - Updated to redirect to login if not authenticated
- `home.html` - Added user profile dropdown in navbar
- `scripts.js` - Updated API calls to include authentication tokens
- `requirements.txt` - Added authentication dependencies

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt (not stored in plain text)
2. **JWT Tokens**: Secure token-based authentication with HS256 algorithm
3. **Token Expiration**: Tokens expire after 24 hours
4. **CORS Protection**: CORS middleware is configured
5. **HTTPBearer Security**: Uses FastAPI's HTTPBearer for secure token handling
6. **Session Security**: Tokens are stored in localStorage and automatically included in API requests

## Environment Variables

You can set a custom SECRET_KEY for JWT encoding:

```bash
export SECRET_KEY="your-secret-key-here"
```

If not set, a random key is generated on each server start (recommended for production, set a fixed key).

## Troubleshooting

### "Not authenticated" Error

- Your token may have expired. Please login again.
- Make sure you're logged in before accessing verification features.

### "Invalid token" Error

- Your token is corrupted or invalid. Please login again.
- Clear your browser's localStorage and login fresh.

### "Username already exists"

- Try a different username during registration.

### "Email already registered"

- The email is already associated with an account. Try logging in instead.

### Backend Connection Error

- Make sure the FastAPI server is running on `http://127.0.0.1:8000`
- Check that all required dependencies are installed

## Future Enhancements

Potential improvements for the authentication system:

- Email verification for new accounts
- Password reset functionality
- Two-factor authentication (2FA)
- OAuth integration (Google, GitHub)
- User preferences and settings
- Verification history tied to user accounts
- Rate limiting per user
- API key generation for programmatic access

## Database

Currently, user data is stored in a simple JSON file (`users.json`) for ease of development. For production, consider upgrading to:

- SQLite
- PostgreSQL
- MongoDB

The structure is designed to be easily migrated to any database backend.

## Support

For issues or questions about the authentication system, please check:

1. Browser console for error messages
2. Server logs for backend errors
3. Verify SECRET_KEY is properly configured
4. Ensure all dependencies are installed
