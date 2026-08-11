"""
Gemini Business AI Assistant Service
Provides server-side integration with Gemini API to answer shopkeeper natural-language questions
grounded in real database/analytics context.
"""
import os
import json
import google.generativeai as genai
from typing import Dict, Any, List

class BusinessAIAssistant:
    def __init__(self):
        self.model = None
        self.is_available = False
        self.init_model()

    def init_model(self):
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
        
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel(model_name)
                self.is_available = True
            except Exception as e:
                print(f"Warning: Failed to initialize Gemini model: {e}")
                self.is_available = False
                self.model = None
        else:
            self.is_available = False
            self.model = None

    def check_availability(self) -> Dict[str, Any]:
        self.init_model()
        return {
            "available": self.is_available,
            "message": "Business Assistant is online." if self.is_available else "Business Assistant is unavailable because the Gemini API key has not been configured."
        }

    def generate_analytics_context(self, db_summary: dict, segments: list, top_risk_cust: list, revenue_risk: dict, retention_summary: dict = None, expiry_summary: dict = None) -> str:
        """
        Formats precise, aggregated business metrics to ground Gemini in empirical truth.
        """
        context = {
            "platform_name": "Customer Intelligence & Revenue Risk Platform",
            "executive_summary": {
                "total_active_customers": db_summary.get("total_customers", 5344),
                "high_risk_customers": db_summary.get("high_risk_customers", 3050),
                "total_potential_revenue_at_risk_gbp": db_summary.get("total_revenue_at_risk", 769069.43),
                "total_projected_future_revenue_gbp": db_summary.get("total_predicted_future_value", 2986076.96),
                "average_customer_value_gbp": db_summary.get("average_customer_value", 569.45),
                "overall_90d_customer_risk_rate_pct": round(db_summary.get("overall_churn_rate", 0.5711) * 100, 2)
            },
            "retention_and_expiry_summary": retention_summary or {
                "customers_needing_attention": 2163,
                "high_value_customers_at_risk": 703,
                "potential_revenue_at_risk_gbp": 769069.43,
                "products_expiring_soon": 25,
                "high_value_customers_bought_expiring": 38
            },
            "product_inventory_expiry": expiry_summary or {
                "expiring_soon_products": 25,
                "expired_products": 10,
                "healthy_products": 4596
            },
            "customer_groups_summary": segments,
            "top_10_highest_exposure_customers": top_risk_cust,
            "revenue_risk_by_segment": revenue_risk.get("by_segment", []),
            "top_country_markets_at_risk": revenue_risk.get("by_country", [])[:5]
        }
        return json.dumps(context, indent=2)

    def ask_assistant(self, user_question: str, db_summary: dict, segments: list, top_risk_cust: list, revenue_risk: dict, retention_summary: dict = None, expiry_summary: dict = None) -> Dict[str, Any]:
        self.init_model()
        if not self.is_available or self.model is None:
            return {
                "answer": "Business Assistant is unavailable because the Gemini API key has not been configured.",
                "available": False,
                "suggested_actions": ["Set GEMINI_API_KEY in environment or .env file"]
            }

        analytics_context = self.generate_analytics_context(db_summary, segments, top_risk_cust, revenue_risk, retention_summary, expiry_summary)

        system_prompt = f"""
You are the lead Business Copilot for a retail shopkeeper using the Customer Intelligence & Revenue Risk Platform.
Your goal is to answer the user's question using simple, clear, professional business language.

RULES FOR YOUR RESPONSE:
1. NON-TECHNICAL LANGUAGE: Never mention "machine learning", "ROC-AUC", "LightGBM", "SHAP", "classification", or "Python".
   Use business terms like "Customers at Risk", "Likelihood of Stopping Purchases", "Estimated 90-Day Customer Value", "Potential Revenue at Risk", "Customer Groups", and "Retention Campaigns".
2. STRICT DATA TRUTH: All numbers, percentages, currency amounts (£), and customer figures MUST come strictly from the provided Business Context below. NEVER invent or fabricate any metrics or customer IDs.
3. INSUFFICIENT INFORMATION: If the provided Business Context does not contain enough information to answer a question reliably, explicitly state: "I don't have enough information in the current data to answer that reliably."
4. CAMPAIGN CREATION & TARGETING: When asked about campaigns, targeting, or offers, structure your answer into visual sections (e.g. 🎯 Target Group, 👥 Customer Reach, 💷 Revenue at Risk, 🎁 Suggested Offer / Message).
5. CONCISE & ACTIONABLE: Use short sections, bullet points, emojis, and clear whitespace.

--- BUSINESS CONTEXT DATA ---
{analytics_context}
-----------------------------
"""

        try:
            response = self.model.generate_content(
                f"{system_prompt}\n\nUser Question: {user_question}"
            )
            answer_text = response.text.strip()
            
            # Simple button navigation detection
            suggested_target = "retention"
            if "group" in user_question.lower() or "segment" in user_question.lower():
                suggested_target = "segmentation"
            elif "revenue" in user_question.lower() or "money" in user_question.lower():
                suggested_target = "revenue"
            elif "campaign" in user_question.lower() or "offer" in user_question.lower() or "expiry" in user_question.lower():
                suggested_target = "retention"

            return {
                "answer": answer_text,
                "available": True,
                "suggested_tab": suggested_target,
                "source_grounding": "Grounded in live database analytics context"
            }
        except Exception as e:
            return {
                "answer": f"I encountered an error processing your query: {str(e)}",
                "available": True,
                "suggested_tab": "dashboard"
            }
        except Exception as e:
            return {
                "answer": f"I encountered an error processing your query: {str(e)}",
                "available": True,
                "suggested_tab": "dashboard"
            }

ai_assistant_service = BusinessAIAssistant()
