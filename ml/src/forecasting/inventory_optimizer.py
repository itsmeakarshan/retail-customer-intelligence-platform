"""
Inventory Optimisation & Expiry Intelligence Module
Calculates defensible Reorder Points (ROP), Safety Stock, Suggested Orders,
and connects Demand Forecasting with Expiry Products to detect stockout vs excess/waste risk.
All inventory levels, lead times, and holding costs are explicitly labelled as Business Scenario Inputs
since the historical transaction dataset does not record physical warehouse state.
"""
import math
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
import scipy.stats as stats

# Standard Z-scores for Service Levels
SERVICE_LEVEL_Z = {
    0.90: 1.282,
    0.95: 1.645,
    0.98: 2.054,
    0.99: 2.326
}

class InventoryOptimizer:
    """
    Inventory Optimisation Engine.
    Combines demand forecasts, lead time volatility, service level targets, and expiry data.
    """
    def __init__(
        self,
        default_lead_time_days: int = 7,
        default_service_level: float = 0.95,
        default_holding_cost_pct: float = 0.20,
        default_stockout_cost_mult: float = 1.5
    ):
        self.default_lead_time_days = default_lead_time_days
        self.default_service_level = default_service_level
        self.default_holding_cost_pct = default_holding_cost_pct
        self.default_stockout_cost_mult = default_stockout_cost_mult

    def calculate_item_inventory(
        self,
        stock_code: str,
        description: str,
        expected_30d_demand: float,
        daily_demand_std: float,
        unit_price: float,
        current_stock: Optional[int] = None,
        lead_time_days: Optional[int] = None,
        service_level: Optional[float] = None,
        expiry_days_remaining: Optional[int] = None,
        expiry_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates safety stock, reorder point, suggested order, and stock health status.
        """
        lead_time = lead_time_days if lead_time_days is not None else self.default_lead_time_days
        srv_level = service_level if service_level is not None else self.default_service_level
        z_score = SERVICE_LEVEL_Z.get(srv_level, 1.645)

        daily_mean = max(0.0, expected_30d_demand / 30.0)
        daily_std = max(0.5, daily_demand_std)

        # 1. Lead Time Demand & Uncertainty
        lead_time_demand = daily_mean * lead_time
        lead_time_std = daily_std * math.sqrt(lead_time)

        # 2. Safety Stock = z * sigma_LT
        safety_stock = int(math.ceil(z_score * lead_time_std))

        # 3. Reorder Point = LT Demand + Safety Stock
        reorder_point = int(math.ceil(lead_time_demand + safety_stock))

        # 4. Current Stock (if not provided, derive a reasonable scenario baseline)
        if current_stock is None:
            # Baseline scenario assumption: between 0.3x and 1.8x of monthly demand
            current_stock = int(round(expected_30d_demand * 0.8))

        # 5. Suggested Order Quantity = max(0, Expected_30d + Safety_Stock - Current_Stock)
        target_inventory = expected_30d_demand + safety_stock
        suggested_order = int(max(0, math.ceil(target_inventory - current_stock)))

        # 6. Status Determination
        if current_stock <= reorder_point:
            status = "Replenishment Needed"
            status_color = "rose"
            status_emoji = "🔴"
            reason = f"Current stock ({current_stock}) is at or below Reorder Point ({reorder_point})."
        elif current_stock > (expected_30d_demand * 2.2 + safety_stock):
            status = "Excess Stock"
            status_color = "amber"
            status_emoji = "🟡"
            reason = f"Current stock ({current_stock}) significantly exceeds 60-day demand cycle."
        else:
            status = "Healthy"
            status_color = "emerald"
            status_emoji = "🟢"
            reason = f"Stock level ({current_stock}) covers lead time and 30-day forecast."

        # 7. Expiry Integration (Phase 8)
        expiry_risk_alert = None
        units_at_risk = 0
        if expiry_days_remaining is not None and expiry_days_remaining > 0:
            expected_demand_before_expiry = daily_mean * expiry_days_remaining
            if current_stock > expected_demand_before_expiry:
                units_at_risk = int(math.ceil(current_stock - expected_demand_before_expiry))
                expiry_risk_alert = {
                    "is_high_risk": True,
                    "expiry_days_remaining": expiry_days_remaining,
                    "expiry_status": expiry_status or "Expiring Soon",
                    "expected_demand_before_expiry": round(expected_demand_before_expiry, 1),
                    "units_at_risk": units_at_risk,
                    "estimated_waste_cost": round(units_at_risk * unit_price, 2),
                    "recommendation": f"Current stock ({current_stock}) exceeds expected demand ({round(expected_demand_before_expiry)}) before expiry in {expiry_days_remaining} days. Apply clearance pricing or promotional bundling."
                }
                if units_at_risk > 0:
                    # Do not order more if expiring stock exceeds demand
                    suggested_order = 0
                    reason = f"Expiring inventory alert: Halting replenishment to prevent expiry waste ({units_at_risk} units at risk)."

        order_cost_scenario = round(suggested_order * unit_price, 2)
        stock_value_scenario = round(current_stock * unit_price, 2)

        return {
            "stock_code": stock_code,
            "description": description,
            "unit_price": round(unit_price, 2),
            "expected_30d_demand": round(expected_30d_demand, 1),
            "daily_mean_demand": round(daily_mean, 2),
            "daily_std_demand": round(daily_std, 2),
            "lead_time_days": lead_time,
            "service_level": srv_level,
            "z_score": z_score,
            "lead_time_demand": round(lead_time_demand, 1),
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "current_stock": current_stock,
            "suggested_order": suggested_order,
            "status": status,
            "status_color": status_color,
            "status_emoji": status_emoji,
            "reason": reason,
            "stock_value_scenario": stock_value_scenario,
            "order_cost_scenario": order_cost_scenario,
            "expiry_risk_alert": expiry_risk_alert,
            "data_disclosure": "Business Scenario Inputs (Current stock, lead times, and unit values are simulated scenario inputs for planning)"
        }
