"""
FinPulse - AI-Powered Expense Monitoring Platform
Flask Backend API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_db
from bson.errors import InvalidId 
from model import (
    run_anomaly_detection,
    generate_ai_insights,
    chat_with_assistant,
    get_category_stats,
    get_monthly_trends,
)
from datetime import datetime
from bson import ObjectId
import json

app = Flask(__name__)
CORS(app)


# ─────────────────────────────────────────────
#  Utility
# ─────────────────────────────────────────────

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app.json_encoder = JSONEncoder


def serialize_doc(doc):
    """Convert MongoDB document to JSON-safe dict."""
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("date"), datetime):
        doc["date"] = doc["date"].isoformat()
    return doc


# ─────────────────────────────────────────────
#  Health Check
# ─────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "FinPulse API is running"})


# ─────────────────────────────────────────────
#  Expenses CRUD
# ─────────────────────────────────────────────

@app.route("/api/expenses", methods=["POST"])
def add_expense():
    """Add a new expense entry."""
    data = request.get_json()

    required_fields = ["company_type", "category", "amount", "description", "date"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        date_obj = datetime.strptime(data["date"], "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    expense = {
        "company_type": data["company_type"],      # "edtech" | "professional"
        "category": data["category"],
        "amount": amount,
        "description": data["description"],
        "date": date_obj,
        "vendor": data.get("vendor", ""),
        "tags": data.get("tags", []),
        "created_at": datetime.utcnow(),
    }

    db = get_db()
    result = db.expenses.insert_one(expense)
    expense["_id"] = str(result.inserted_id)
    expense["date"] = date_obj.isoformat()
    expense["created_at"] = expense["created_at"].isoformat()

    return jsonify({"message": "Expense added successfully", "expense": expense}), 201


@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    """Fetch all expenses, optionally filtered by company_type."""
    company_type = request.args.get("company_type")
    limit = int(request.args.get("limit", 100))
    skip = int(request.args.get("skip", 0))

    query = {}
    if company_type:
        query["company_type"] = company_type

    db = get_db()
    expenses = list(
        db.expenses.find(query)
        .sort("date", -1)
        .skip(skip)
        .limit(limit)
    )
    expenses = [serialize_doc(e) for e in expenses]

    total = db.expenses.count_documents(query)
    return jsonify({"expenses": expenses, "total": total})


@app.route("/api/expenses/<expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    db = get_db()

    try:
        obj_id = ObjectId(expense_id)
    except Exception:
        return jsonify({"error": "Invalid expense ID"}), 400

    result = db.expenses.delete_one({"_id": obj_id})

    if result.deleted_count == 0:
        return jsonify({"error": "Expense not found"}), 404

    return jsonify({"message": "Expense deleted successfully"})


# ─────────────────────────────────────────────
#  Dashboard Analytics
# ─────────────────────────────────────────────

@app.route("/api/dashboard/summary", methods=["GET"])
def dashboard_summary():
    """Overall financial summary for the dashboard."""
    company_type = request.args.get("company_type", "edtech")
    db = get_db()

    expenses = list(db.expenses.find({"company_type": company_type}))
    if not expenses:
        return jsonify({
            "total_expenses": 0,
            "total_transactions": 0,
            "avg_transaction": 0,
            "highest_category": None,
            "categories": [],
            "monthly_trends": [],
        })

    total = sum(e["amount"] for e in expenses)
    avg = total / len(expenses)

    category_stats = get_category_stats(expenses)
    monthly_trends = get_monthly_trends(expenses)

    highest_cat = max(category_stats, key=lambda x: x["total"], default=None)

    return jsonify({
        "total_expenses": round(total, 2),
        "total_transactions": len(expenses),
        "avg_transaction": round(avg, 2),
        "highest_category": highest_cat["category"] if highest_cat else None,
        "categories": category_stats,
        "monthly_trends": monthly_trends,
    })


@app.route("/api/dashboard/anomalies", methods=["GET"])
def dashboard_anomalies():
    """Run Isolation Forest anomaly detection."""
    company_type = request.args.get("company_type", "edtech")
    db = get_db()

    expenses = list(db.expenses.find({"company_type": company_type}))
    if len(expenses) < 5:
        return jsonify({
            "anomalies": [],
            "message": "Need at least 5 transactions for anomaly detection"
        })

    anomalies = run_anomaly_detection(expenses)
    return jsonify({"anomalies": anomalies, "count": len(anomalies)})


# ─────────────────────────────────────────────
#  AI Insights
# ─────────────────────────────────────────────

@app.route("/api/insights", methods=["GET"])
def get_insights():
    """Generate AI-driven financial insights."""
    company_type = request.args.get("company_type", "edtech")
    db = get_db()

    expenses = list(db.expenses.find({"company_type": company_type}))
    if not expenses:
        return jsonify({"insights": [], "message": "No data available"})

    insights = generate_ai_insights(expenses, company_type)
    return jsonify({"insights": insights, "company_type": company_type})


# ─────────────────────────────────────────────
#  AI Chat Assistant
# ─────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    """Process chat message and return AI assistant response."""
    data = request.get_json()
    message = data.get("message", "").strip()
    company_type = data.get("company_type", "edtech")

    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    db = get_db()
    expenses = list(db.expenses.find({"company_type": company_type}))

    response = chat_with_assistant(message, expenses, company_type)
    return jsonify({"response": response, "message": message})


# ─────────────────────────────────────────────
#  Bulk Data Load (for CSV import)
# ─────────────────────────────────────────────

@app.route("/api/expenses/bulk", methods=["POST"])
def bulk_import():
    """Bulk import expenses from parsed CSV data."""
    data = request.get_json()
    expenses_data = data.get("expenses", [])

    if not expenses_data:
        return jsonify({"error": "No expenses provided"}), 400

    db = get_db()
    docs = []
    for e in expenses_data:
        try:
            docs.append({
                "company_type": e["company_type"],
                "category": e["category"],
                "amount": float(e["amount"]),
                "description": e["description"],
                "date": datetime.strptime(e["date"], "%Y-%m-%d"),
                "vendor": e.get("vendor", ""),
                "tags": e.get("tags", []),
                "created_at": datetime.utcnow(),
            })
        except (KeyError, ValueError):
            continue

    if docs:
        db.expenses.insert_many(docs)

    return jsonify({
        "message": f"Imported {len(docs)} expenses successfully",
        "count": len(docs)
    })


# ─────────────────────────────────────────────
#  Company Types & Categories Config
# ─────────────────────────────────────────────

@app.route("/api/config/categories", methods=["GET"])
def get_categories():
    """Return available categories per company type."""
    categories = {
        "edtech": [
            {"id": "marketing", "label": "Marketing", "icon": "📣"},
            {"id": "cloud", "label": "Cloud Infrastructure", "icon": "☁️"},
            {"id": "instructor", "label": "Instructor Fees", "icon": "👨‍🏫"},
            {"id": "content", "label": "Content Production", "icon": "🎬"},
        ],
        "professional": [
            {"id": "travel", "label": "Travel & Lodging", "icon": "✈️"},
            {"id": "salary", "label": "Salaries & Benefits", "icon": "💼"},
            {"id": "software", "label": "Software & Tools", "icon": "💻"},
            {"id": "office", "label": "Office & Facilities", "icon": "🏢"},
        ],
    }
    return jsonify(categories)

@app.route('/')
def home():
    return
render_templates('index.html')    
app = app
#if __name__ == "__main__":
  #  print("🚀 FinPulse API starting on http://localhost:5000")
    # app.run(debug=True, port=5000)
