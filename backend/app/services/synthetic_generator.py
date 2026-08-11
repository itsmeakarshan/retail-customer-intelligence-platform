"""
Synthetic Demo Metadata Generator & Database Initialization
-----------------------------------------------------------
IMPORTANT ARCHITECTURE GUARANTEE:
This module initializes SEPARATE tables for demonstration workflows:
1. customer_demo_metadata (joined via customer_id)
2. product_demo_metadata (joined via stock_code)
3. campaigns (campaign definitions)
4. campaign_audit_log (delivery audit history)

NO ML features, raw CSVs, or transaction dataset fields are modified.
Synthetic customer email addresses are strictly for demonstration.
"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
DB_PATH = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")

def init_synthetic_tables(db_path: str = DB_PATH):
    """
    Creates and populates synthetic demo metadata tables if not already present.
    Uses deterministic seeding for reproducibility across restarts.
    """
    if not os.path.exists(db_path):
        print(f"[SyntheticGenerator] Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Create customer_demo_metadata table (synthetic email only, no phone)
    c.execute("""
        CREATE TABLE IF NOT EXISTS customer_demo_metadata (
            customer_id TEXT PRIMARY KEY,
            demo_email TEXT NOT NULL,
            contact_data_source TEXT DEFAULT 'Synthetic / Demo',
            FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
        )
    """)

    # 2. Create product_demo_metadata table
    c.execute("""
        CREATE TABLE IF NOT EXISTS product_demo_metadata (
            stock_code TEXT PRIMARY KEY,
            description TEXT,
            synthetic_expiry_date TEXT NOT NULL,
            expiry_days_remaining INTEGER NOT NULL,
            expiry_status TEXT NOT NULL,
            expiry_data_source TEXT DEFAULT 'Synthetic / Demo'
        )
    """)

    # 3. Create campaigns table
    c.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_name TEXT NOT NULL,
            target_group TEXT NOT NULL,
            target_product_code TEXT,
            offer_type TEXT NOT NULL,
            discount_percent REAL NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT DEFAULT 'Active'
        )
    """)

    # 4. Create campaign_audit_log table (Email delivery log)
    c.execute("""
        CREATE TABLE IF NOT EXISTS campaign_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER,
            created_at TEXT NOT NULL,
            campaign_name TEXT NOT NULL,
            target_group TEXT NOT NULL,
            customer_count INTEGER NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            delivery_mode TEXT DEFAULT 'DEMO EMAIL',
            recipient TEXT NOT NULL,
            provider_message_id TEXT,
            status TEXT NOT NULL,
            FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
        )
    """)

    # Populate customer_demo_metadata if empty
    c.execute("SELECT COUNT(*) FROM customer_demo_metadata")
    if c.fetchone()[0] == 0:
        c.execute("SELECT DISTINCT customer_id FROM customers WHERE customer_id IS NOT NULL AND customer_id != ''")
        customer_ids = [r[0] for r in c.fetchall()]
        
        demo_rows = []
        for cid in customer_ids:
            demo_email = f"customer_{cid}@example.com"
            demo_rows.append((cid, demo_email, 'Synthetic / Demo'))
            
        c.executemany("""
            INSERT INTO customer_demo_metadata (customer_id, demo_email, contact_data_source)
            VALUES (?, ?, ?)
        """, demo_rows)
        print(f"[SyntheticGenerator] Initialized {len(demo_rows)} customer_demo_metadata records with synthetic emails.")

    # Populate product_demo_metadata if empty
    c.execute("SELECT COUNT(*) FROM product_demo_metadata")
    if c.fetchone()[0] == 0:
        c.execute("""
            SELECT stock_code, MAX(description), COUNT(DISTINCT invoice) as orders
            FROM transactions 
            WHERE is_cancelled=0 AND stock_code IS NOT NULL AND stock_code != ''
            GROUP BY stock_code
            ORDER BY orders DESC
        """)
        products = c.fetchall()
        
        today = datetime.now().date()
        random.seed(42) # Fixed seed for deterministic demo data
        
        product_rows = []
        for idx, (code, desc, orders) in enumerate(products):
            if idx < 25:
                days_remaining = random.randint(5, 25) # Expiring Soon
            elif idx < 35:
                days_remaining = random.randint(-15, -1) # Expired
            else:
                days_remaining = random.randint(31, 365) # Healthy
                
            expiry_date = (today + timedelta(days=days_remaining)).isoformat()
            
            if days_remaining < 0:
                expiry_status = 'Expired'
            elif days_remaining <= 30:
                expiry_status = 'Expiring Soon'
            else:
                expiry_status = 'Healthy'
                
            clean_desc = desc if desc else f"Product #{code}"
            product_rows.append((code, clean_desc, expiry_date, days_remaining, expiry_status, 'Synthetic / Demo'))

        c.executemany("""
            INSERT INTO product_demo_metadata (stock_code, description, synthetic_expiry_date, expiry_days_remaining, expiry_status, expiry_data_source)
            VALUES (?, ?, ?, ?, ?, ?)
        """, product_rows)
        print(f"[SyntheticGenerator] Initialized {len(product_rows)} product_demo_metadata records.")

    # Populate default demo campaigns if empty
    c.execute("SELECT COUNT(*) FROM campaigns")
    if c.fetchone()[0] == 0:
        now_iso = datetime.now().isoformat()
        sample_campaigns = [
            ("VIP High-Value Retention Offer", "High-Value At Risk", None, "Percentage Off", 15.0, "We miss you! Enjoy 15% off your next purchase with code VIP15.", now_iso, "Active"),
            ("Fresh Inventory Promotion", "Active Casuals", "85123A", "Percentage Off", 20.0, "Exclusive 20% discount on white hanging heart lights for our valued customers!", now_iso, "Active")
        ]
        c.executemany("""
            INSERT INTO campaigns (campaign_name, target_group, target_product_code, offer_type, discount_percent, message, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_campaigns)
        
        # Sample audit log
        sample_logs = [
            (1, now_iso, "VIP High-Value Retention Offer", "High-Value At Risk", 703, "We'd love to see you again 🎁", "We miss you! Enjoy 15% off your next purchase with code VIP15.", "DEMO EMAIL", "akarshanrasyal4@gmail.com", "msg_demo_001", "Accepted by Brevo")
        ]
        c.executemany("""
            INSERT INTO campaign_audit_log (campaign_id, created_at, campaign_name, target_group, customer_count, subject, message, delivery_mode, recipient, provider_message_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_logs)
        print("[SyntheticGenerator] Initialized default demo campaigns and email audit logs.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_synthetic_tables()
