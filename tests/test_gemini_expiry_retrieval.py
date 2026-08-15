"""
Unit & Integration Tests for Gemini Dynamic Expiry & Product-Level Record Retrieval
Verifies that natural language questions dynamically query the backend and retrieve exact matching records.
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

def test_gemini_retrieval_next_6_days():
    """
    CRITICAL REQUIREMENT:
    When user asks 'What expires in the next 6 days?',
    Gemini's dynamic retrieval MUST return EXACTLY the records where:
    expiry_days_remaining BETWEEN 0 AND 6.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="What is going to expire in the next 6 days?",
            db=db
        )
        assert retrieved["matched"] is True
        assert retrieved["intent"] == "expiry_products_within_6_days"
        data = retrieved["data"]
        assert len(data) > 0

        # Verify EVERY returned product satisfies 0 <= expiry_days_remaining <= 6
        for p in data:
            assert 0 <= p["expiry_days_remaining"] <= 6, f"Product {p['stock_code']} with {p['expiry_days_remaining']} days outside [0, 6]"
            assert "stock_code" in p
            assert "description" in p
            assert "units_available" in p
            assert "unit_price" in p
            assert "clearance_price" in p

        # Verify NO products outside 0-6 days are included
        assert all(0 <= p["expiry_days_remaining"] <= 6 for p in data)

    finally:
        db.close()

def test_gemini_retrieval_already_expired():
    """
    When user asks 'Which products have already expired?',
    Gemini's dynamic retrieval MUST return products where:
    expiry_days_remaining < 0.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Which products have already expired?",
            db=db
        )
        assert retrieved["matched"] is True
        assert retrieved["intent"] == "expiry_products_expired"
        data = retrieved["data"]
        assert len(data) > 0

        # Verify EVERY returned product satisfies expiry_days_remaining < 0
        for p in data:
            assert p["expiry_days_remaining"] < 0, f"Product {p['stock_code']} with {p['expiry_days_remaining']} is not expired"

    finally:
        db.close()

def test_gemini_retrieval_this_week():
    """
    When user asks 'Which products expire this week?',
    Gemini's dynamic retrieval MUST return products where:
    expiry_days_remaining BETWEEN 0 AND 7.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Which products expire this week?",
            db=db
        )
        assert retrieved["matched"] is True
        assert retrieved["intent"] == "expiry_products_this_week"
        data = retrieved["data"]
        assert len(data) > 0

        for p in data:
            assert 0 <= p["expiry_days_remaining"] <= 7

    finally:
        db.close()

def test_gemini_retrieval_discount_first():
    """
    When user asks 'Which products should I discount first?',
    retrieves expiring items sorted by stock value and urgency.
    """
    db = SessionLocal()
    try:
        retrieved = ai_assistant_service.retrieve_query_specific_records(
            user_question="Which products should I discount first to avoid waste?",
            db=db
        )
        assert retrieved["matched"] is True
        assert len(retrieved["data"]) > 0
    finally:
        db.close()
