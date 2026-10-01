"""Outgoing email for InsightFlow.

send_email() is now FULLY ASYNC using aiosmtplib.
It connects directly to Gmail servers securely without blocking the event loop.
"""
import html
from email.message import EmailMessage
from urllib.parse import quote
import aiosmtplib  # Nayi async library

from app.core.config import settings

async def send_email(to_email: str, subject: str, text: str, html_body: str | None = None) -> bool:
    if not settings.smtp_enabled:
        print(
            "\n" + "=" * 70
            + f"\n[DEV EMAIL - SMTP not configured, nothing was actually sent]"
            + f"\nTo: {to_email}\nSubject: {subject}\n\n{text}\n"
            + "=" * 70 + "\n"
        )
        return True

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"InsightFlow <{settings.SMTP_FROM or settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        # Proper Gmail Async Setup
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,  # Secure TLS connection for port 587
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
        )
        return True
    except Exception as exc:  # never crash a request because mail failed
        print(f"[EMAIL ERROR] could not send to {to_email}: {exc!r}")
        return False


# ---------------------------------------------------------------- templates

_WINE = "#4A0E17"

def _wrap(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#2A090E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:18px;border:1px solid #eadcd8">
<tr><td style="padding:28px 32px 8px;font:600 24px Georgia,serif;color:{_WINE}">Insight<span style="color:#9A2C3E">Flow</span></td></tr>
<tr><td style="padding:8px 32px 0;font-size:20px;font-weight:700">{html.escape(title)}</td></tr>
<tr><td style="padding:12px 32px 32px;font-size:15px;line-height:1.6">{body_html}</td></tr>
</table></td></tr></table></body></html>"""

def _button(url: str, label: str) -> str:
    return (f'<p style="margin:22px 0"><a href="{html.escape(url)}" style="background:{_WINE};color:#fff;'
            f'text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:700;display:inline-block">'
            f'{html.escape(label)}</a></p>')

def cfo_approved_email(name: str, login_url: str) -> tuple[str, str, str]:
    subject = "Your InsightFlow account has been approved"
    text = (f"Hi {name},\n\nGood news - your license was verified and your InsightFlow account is approved.\n"
            f"You can now sign in here:\n{login_url}\n\n- The InsightFlow team")
    body = (f"<p>Hi {html.escape(name)},</p><p>Good news &mdash; your license was verified and your InsightFlow "
            f"account is <b>approved</b>. You can now sign in and open your dashboard.</p>"
            + _button(login_url, "Sign in to InsightFlow"))
    return subject, text, _wrap("You're approved", body)

def cfo_rejected_email(name: str) -> tuple[str, str, str]:
    subject = "Your InsightFlow registration could not be approved"
    text = (f"Hi {name},\n\nWe were unable to verify the license you submitted, so your registration was not "
            f"approved. You are welcome to register again with a valid license document.\n\n- The InsightFlow team")
    body = (f"<p>Hi {html.escape(name)},</p><p>We were unable to verify the license you submitted, so your "
            f"registration was <b>not approved</b>. You are welcome to register again with a valid license document.</p>")
    return subject, text, _wrap("Registration not approved", body)

def manager_invite_email(name: str, cfo_name: str, company: str, region: str, otp: str,
                         email: str, minutes: int) -> tuple[str, str, str]:
    verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/verify.html?email={quote(email)}"
    subject = f"{cfo_name or 'Your CFO'} invited you to InsightFlow - your verification code"
    text = (f"Hi {name},\n\n{cfo_name or 'Your CFO'} has invited you to join {company or 'their company'} on "
            f"InsightFlow as the regional manager for {region}.\n\n"
            f"Your verification code (OTP): {otp}\n"
            f"It expires in {minutes} minutes.\n\n"
            f"Open this link, paste the code and set your password:\n{verify_url}\n\n"
            f"If you weren't expecting this, you can ignore this email.")
    body = (f"<p>Hi {html.escape(name)},</p>"
            f"<p><b>{html.escape(cfo_name or 'Your CFO')}</b> has invited you to join "
            f"<b>{html.escape(company or 'their company')}</b> on InsightFlow as the regional manager for "
            f"<b>{html.escape(region)}</b>.</p>"
            f"<p style='margin:20px 0 6px'>Your verification code:</p>"
            f"<p style='font:700 34px Consolas,monospace;letter-spacing:8px;margin:0;color:{_WINE}'>{html.escape(otp)}</p>"
            f"<p style='color:#6E5358;font-size:13px'>Expires in {minutes} minutes.</p>"
            + _button(verify_url, "Enter code and open dashboard")
            + "<p style='color:#6E5358;font-size:13px'>If you weren't expecting this, you can ignore this email.</p>")
    return subject, text, _wrap("You're invited", body)