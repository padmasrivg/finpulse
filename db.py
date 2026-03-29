"""
FinPulse - MongoDB Database Connection
Handles connection pooling and database access.
"""

import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

_client = None
_db = None


def get_client():
    """Return a singleton MongoClient instance."""
    global _client
    if _client is None:
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        try:
            # Verify connection is alive
            _client.admin.command("ping")
            print("✅ Connected to MongoDB successfully")
        except ConnectionFailure as e:
            print(f"❌ MongoDB connection failed: {e}")
            raise
    return _client


def get_db():
    """Return the FinPulse database instance."""
    global _db
    if _db is None:
        db_name = os.getenv("MONGODB_DB", "finpulse")
        _db = get_client()[db_name]
        _ensure_indexes(_db)
    return _db


def _ensure_indexes(db):
    """Create necessary indexes for performance."""
    try:
        db.expenses.create_index([("company_type", 1), ("date", -1)])
        db.expenses.create_index([("company_type", 1), ("category", 1)])
        db.expenses.create_index("created_at")
    except Exception as e:
        print(f"⚠️  Index creation warning: {e}")


def close_connection():
    """Cleanly close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        print("🔌 MongoDB connection closed")