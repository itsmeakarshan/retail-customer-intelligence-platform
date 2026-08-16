"""
Brevo Transactional Email Service
---------------------------------
BUSINESS & SAFETY GUARANTEE:
1. All real test emails are strictly delivered to DEMO_EMAIL_ADDRESS (akarshanrasyal4@gmail.com).
2. Synthetic customer emails (e.g. customer_13085@example.com) are NEVER sent real emails.
3. BREVO_API_KEY remains strictly server-side and is never exposed to React or frontend code.
4. HONEST RESPONSES:
   - Not Configured -> Returns status 'Email Service Not Configured'
   - Brevo API Accepted -> Returns status 'Accepted by Brevo' with Brevo Message ID
   - Brevo API Rejected -> Returns status 'Failed' with exact Brevo error message
"""

import os
import json
import sqlite3
import base64
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
DB_PATH = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")

class EmailService:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_api_key(self) -> str:
        return os.getenv("BREVO_API_KEY", "").strip()

    def get_demo_recipient(self) -> str:
        return os.getenv("DEMO_EMAIL_ADDRESS", "akarshanrasyal4@gmail.com").strip() or "akarshanrasyal4@gmail.com"

    def is_configured(self) -> bool:
        return bool(self.get_api_key())

    def get_status(self) -> Dict[str, Any]:
        """
        Backend status check for Brevo configuration.
        """
        key = self.get_api_key()
        demo_email = self.get_demo_recipient()
        configured = bool(key)

        masked_key = f"{key[:8]}...{key[-4:]}" if len(key) >= 12 else (key if key else None)
        
        if configured:
            status_text = "Configured"
            msg = f"Brevo Email API is configured. Real test emails will be delivered to {demo_email}."
        else:
            status_text = "Email Service Not Configured"
            msg = "Email service not configured. Add BREVO_API_KEY to .env to enable real test email delivery."

        return {
            "configured": configured,
            "demo_recipient": demo_email,
            "api_key_masked": masked_key,
            "status": status_text,
            "message": msg
        }

    def _log_audit_entry(
        self,
        campaign_id: Optional[int],
        campaign_name: str,
        target_group: str,
        customer_count: int,
        subject: str,
        message_text: str,
        delivery_mode: str,
        recipient: str,
        provider_message_id: Optional[str],
        status_label: str
    ) -> int:
        now_iso = datetime.now().isoformat()
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            INSERT INTO campaign_audit_log (
                campaign_id, created_at, campaign_name, target_group,
                customer_count, subject, message, delivery_mode, recipient,
                provider_message_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            campaign_id,
            now_iso,
            campaign_name,
            target_group,
            customer_count,
            subject,
            message_text,
            delivery_mode,
            recipient,
            provider_message_id,
            status_label
        ))
        audit_id = c.lastrowid
        conn.commit()
        conn.close()
        return audit_id

    def send_inventory_report_email(
        self,
        excel_bytes: bytes,
        filename: str = "Retail_Inventory_Replenishment_Report.xlsx",
        recipient_email: Optional[str] = None,
        subject: str = "Retail Inventory Replenishment Report",
        message_text: str = "Please find attached the latest inventory replenishment report, including forecast demand, stock requirements, reorder points and recommended order quantities."
    ) -> Dict[str, Any]:
        """
        Sends an inventory replenishment report with the generated Excel workbook attached via Brevo API v3.
        """
        api_key = self.get_api_key()
        demo_recipient = self.get_demo_recipient()
        target_recipient = (recipient_email.strip() if recipient_email and recipient_email.strip() else demo_recipient)
        now_iso = datetime.now().isoformat()
        base64_excel = base64.b64encode(excel_bytes).decode('utf-8')

        if not api_key:
            audit_id = self._log_audit_entry(
                campaign_id=None,
                campaign_name="Inventory Replenishment Report",
                target_group="Inventory Management",
                customer_count=1,
                subject=subject,
                message_text=message_text,
                delivery_mode="DEMO EMAIL",
                recipient=target_recipient,
                provider_message_id=None,
                status_label="Email Service Not Configured"
            )
            return {
                "success": False,
                "audit_id": audit_id,
                "demo_mode": True,
                "provider_configured": False,
                "recipient": target_recipient,
                "delivery_mode": "DEMO EMAIL",
                "status": "Email Service Not Configured",
                "timestamp": now_iso,
                "message_id": None,
                "message": "Email service not configured. Add BREVO_API_KEY to .env to enable live delivery of Excel report attachments."
            }

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1E293B; border-radius: 16px; padding: 32px; border: 1px solid #334155; }}
            .header {{ border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }}
            .brand {{ font-size: 20px; font-weight: 800; color: #818CF8; margin: 0; }}
            .badge {{ background-color: rgba(99, 102, 241, 0.15); color: #818CF8; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; display: inline-block; margin-top: 8px; }}
            .subject {{ font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 16px 0 8px 0; }}
            .body-text {{ font-size: 15px; line-height: 1.6; color: #CBD5E1; margin-bottom: 24px; }}
            .attachment-box {{ background: rgba(99, 102, 241, 0.1); border: 1px solid #6366F1; padding: 16px; border-radius: 10px; margin-bottom: 24px; display: flex; align-items: center; }}
            .footer {{ border-top: 1px solid #334155; padding-top: 20px; margin-top: 32px; font-size: 13px; color: #64748B; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="brand">📦 Retail Customer Intelligence Platform</div>
              <div class="badge">📊 Executive Inventory Report</div>
              <div class="subject">{subject}</div>
            </div>

            <div class="body-text">{message_text}</div>

            <div class="attachment-box">
              <div>
                <strong>📎 Attachment:</strong> {filename} (Structured Excel Workbook with all analysed products)
              </div>
            </div>

            <div class="footer">
              <p>Generated by Retail Customer Intelligence Platform.</p>
              <p>Delivered to: <strong>{target_recipient}</strong></p>
            </div>
          </div>
        </body>
        </html>
        """

        brevo_url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "sender": {
                "name": os.getenv("BREVO_SENDER_NAME", "AK RETAILS").strip() or "AK RETAILS",
                "email": os.getenv("BREVO_SENDER_EMAIL", "akarshanrasyal04@gmail.com").strip() or "akarshanrasyal04@gmail.com"
            },
            "to": [
                {
                    "email": target_recipient,
                    "name": "Inventory Manager"
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "attachment": [
                {
                    "content": base64_excel,
                    "name": filename
                }
            ]
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(brevo_url, headers=headers, json=payload)
                resp_json = resp.json()

            if resp.status_code in [200, 201] and "messageId" in resp_json:
                msg_id = resp_json["messageId"]
                status_label = "Accepted by Brevo"

                audit_id = self._log_audit_entry(
                    campaign_id=None,
                    campaign_name="Inventory Replenishment Report",
                    target_group="Inventory Management",
                    customer_count=1,
                    subject=subject,
                    message_text=message_text,
                    delivery_mode="BREVO API",
                    recipient=target_recipient,
                    provider_message_id=msg_id,
                    status_label=status_label
                )

                return {
                    "success": True,
                    "audit_id": audit_id,
                    "demo_mode": False,
                    "provider_configured": True,
                    "recipient": target_recipient,
                    "delivery_mode": "BREVO API",
                    "status": status_label,
                    "timestamp": now_iso,
                    "message_id": msg_id,
                    "message": f"Inventory report with Excel workbook attachment successfully sent to {target_recipient} (Message ID: {msg_id})."
                }
            else:
                err_detail = "Unknown Brevo API error"
                if isinstance(resp_json, dict):
                    err_detail = resp_json.get("message", json.dumps(resp_json))
                
                status_label = "Failed: Brevo API Error"
                audit_id = self._log_audit_entry(
                    campaign_id=None,
                    campaign_name="Inventory Replenishment Report",
                    target_group="Inventory Management",
                    customer_count=1,
                    subject=subject,
                    message_text=message_text,
                    delivery_mode="BREVO API",
                    recipient=target_recipient,
                    provider_message_id=None,
                    status_label=f"Failed: {err_detail[:80]}"
                )

                return {
                    "success": False,
                    "audit_id": audit_id,
                    "demo_mode": True,
                    "provider_configured": True,
                    "recipient": target_recipient,
                    "delivery_mode": "BREVO API",
                    "status": "Failed",
                    "timestamp": now_iso,
                    "message_id": None,
                    "message": f"Brevo API Rejected Request ({resp.status_code}): {err_detail}"
                }

        except Exception as e:
            audit_id = self._log_audit_entry(
                campaign_id=None,
                campaign_name="Inventory Replenishment Report",
                target_group="Inventory Management",
                customer_count=1,
                subject=subject,
                message_text=message_text,
                delivery_mode="BREVO API",
                recipient=target_recipient,
                provider_message_id=None,
                status_label=f"Failed: {str(e)[:80]}"
            )
            return {
                "success": False,
                "audit_id": audit_id,
                "demo_mode": True,
                "provider_configured": True,
                "recipient": target_recipient,
                "delivery_mode": "BREVO API",
                "status": "Failed",
                "timestamp": now_iso,
                "message_id": None,
                "message": f"HTTP connection to Brevo API failed: {str(e)}"
            }

    def send_test_email(
        self,
        campaign_name: str,
        target_group: str,
        subject: str,
        message_text: str,
        selected_customer_ids: List[str] = None,
        discount_percent: float = 15.0,
        campaign_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Sends a real test transactional email via Brevo REST API v3.
        STRICT CONTROL: Delivery recipient is ALWAYS DEMO_EMAIL_ADDRESS.
        """
        api_key = self.get_api_key()
        demo_recipient = self.get_demo_recipient()
        now_iso = datetime.now().isoformat()
        customer_count = len(selected_customer_ids) if selected_customer_ids else 1
        primary_customer_id = selected_customer_ids[0] if selected_customer_ids else "13085"

        # Check 1: Unconfigured
        if not api_key:
            audit_id = self._log_audit_entry(
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                target_group=target_group,
                customer_count=customer_count,
                subject=subject,
                message_text=message_text,
                delivery_mode="DEMO EMAIL",
                recipient=demo_recipient,
                provider_message_id=None,
                status_label="Email Service Not Configured"
            )
            return {
                "success": False,
                "audit_id": audit_id,
                "demo_mode": True,
                "provider_configured": False,
                "recipient": demo_recipient,
                "delivery_mode": "DEMO EMAIL",
                "status": "Email Service Not Configured",
                "timestamp": now_iso,
                "message_id": None,
                "message": "Email service not configured. Add BREVO_API_KEY to .env to enable real test email delivery."
            }

        # Format HTML email body
        customer_context_line = f"Demonstration Preview generated for Customer #{primary_customer_id} ({customer_count} selected)"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1E293B; border-radius: 16px; padding: 32px; border: 1px solid #334155; }}
            .header {{ border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }}
            .brand {{ font-size: 20px; font-weight: 800; color: #818CF8; margin: 0; }}
            .demo-badge {{ background-color: rgba(99, 102, 241, 0.15); color: #818CF8; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; display: inline-block; margin-top: 8px; }}
            .subject {{ font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 16px 0 8px 0; }}
            .body-text {{ font-size: 16px; line-height: 1.6; color: #CBD5E1; margin-bottom: 24px; white-space: pre-wrap; }}
            .offer-card {{ background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.1)); border: 1px solid #6366F1; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; }}
            .offer-title {{ font-size: 14px; text-transform: uppercase; color: #A5B4FC; font-weight: 700; tracking: 1px; }}
            .offer-discount {{ font-size: 32px; font-weight: 800; color: #FFFFFF; margin: 8px 0; }}
            .cta-btn {{ display: inline-block; background-color: #6366F1; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 16px; margin-top: 12px; }}
            .footer {{ border-top: 1px solid #334155; padding-top: 20px; margin-top: 32px; font-size: 13px; color: #64748B; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="brand">✨ Customer Intelligence Demo</div>
              <div class="demo-badge">🧪 DEMO MODE — {customer_context_line}</div>
              <div class="subject">{subject}</div>
            </div>

            <div class="body-text">{message_text}</div>

            <div class="offer-card">
              <div class="offer-title">Exclusive Retention Discount</div>
              <div class="offer-discount">{discount_percent}% OFF</div>
              <div>Use Promo Code: <strong>SAVE{int(discount_percent)}</strong></div>
              <a href="#" class="cta-btn">Claim Offer Now &rarr;</a>
            </div>

            <div class="footer">
              <p>Sent via Brevo API in Demo Mode for <strong>Customer #{primary_customer_id}</strong>.</p>
              <p>Real test recipient: <strong>{demo_recipient}</strong></p>
            </div>
          </div>
        </body>
        </html>
        """

        # Brevo REST API v3 Payload
        brevo_url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "sender": {
                "name": os.getenv("BREVO_SENDER_NAME", "AK RETAILS").strip() or "AK RETAILS",
                "email": os.getenv("BREVO_SENDER_EMAIL", "akarshanrasyal04@gmail.com").strip() or "akarshanrasyal04@gmail.com"
            },
            "to": [
                {
                    "email": demo_recipient,
                    "name": "Shopkeeper Demo"
                }
            ],
            "subject": f"{subject} [Customer #{primary_customer_id} Preview]",
            "htmlContent": html_content
        }

        try:
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(brevo_url, headers=headers, json=payload)
                resp_json = resp.json()

            if resp.status_code in [200, 201] and "messageId" in resp_json:
                msg_id = resp_json["messageId"]
                status_label = "Accepted by Brevo"

                audit_id = self._log_audit_entry(
                    campaign_id=campaign_id,
                    campaign_name=campaign_name,
                    target_group=target_group,
                    customer_count=customer_count,
                    subject=subject,
                    message_text=message_text,
                    delivery_mode="BREVO API",
                    recipient=demo_recipient,
                    provider_message_id=msg_id,
                    status_label=status_label
                )

                return {
                    "success": True,
                    "audit_id": audit_id,
                    "demo_mode": True,
                    "provider_configured": True,
                    "recipient": demo_recipient,
                    "delivery_mode": "BREVO API",
                    "status": status_label,
                    "timestamp": now_iso,
                    "message_id": msg_id,
                    "message": f"Real test email accepted by Brevo API for delivery to {demo_recipient} (Message ID: {msg_id})."
                }
            else:
                err_detail = "Unknown Brevo API error"
                if isinstance(resp_json, dict):
                    err_detail = resp_json.get("message", json.dumps(resp_json))
                
                status_label = f"Failed: Brevo API Error"
                audit_id = self._log_audit_entry(
                    campaign_id=campaign_id,
                    campaign_name=campaign_name,
                    target_group=target_group,
                    customer_count=customer_count,
                    subject=subject,
                    message_text=message_text,
                    delivery_mode="BREVO API",
                    recipient=demo_recipient,
                    provider_message_id=None,
                    status_label=f"Failed: {err_detail[:80]}"
                )

                return {
                    "success": False,
                    "audit_id": audit_id,
                    "demo_mode": True,
                    "provider_configured": True,
                    "recipient": demo_recipient,
                    "delivery_mode": "BREVO API",
                    "status": "Failed",
                    "timestamp": now_iso,
                    "message_id": None,
                    "message": f"Brevo API Rejected Request ({resp.status_code}): {err_detail}"
                }

        except Exception as e:
            audit_id = self._log_audit_entry(
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                target_group=target_group,
                customer_count=customer_count,
                subject=subject,
                message_text=message_text,
                delivery_mode="BREVO API",
                recipient=demo_recipient,
                provider_message_id=None,
                status_label=f"Failed: {str(e)[:80]}"
            )
            return {
                "success": False,
                "audit_id": audit_id,
                "demo_mode": True,
                "provider_configured": True,
                "recipient": demo_recipient,
                "delivery_mode": "BREVO API",
                "status": "Failed",
                "timestamp": now_iso,
                "message_id": None,
                "message": f"HTTP connection to Brevo API failed: {str(e)}"
            }

email_service = EmailService()
