"""
Unit & Integration Tests for Gemini Customer & Spend Record Retrieval
Verifies that natural language questions about top spenders, spend thresholds, and customer IDs dynamically retrieve exact records.
"""

import os
import pytest
from backend.app.db.database import get_db, SessionLocal
from backend.app.services.ai_assistant import ai_assistant_service
from backend.app.services.synthetic_generator import init_synthetic_tables

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
DB_PATH = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_synthetic_tables(DB_PATH)

def test_gemini_retrieval_top_spenders():
    """
    When user asks 'Which customer spent the most?' or 'Who are the top spenders?',
    Gemini MUST return top spending customers ordered by monetary spend.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Which customer spent the most in our shop?",
            db=db
        )
        assert retrieved["matched"] is True
        assert retrieved["intent"] == "top_spending_customers"
        data = retrieved["data"]
        assert len(data) > 0
        
        # Verify sorted by monetary DESC
        for i in range(len(data) - 1):
            assert data[i]["monetary"] >= data[i + 1]["monetary"]
            assert "customer_id" in data[i]
            assert "monetary" in data[i]
            assert "risk_level" in data[i]
    finally:
        db.close()

def test_gemini_retrieval_spend_threshold():
    """
    When user asks 'Show customers who spent more than 5000',
    Gemini MUST return records where monetary >= 5000.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Show me customers who spent more than £5,000",
            db=db
        )
        assert retrieved["matched"] is True
        assert "customers_spent_over_5000" in retrieved["intent"]
        data = retrieved["data"]
        assert len(data) > 0

        for c in data:
            assert c["monetary"] >= 5000 or c["gross_revenue"] >= 5000
    finally:
        db.close()

def test_gemini_retrieval_specific_customer_id():
    """
    When user asks 'Show details for customer 18102' or 'Tell me about customer 14646',
    Gemini MUST return that exact customer's details and recent transactions.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Tell me about customer 18102",
            db=db
        )
        assert retrieved["matched"] is True
        assert retrieved["intent"] == "customer_specific_id"
        assert retrieved["target_customer_id"] == "18102"
        data = retrieved["data"]
        assert len(data) > 0
        assert str(data[0]["customer_id"]) == "18102"
        assert "recent_transactions" in retrieved
    finally:
        db.close()
