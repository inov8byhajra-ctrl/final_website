"""Outgoing email for InsightFlow.

send_email() is now FULLY ASYNC using aiosmtplib.
It connects directly to Gmail servers securely without blocking the event loop.
"""
import html
from email.message import EmailMessage
from urllib.parse import quote
import aiosmtplib

from app.core.config import settings

# InsightFlow Brand Colors
_WINE = "#4A0E17"
_WINE_LIGHT = "#9A2C3E"
_BACKGROUND = "#f4f6f8"

async def send_email(to_email: str, subject: str, text: str, html_body: str | None = None) -> bool:
    """Sends an email asynchronously via Gmail SMTP."""
    if not getattr(settings, "SMTP_ENABLED", getattr(settings, "smtp_enabled", False)):
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
    except Exception as exc:  # Never crash a request because mail failed
        print(f"[EMAIL ERROR] could not send to {to_email}: {exc!r}")
        return False


# ---------------------------------------------------------------- templates

def _wrap(title: str, body_html: str) -> str:
    """Wraps the email content in a highly professional, responsive HTML template."""
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: {_BACKGROUND}; }}
        .wrapper {{ width: 100%; background-color: {_BACKGROUND}; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }}
        
        /* Header */
        .header {{ background-color: #ffffff; padding: 25px 30px; text-align: center; border-bottom: 4px solid {_WINE}; }}
        .header h1 {{ margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: 600; color: {_WINE}; }}
        .header h1 span {{ color: {_WINE_LIGHT}; }}
        
        /* Body */
        .content {{ padding: 35px 30px; }}
        .content h2 {{ margin-top: 0; font-size: 22px; color: #111111; }}
        .content p {{ margin: 0 0 15px 0; font-size: 16px; }}
        
        /* Footer */
        .footer {{ background-color: #fafafa; padding: 25px 30px; text-align: center; color: #888888; font-size: 13px; border-top: 1px solid #eeeeee; }}
        .footer p {{ margin: 0 0 10px 0; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <!-- HEADER -->
            <div class="header">
                <h1>Insight<span>Flow</span></h1>
            </div>

            <!-- BODY -->
            <div class="content">
                <h2>{html.escape(title)}</h2>
                {body_html}
                
                <p style="margin-top: 30px;">
                    Best regards,<br>
                    <strong>The InsightFlow Team</strong>
                </p>
            </div>

            <!-- FOOTER -->
            <div class="footer">
                <p>&copy; 2026 InsightFlow. All rights reserved.</p>
                <p>If you have any questions, please reply directly to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>"""

def _button(url: str, label: str) -> str:
    """Generates a professional call-to-action button."""
    return (f'<div style="text-align: center; margin: 30px 0;">'
            f'<a href="{html.escape(url)}" style="background-color: {_WINE}; color: #ffffff; '
            f'text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; '
            f'font-size: 16px; display: inline-block;">{html.escape(label)}</a>'
            f'</div>')


# ---------------------------------------------------------------- email generators

def cfo_approved_email(name: str, login_url: str) -> tuple[str, str, str]:
    subject = "Your InsightFlow account has been approved"
    
    text = (f"Hi {name},\n\nGood news - your license was verified and your InsightFlow account is approved.\n"
            f"You can now sign in here:\n{login_url}\n\n- The InsightFlow team")
            
    body = (f"<p>Hi {html.escape(name)},</p>"
            f"<p>Good news &mdash; your license was verified and your InsightFlow "
            f"account is <b>approved</b>. You can now sign in and open your dashboard.</p>"
            + _button(login_url, "Sign in to InsightFlow"))
            
    return subject, text, _wrap("Account Approved", body)

def cfo_rejected_email(name: str) -> tuple[str, str, str]:
    """Generates an email notifying the CFO that their registration was rejected."""
    subject = "Your InsightFlow registration could not be approved"
    
    text = (f"Hi {name},\n\nWe were unable to verify the license you submitted, so your registration was not "
            f"approved. You are welcome to register again with a valid license document.\n\n- The InsightFlow team")
            
    body = (f"<p>Hi {html.escape(name)},</p>"
            f"<p>We were unable to verify the license you submitted, so your "
            f"registration was <b>not approved</b>. You are welcome to register again with a valid license document.</p>")
            
    return subject, text, _wrap("Registration Not Approved", body)

def manager_invite_email(name: str, cfo_name: str, company: str, region: str, otp: str, email: str, minutes: int) -> tuple[str, str, str]:
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
            f"<p style='margin:25px 0 10px'>Your verification code:</p>"
            f"<p style='font:700 36px Consolas,monospace;letter-spacing:10px;margin:0;color:{_WINE};text-align:center;background:#f9f9f9;padding:15px;border-radius:8px;border:1px dashed #ccc;'>{html.escape(otp)}</p>"
            f"<p style='color:#888888;font-size:14px;text-align:center;margin-top:10px'>Expires in {minutes} minutes.</p>"
            + _button(verify_url, "Enter Code & Open Dashboard")
            + "<p style='color:#888888;font-size:13px;margin-top:20px'>If you weren't expecting this, you can safely ignore this email.</p>")
            
    return subject, text, _wrap("You're Invited", body)

def admin_new_cfo_registration_email(cfo_name: str, company: str, dashboard_url: str) -> tuple[str, str, str]:
    """Generates an email notifying the admin of a new CFO registration pending review."""
    subject = f"Action Required: New CFO Registration - {company}"
    
    text = (f"Hi Admin,\n\n"
            f"A new CFO, {cfo_name}, from {company} has just registered on InsightFlow.\n"
            f"Please log in to review their license documentation and approve or reject their account.\n\n"
            f"Open Dashboard: {dashboard_url}\n\n"
            f"- The InsightFlow System")
            
    body = (f"<p>Hi Admin,</p>"
            f"<p>A new CFO, <b>{html.escape(cfo_name)}</b>, representing <b>{html.escape(company)}</b> has just registered on InsightFlow.</p>"
            f"<p>Please log in to the admin panel to review their submitted license documentation and process their account approval.</p>"
            + _button(dashboard_url, "Review in Dashboard"))
            
    return subject, text, _wrap("New CFO Registration", body)