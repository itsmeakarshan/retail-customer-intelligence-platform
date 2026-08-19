"""
Synthetic Demo Metadata Generator & Database Initialization
-----------------------------------------------------------
IMPORTANT ARCHITECTURE GUARANTEE:
This module initializes SEPARATE tables for demonstration workflows:
1. customer_demo_metadata (joined via customer_id)
2. product_demo_metadata (joined via stock_code)
3. campaigns (campaign definitions)
4. campaign_audit_log (delivery audit history)
5. price_change_audit_log (clearance price audit history)
6. inventory_recommendations_cache (precomputed inventory optimization cache)

NO ML features, raw CSVs, or transaction dataset fields are modified.
Synthetic expiry dates and customer email addresses are strictly for demonstration.
"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

from ..db.database import DB_PATH

def calculate_recommended_discount(days_remaining: int) -> float:
    if days_remaining >= 31:
        return 0.0
    elif days_remaining >= 15:
        return 10.0
    elif days_remaining >= 8:
        return 20.0
    elif days_remaining >= 3:
        return 30.0
    elif days_remaining >= 1:
        return 40.0
    else: # Expired
        return 50.0

def init_synthetic_tables(db_path: str = DB_PATH):
    """
    Creates and populates synthetic demo metadata tables if not already present.
    Uses deterministic seeding for reproducibility across restarts.
    """
    if not db_path or not os.path.exists(db_path):
        print(f"[SyntheticGenerator] Database not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        try:
            _populate_synthetic_data(conn)
        finally:
            conn.close()
    except Exception as e:
        print(f"[SyntheticGenerator Notice] {e}")

def _populate_synthetic_data(conn: sqlite3.Connection):
    c = conn.cursor()

    # 1. Create customer_demo_metadata table
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
            units_available INTEGER NOT NULL DEFAULT 50,
            unit_price REAL NOT NULL DEFAULT 10.0,
            stock_value REAL NOT NULL DEFAULT 500.0,
            recommended_discount REAL NOT NULL DEFAULT 0.0,
            clearance_discount REAL NOT NULL DEFAULT 0.0,
            clearance_price REAL NOT NULL DEFAULT 10.0,
            price_updated_at TEXT,
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

    # 5. Create price_change_audit_log table
    c.execute("""
        CREATE TABLE IF NOT EXISTS price_change_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            old_unit_price REAL NOT NULL,
            old_discount REAL NOT NULL,
            new_discount REAL NOT NULL,
            old_clearance_price REAL NOT NULL,
            new_clearance_price REAL NOT NULL,
            updated_at TEXT NOT NULL,
            action TEXT NOT NULL
        )
    """)

    # 6. Create inventory_recommendations_cache table
    c.execute("""
        CREATE TABLE IF NOT EXISTS inventory_recommendations_cache (
            stock_code TEXT PRIMARY KEY,
            description TEXT,
            unit_price REAL,
            expected_30d_demand REAL,
            daily_mean_demand REAL,
            daily_std_demand REAL,
            lead_time_days INTEGER,
            service_level REAL,
            z_score REAL,
            lead_time_demand REAL,
            safety_stock INTEGER,
            reorder_point INTEGER,
            current_stock INTEGER,
            suggested_order INTEGER,
            status TEXT,
            status_color TEXT,
            status_emoji TEXT,
            reason TEXT,
            stock_value_scenario REAL,
            order_cost_scenario REAL,
            units_at_risk INTEGER,
            expiry_days_remaining INTEGER,
            is_high_risk INTEGER,
            expiry_status TEXT,
            estimated_waste_cost REAL,
            recommendation TEXT,
            data_disclosure TEXT,
            is_eligible INTEGER DEFAULT 1,
            exclusion_reason TEXT
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
        print(f"[SyntheticGenerator] Initialized {len(demo_rows)} customer_demo_metadata records.")

    # Populate product_demo_metadata if empty
    c.execute("SELECT COUNT(*) FROM product_demo_metadata")
    if c.fetchone()[0] == 0:
        c.execute("""
            SELECT 
                stock_code, 
                MAX(description) as desc, 
                COUNT(DISTINCT invoice) as orders,
                COALESCE(AVG(price), 9.99) as avg_price,
                SUM(quantity) as total_qty
            FROM transactions 
            WHERE is_cancelled=0 AND stock_code IS NOT NULL AND stock_code != ''
            GROUP BY stock_code
            ORDER BY orders DESC
        """)
        products = c.fetchall()
        
        today = datetime.now().date()
        random.seed(42) # Fixed seed for deterministic demo data
        now_iso = datetime.now().isoformat()
        
        product_rows = []
        for idx, (code, desc, orders, avg_price, total_qty) in enumerate(products):
            if idx < 25:
                days_remaining = random.randint(1, 28) # Expiring This Month
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
            
            # Unit price & Stock units calculation
            unit_price = round(max(float(avg_price), 1.50), 2)
            # Deterministic inventory stock count between 15 and 220 units
            units_available = max(15, (orders * 7 + idx * 13) % 200 + 15)
            stock_value = round(unit_price * units_available, 2)
            
            rec_discount = calculate_recommended_discount(days_remaining)
            clearance_discount = rec_discount
            clearance_price = round(unit_price * (1.0 - clearance_discount / 100.0), 2)
            
            product_rows.append((
                code, clean_desc, expiry_date, days_remaining, expiry_status,
                units_available, unit_price, stock_value, rec_discount, clearance_discount,
                clearance_price, now_iso, 'Synthetic / Demo'
            ))

        c.executemany("""
            INSERT INTO product_demo_metadata (
                stock_code, description, synthetic_expiry_date, expiry_days_remaining, expiry_status,
                units_available, unit_price, stock_value, recommended_discount, clearance_discount,
                clearance_price, price_updated_at, expiry_data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, product_rows)
        print(f"[SyntheticGenerator] Initialized {len(product_rows)} product_demo_metadata records with stock & pricing.")

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
        
        sample_logs = [
            (1, now_iso, "VIP High-Value Retention Offer", "High-Value At Risk", 703, "We'd love to see you again 🎁", "We miss you! Enjoy 15% off your next purchase with code VIP15.", "DEMO EMAIL", "akarshanrasyal4@gmail.com", "msg_demo_001", "Accepted by Brevo")
        ]
        c.executemany("""
            INSERT INTO campaign_audit_log (campaign_id, created_at, campaign_name, target_group, customer_count, subject, message, delivery_mode, recipient, provider_message_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_logs)

    # Populate inventory_recommendations_cache if empty
    c.execute("SELECT COUNT(*) FROM inventory_recommendations_cache")
    if c.fetchone()[0] == 0:
        c.execute("""
            SELECT 
                t.stock_code,
                MAX(t.description) as description,
                COALESCE(AVG(t.price), 9.99) as avg_price,
                COALESCE(SUM(t.quantity), 100) as total_qty,
                COUNT(DISTINCT t.invoice) as orders_count
            FROM transactions t
            WHERE t.is_cancelled = 0 AND t.quantity > 0 AND t.stock_code IS NOT NULL AND t.stock_code != ''
            GROUP BY t.stock_code
            ORDER BY total_qty DESC
        """)
        products = c.fetchall()

        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='product_demo_metadata';")
        has_demo_meta = c.fetchone() is not None

        demo_meta = {}
        if has_demo_meta:
            c.execute("SELECT stock_code, units_available, expiry_days_remaining, expiry_status FROM product_demo_metadata")
            for row in c.fetchall():
                demo_meta[str(row[0])] = {
                    'units_available': row[1],
                    'expiry_days_remaining': row[2],
                    'expiry_status': row[3]
                }

        from ml.src.forecasting.inventory_optimizer import InventoryOptimizer
        optimizer = InventoryOptimizer(default_lead_time_days=7, default_service_level=0.95)

        inv_rows = []
        for p in products:
            code, desc, avg_price, total_qty, orders_count = p
            clean_desc = desc if desc else f'Product #{code}'
            unit_p = round(max(float(avg_price), 0.50), 2)
            
            exp_demand = round(max(5.0, (total_qty / 738.0) * 30.0), 1)
            daily_std = round(max(0.5, (exp_demand / 30.0) * 0.4), 2)
            
            lead_time = 7
            service_lvl = 0.95
            
            m = demo_meta.get(str(code), {})
            raw_stock = m.get('units_available')
            exp_days = m.get('expiry_days_remaining')
            exp_status = m.get('expiry_status') or 'Healthy'
            
            current_stock = raw_stock if raw_stock is not None and raw_stock > 0 else int(round(exp_demand * 0.8 + 10))
            
            calc = optimizer.calculate_item_inventory(
                stock_code=str(code),
                description=str(clean_desc),
                expected_30d_demand=exp_demand,
                daily_demand_std=daily_std,
                unit_price=unit_p,
                current_stock=current_stock,
                lead_time_days=lead_time,
                service_level=service_lvl,
                expiry_days_remaining=exp_days,
                expiry_status=exp_status
            )
            
            if orders_count < 3:
                status = 'Insufficient History'
                status_color = 'gray'
                status_emoji = '⚪'
                reason = f'Insufficient transaction history ({orders_count} order(s)) for automated safety stock calculation'
                suggested_order = 0
                order_cost = 0.0
                is_eligible = 0
                exclusion_reason = f'Insufficient transaction history ({orders_count} order(s))'
            else:
                status = calc['status']
                status_color = calc['status_color']
                status_emoji = calc['status_emoji']
                reason = calc['reason']
                suggested_order = calc['suggested_order']
                order_cost = calc['order_cost_scenario']
                is_eligible = 1
                exclusion_reason = None
            
            exp_alert = calc.get('expiry_risk_alert')
            units_at_risk = exp_alert['units_at_risk'] if exp_alert else 0
            waste_cost = exp_alert['estimated_waste_cost'] if exp_alert else 0.0
            is_high_risk = 1 if (exp_alert and exp_alert.get('is_high_risk')) else 0
            rec_text = exp_alert['recommendation'] if exp_alert else ('Normal Replenishment' if status != 'Insufficient History' else 'Insufficient History')
            
            inv_rows.append((
                str(code), str(clean_desc), unit_p, exp_demand, calc['daily_mean_demand'], daily_std,
                lead_time, service_lvl, calc['z_score'], calc['lead_time_demand'], calc['safety_stock'], calc['reorder_point'],
                current_stock, suggested_order, status, status_color, status_emoji, reason,
                calc['stock_value_scenario'], order_cost, units_at_risk, exp_days, is_high_risk,
                exp_status, waste_cost, rec_text,
                'Calculated via LightGBM & Empirical Demand Variance',
                is_eligible, exclusion_reason
            ))

        c.executemany("""
            INSERT OR REPLACE INTO inventory_recommendations_cache VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, inv_rows)
        print(f"[SyntheticGenerator] Initialized {len(inv_rows)} inventory_recommendations_cache records.")

    conn.commit()
    try:
        from .retail_intelligence_service import retail_intelligence_service
        retail_intelligence_service.clear_cache()
    except Exception:
        pass

if __name__ == "__main__":
    init_synthetic_tables()
