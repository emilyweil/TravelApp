# Curiosity Map — React App

## Project Structure
```
curiosity-map/
├── index.html
├── vite.config.js
├── package.json
├── .env                    ← API keys (safe ones only)
├── claude-proxy.php        ← Upload to server (contains Claude key)
├── supabase-setup.sql      ← Run once in Supabase dashboard
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/supabase.js
    └── components/
        ├── Auth.jsx
        ├── Header.jsx
        ├── MapView.jsx
        ├── Journal.jsx
        └── ShareGuide.jsx
```

## Setup Steps

### 1. Supabase Database
- Go to https://supabase.com/dashboard → your project → SQL Editor
- Paste and run the contents of `supabase-setup.sql`
- This creates the `pins` table with Row Level Security enabled

### 2. Supabase Auth
- In Supabase dashboard → Authentication → Providers
- Email/Password is enabled by default ✓
- Optionally set Site URL to https://www.studioemilyweil.com

### 3. Install & Build
```bash
npm install
npm run build
```
This produces a `dist/` folder.

### 4. Deploy to Server
Upload to your web server:
- Everything inside `dist/` → your web root (e.g. public_html/)
- `claude-proxy.php` → same folder as index.html

### 5. Server Config
If using Apache, add a `.htaccess` to handle React routing:
```
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Security Notes

- **Claude API key**: Lives ONLY in `claude-proxy.php` on the server. Never in browser JS.
- **Supabase anon key**: Safe to expose (by design). RLS policies ensure users only access their own data.
- **Google Maps key**: Restrict it in Google Cloud Console to your domain (APIs & Services → Credentials).
- **claude-proxy.php**: Only accepts requests from studioemilyweil.com (CORS check built in).

## Local Development
```bash
npm run dev
```
For local dev, Claude AI won't work (proxy is server-side). All other features work locally.
