# InsightFlow — final website (frontend + backend integrated)

```
final_website/
├── backend/    FastAPI + PostgreSQL  (also serves the website)
└── frontend/   your original pages, same design
```

## Run it

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Make sure PostgreSQL is running and the `business_intelligence` database from `.env` exists.
Tables are created automatically — **no database changes / migrations needed.**

Open **http://127.0.0.1:8000** — the backend serves the website, so there are no CORS problems.
API docs: http://127.0.0.1:8000/docs

## The flow

| # | Who | What happens |
|---|-----|--------------|
| 1 | CFO | Opens landing page → **Sign up** → fills name, company, email, license no., dates, uploads license → account is created as *pending* |
| 2 | Admin | Signs in at the normal **Login** (default `admin@insightflow.com` / `admin123`) → lands on **CFO approvals** → sees the new CFO instantly (live notification) → **View license** → **Approve** or **Reject** |
| 3 | CFO | Receives an email ("your account is approved" + sign-in link) → signs in → dashboard |
| 4 | CFO | Dashboard → **+ Invite manager** → name, company email, region |
| 5 | Manager | Receives an email at the company address with a 6-digit code + a link |
| 6 | Manager | Clicks the link → **Verify your invitation** card → pastes the code, sets a password → straight into the dashboard |
| 7 | Anyone, next time | Landing page → **Login** → dashboard. (Signed in already? The button says **Open app**.) |

Rules enforced by the server: manager email must be on the CFO's company domain; a CFO can't log in until approved;
the code expires after 15 minutes; a new invite cancels the previous code; admins/CFOs/managers only see their own pages.

## Email (Gmail)

By default `SMTP_HOST` is empty = **dev mode**: emails are printed in the server console and the invite
screen shows the code, so you can test everything without a mail account.

To send real emails, edit `backend/.env`:

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="yourname@gmail.com"
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"     # a Google *App password*, not your normal password
SMTP_FROM="yourname@gmail.com"
FRONTEND_URL="http://127.0.0.1:8000"    # change to your real domain when you deploy
```
(Google Account → Security → 2-Step Verification on → App passwords → create one.)
Once SMTP is configured the code is **never** returned to the browser — only emailed.

## Endpoints used by the frontend

`POST /api/auth/cfo/signup` · `POST /api/auth/login` · `GET /api/users/me`
`GET /api/auth/admin/cfos` · `GET /api/auth/admin/download-license/{id}` · `POST /api/auth/admin/approve-license` · `WS /api/auth/admin/ws?token=`
`POST /api/auth/cfo/invite-manager` · `POST /api/auth/manager/signup`
