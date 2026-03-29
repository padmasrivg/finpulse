"""
FinPulse - AI/ML Engine
Handles anomaly detection, financial insights, and chat assistant logic.
Uses: Pandas, NumPy, Scikit-learn (Isolation Forest)
"""

import re
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder


# ─────────────────────────────────────────────
#  Data Preparation Utilities
# ─────────────────────────────────────────────

def expenses_to_dataframe(expenses: list) -> pd.DataFrame:
    """Convert MongoDB expense documents to a clean Pandas DataFrame."""
    if not expenses:
        return pd.DataFrame()

    rows = []
    for e in expenses:
        rows.append({
            "id": str(e.get("_id", "")),
            "amount": float(e.get("amount", 0)),
            "category": e.get("category", "unknown"),
            "description": e.get("description", ""),
            "vendor": e.get("vendor", ""),
            "date": pd.to_datetime(e.get("date")),
            "company_type": e.get("company_type", ""),
        })

    df = pd.DataFrame(rows)
    df["month"] = df["date"].dt.to_period("M").astype(str)
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day
    return df


# ─────────────────────────────────────────────
#  Anomaly Detection — Isolation Forest
# ─────────────────────────────────────────────

def run_anomaly_detection(expenses: list) -> list:
    """
    Run Isolation Forest on expense data to detect unusual transactions.
    Returns list of anomalous expense dicts with anomaly_score.
    """
    df = expenses_to_dataframe(expenses)
    if df.empty or len(df) < 5:
        return []

    # Encode category as numeric feature
    le = LabelEncoder()
    df["category_enc"] = le.fit_transform(df["category"])

    # Feature matrix: amount, category_encoded, day_of_month
    X = df[["amount", "category_enc", "day_of_month"]].values

    # Isolation Forest — contamination = ~10% flagged as anomalies
    model = IsolationForest(
        n_estimators=100,
        contamination=0.10,
        random_state=42,
    )
    df["anomaly"] = model.fit_predict(X)          # -1 = anomaly, 1 = normal
    df["anomaly_score"] = model.score_samples(X)   # lower = more anomalous

    anomalies_df = df[df["anomaly"] == -1].sort_values("anomaly_score")

    anomalies = []
    for _, row in anomalies_df.iterrows():
        # Map anomaly_score to 0–100 severity scale
        min_score = df["anomaly_score"].min()
        max_score = df["anomaly_score"].max()
        score_range = max_score - min_score if max_score != min_score else 1
        severity = int(100 * (max_score - row["anomaly_score"]) / score_range)

        anomalies.append({
            "id": row["id"],
            "amount": round(float(row["amount"]), 2),
            "category": row["category"],
            "description": row["description"],
            "vendor": row["vendor"],
            "date": row["date"].strftime("%Y-%m-%d"),
            "severity": severity,
            "reason": _explain_anomaly(row, df),
        })

    return anomalies


def _explain_anomaly(row: pd.Series, df: pd.DataFrame) -> str:
    """Generate a human-readable reason for why a transaction is anomalous."""
    cat_df = df[df["category"] == row["category"]]
    cat_mean = cat_df["amount"].mean()
    cat_std = cat_df["amount"].std() or 1

    z_score = abs((row["amount"] - cat_mean) / cat_std)

    if z_score > 2.5:
        return (
            f"Amount ₹{row['amount']:,.0f} is {z_score:.1f}σ above "
            f"the {row['category']} average of ₹{cat_mean:,.0f}"
        )
    if row["day_of_week"] >= 5:
        return f"Transaction occurred on a weekend — unusual for {row['category']} expenses"
    if row["amount"] > df["amount"].quantile(0.95):
        return f"Top 5% highest transaction across all categories"
    return "Statistical outlier detected by Isolation Forest model"


# ─────────────────────────────────────────────
#  Category Statistics
# ─────────────────────────────────────────────

def get_category_stats(expenses: list) -> list:
    """Compute per-category totals, counts, averages, and % share."""
    df = expenses_to_dataframe(expenses)
    if df.empty:
        return []

    total = df["amount"].sum()
    stats = (
        df.groupby("category")["amount"]
        .agg(total_sum="sum", count="count", mean="mean", max="max")
        .reset_index()
    )

    result = []
    for _, row in stats.iterrows():
        result.append({
            "category": row["category"],
            "total": round(float(row["total_sum"]), 2),
            "count": int(row["count"]),
            "average": round(float(row["mean"]), 2),
            "max": round(float(row["max"]), 2),
            "percentage": round(float(row["total_sum"]) / total * 100, 1),
        })

    return sorted(result, key=lambda x: x["total"], reverse=True)


# ─────────────────────────────────────────────
#  Monthly Trends
# ─────────────────────────────────────────────

def get_monthly_trends(expenses: list) -> list:
    """Compute monthly expense totals and MoM change."""
    df = expenses_to_dataframe(expenses)
    if df.empty:
        return []

    monthly = (
        df.groupby("month")["amount"]
        .sum()
        .reset_index()
        .sort_values("month")
    )

    trends = []
    prev = None
    for _, row in monthly.iterrows():
        total = round(float(row["amount"]), 2)
        change_pct = 0.0
        if prev is not None and prev > 0:
            change_pct = round((total - prev) / prev * 100, 1)
        trends.append({
            "month": row["month"],
            "total": total,
            "change_pct": change_pct,
        })
        prev = total

    return trends


# ─────────────────────────────────────────────
#  AI Insights Generator
# ─────────────────────────────────────────────

EDTECH_INSIGHTS_CONFIG = {
    "high_threshold": 0.40,   # flag if category > 40% of total
    "growth_threshold": 0.25, # flag if MoM growth > 25%
    "categories": {
        "marketing": "Marketing spend should ideally stay under 30% of total budget. Consider A/B testing campaigns to optimise CAC.",
        "cloud": "Cloud costs tend to spike with user growth. Evaluate reserved instance pricing or spot instances to reduce by 20–40%.",
        "instructor": "Instructor fees are your quality signal. Renegotiate bulk-session contracts for high-volume educators.",
        "content": "Content production ROI is measurable. Track cost-per-enrolled-student per content piece.",
    },
}

PROFESSIONAL_INSIGHTS_CONFIG = {
    "high_threshold": 0.35,
    "growth_threshold": 0.20,
    "categories": {
        "travel": "Track billable vs non-billable travel. Non-billable travel >15% signals process inefficiency.",
        "salary": "Salary is your largest fixed cost. Ensure utilisation rates stay above 75% to maintain healthy margins.",
        "software": "Audit SaaS subscriptions quarterly. Unused licences are silent budget killers.",
        "office": "Hybrid work models can reduce office costs by up to 35%. Consider hot-desking policies.",
    },
}


def generate_ai_insights(expenses: list, company_type: str) -> list:
    """Generate actionable financial insights based on spending patterns."""
    df = expenses_to_dataframe(expenses)
    if df.empty:
        return []

    config = EDTECH_INSIGHTS_CONFIG if company_type == "edtech" else PROFESSIONAL_INSIGHTS_CONFIG
    insights = []
    total = df["amount"].sum()

    # ── Insight 1: Overspending categories ──
    cat_totals = df.groupby("category")["amount"].sum()
    for cat, amt in cat_totals.items():
        pct = amt / total
        if pct > config["high_threshold"]:
            tip = config["categories"].get(cat, "Review this category for cost-saving opportunities.")
            insights.append({
                "type": "overspending",
                "severity": "high" if pct > 0.50 else "medium",
                "category": cat,
                "title": f"🚨 High spend in {cat.title()}",
                "detail": f"{cat.title()} accounts for {pct*100:.1f}% of total budget (₹{amt:,.0f}).",
                "recommendation": tip,
                "metric": round(pct * 100, 1),
            })

    # ── Insight 2: Month-over-Month spike detection ──
    monthly = df.groupby("month")["amount"].sum().sort_index()
    if len(monthly) >= 2:
        months = list(monthly.index)
        for i in range(1, len(months)):
            prev_amt = monthly[months[i - 1]]
            curr_amt = monthly[months[i]]
            if prev_amt > 0:
                change = (curr_amt - prev_amt) / prev_amt
                if change > config["growth_threshold"]:
                    insights.append({
                        "type": "trend_spike",
                        "severity": "high" if change > 0.50 else "medium",
                        "category": "all",
                        "title": f"📈 Expense spike in {months[i]}",
                        "detail": f"Total spending rose {change*100:.1f}% vs {months[i-1]} (₹{prev_amt:,.0f} → ₹{curr_amt:,.0f}).",
                        "recommendation": "Investigate which categories drove the spike and assess if the spend was planned.",
                        "metric": round(change * 100, 1),
                    })

    # ── Insight 3: Category-specific analysis ──
    if company_type == "edtech":
        insights += _edtech_specific_insights(df, total)
    else:
        insights += _professional_specific_insights(df, total)

    # ── Insight 4: Cost-reduction suggestions ──
    insights += _cost_reduction_suggestions(df, company_type)

    return insights[:10]  # Return top 10 most actionable insights


def _edtech_specific_insights(df: pd.DataFrame, total: float) -> list:
    """EdTech-specific insights: marketing efficiency, cloud scaling."""
    insights = []
    cat_totals = df.groupby("category")["amount"].sum()

    marketing = cat_totals.get("marketing", 0)
    cloud = cat_totals.get("cloud", 0)

    if marketing > 0 and cloud > 0:
        ratio = marketing / cloud
        if ratio > 3:
            insights.append({
                "type": "ratio_alert",
                "severity": "medium",
                "category": "marketing",
                "title": "💡 Marketing vs Cloud Imbalance",
                "detail": f"Marketing spend is {ratio:.1f}x higher than cloud infrastructure costs.",
                "recommendation": "High marketing without proportional cloud investment may indicate poor conversion or scaling issues.",
                "metric": round(ratio, 1),
            })

    return insights


def _professional_specific_insights(df: pd.DataFrame, total: float) -> list:
    """Professional services insights: travel efficiency, software audits."""
    insights = []
    cat_totals = df.groupby("category")["amount"].sum()

    travel = cat_totals.get("travel", 0)
    salary = cat_totals.get("salary", 0)

    if salary > 0 and travel / (total or 1) > 0.20:
        insights.append({
            "type": "efficiency",
            "severity": "medium",
            "category": "travel",
            "title": "✈️ High Travel Cost Ratio",
            "detail": f"Travel costs represent {travel/total*100:.1f}% of total spend — above the 20% efficiency threshold.",
            "recommendation": "Implement a pre-approval policy for non-client travel. Target virtual meetings for internal reviews.",
            "metric": round(travel / total * 100, 1),
        })

    software = cat_totals.get("software", 0)
    if software > 0:
        est_waste = software * 0.23  # Industry avg: ~23% of SaaS unused
        insights.append({
            "type": "optimization",
            "severity": "low",
            "category": "software",
            "title": "💻 SaaS Licence Audit Recommended",
            "detail": f"Based on industry benchmarks, ~23% of software spend may be unused licences (est. ₹{est_waste:,.0f}).",
            "recommendation": "Run a licence utilisation audit. Use tools like Torii or Cleanshelf to track SaaS usage.",
            "metric": round(est_waste, 0),
        })

    return insights


def _cost_reduction_suggestions(df: pd.DataFrame, company_type: str) -> list:
    """Generate generic cost reduction suggestions based on spend patterns."""
    suggestions = []
    total = df["amount"].sum()
    cat_totals = df.groupby("category")["amount"].sum()
    top_cat = cat_totals.idxmax() if not cat_totals.empty else None

    if top_cat:
        top_amt = cat_totals[top_cat]
        potential_saving = top_amt * 0.15
        suggestions.append({
            "type": "cost_reduction",
            "severity": "low",
            "category": top_cat,
            "title": f"💰 15% Reduction Opportunity in {top_cat.title()}",
            "detail": f"Optimising your top spend category could save ₹{potential_saving:,.0f}/period.",
            "recommendation": f"Benchmark {top_cat} spend against industry peers. Negotiate volume discounts or find alternative vendors.",
            "metric": round(potential_saving, 0),
        })

    return suggestions


# ─────────────────────────────────────────────
#  Chat Assistant Engine
# ─────────────────────────────────────────────

def chat_with_assistant(message: str, expenses: list, company_type: str) -> str:
    """
    Rule-based + statistical AI chat assistant.
    Interprets natural language questions about expenses.
    """
    df = expenses_to_dataframe(expenses)
    msg_lower = message.lower()

    # ── No data guard ──
    if df.empty:
        return (
            "I don't have any expense data to analyse yet. "
            "Add some transactions using the expense entry form and I'll provide detailed insights!"
        )

    total = df["amount"].sum()
    cat_totals = df.groupby("category")["amount"].sum().sort_values(ascending=False)
    top_cat = cat_totals.index[0] if not cat_totals.empty else "N/A"
    top_amt = cat_totals.iloc[0] if not cat_totals.empty else 0

    # ── Route to intent handler ──
    if _matches(msg_lower, ["overspend", "spend too much", "highest", "most money", "top category"]):
        return _respond_overspending(cat_totals, total, company_type)

    if _matches(msg_lower, ["reduce", "save", "cut", "lower", "optimise", "optimize"]):
        return _respond_cost_reduction(cat_totals, total, company_type)

    if _matches(msg_lower, ["anomal", "unusual", "suspicious", "weird", "outlier"]):
        anomalies = run_anomaly_detection(expenses)
        return _respond_anomalies(anomalies)

    if _matches(msg_lower, ["trend", "month", "over time", "growing", "increasing"]):
        return _respond_trends(df)

    if _matches(msg_lower, ["total", "how much", "sum", "budget", "spent"]):
        return _respond_total(total, len(expenses), top_cat, top_amt)

    if _matches(msg_lower, ["category", "breakdown", "split", "distribution"]):
        return _respond_breakdown(cat_totals, total)

    if _matches(msg_lower, ["hello", "hi", "hey", "help", "what can"]):
        return _respond_greeting(company_type)

    # ── Fallback: keyword extraction ──
    for cat in df["category"].unique():
        if cat in msg_lower:
            cat_data = df[df["category"] == cat]
            amt = cat_data["amount"].sum()
            count = len(cat_data)
            avg = amt / count
            return (
                f"📊 **{cat.title()} Analysis**\n\n"
                f"• Total spent: ₹{amt:,.0f}\n"
                f"• Transactions: {count}\n"
                f"• Average transaction: ₹{avg:,.0f}\n"
                f"• Share of total budget: {amt/total*100:.1f}%\n\n"
                f"💡 {_get_category_tip(cat, company_type)}"
            )

    return (
        "I can help you with: **overspending analysis**, **cost reduction tips**, "
        "**anomaly detection**, **monthly trends**, and **category breakdowns**.\n\n"
        "Try asking: *\"Where am I overspending?\"* or *\"How can I reduce cloud costs?\"*"
    )


def _matches(text: str, keywords: list) -> bool:
    return any(kw in text for kw in keywords)


def _respond_greeting(company_type: str) -> str:
    cats = (
        "Marketing, Cloud, Instructor, and Content"
        if company_type == "edtech"
        else "Travel, Salary, Software, and Office"
    )
    return (
        f"👋 Hi! I'm your FinPulse AI Assistant for **{company_type.title()}** expenses.\n\n"
        f"I'm tracking your spending across **{cats}** categories.\n\n"
        "Here's what I can help you with:\n"
        "• 🔴 *\"Where am I overspending?\"*\n"
        "• 💰 *\"How can I reduce costs?\"*\n"
        "• 🕵️ *\"Show me unusual transactions\"*\n"
        "• 📈 *\"What are my monthly trends?\"*\n"
        "• 📊 *\"Give me a category breakdown\"*"
    )


def _respond_overspending(cat_totals: pd.Series, total: float, company_type: str) -> str:
    top3 = cat_totals.head(3)
    lines = [f"🔴 **Overspending Analysis**\n\nYour top spending areas:\n"]
    for cat, amt in top3.items():
        pct = amt / total * 100
        flag = "🚨" if pct > 40 else "⚠️" if pct > 25 else "✅"
        lines.append(f"{flag} **{cat.title()}**: ₹{amt:,.0f} ({pct:.1f}% of budget)")
    lines.append(f"\n💡 {_get_category_tip(top3.index[0], company_type)}")
    return "\n".join(lines)


def _respond_cost_reduction(cat_totals: pd.Series, total: float, company_type: str) -> str:
    top_cat = cat_totals.index[0]
    top_amt = cat_totals.iloc[0]
    saving_10 = top_amt * 0.10
    saving_15 = top_amt * 0.15

    return (
        f"💰 **Cost Reduction Opportunities**\n\n"
        f"Biggest lever: **{top_cat.title()}** (₹{top_amt:,.0f})\n\n"
        f"• 10% reduction → saves **₹{saving_10:,.0f}**\n"
        f"• 15% reduction → saves **₹{saving_15:,.0f}**\n\n"
        f"🎯 **Actionable Steps:**\n"
        f"1. Audit all {top_cat} vendors for duplicates\n"
        f"2. Renegotiate contracts with top 3 vendors\n"
        f"3. Set a monthly cap alert at 90% of budget\n\n"
        f"💡 {_get_category_tip(top_cat, company_type)}"
    )


def _respond_anomalies(anomalies: list) -> str:
    if not anomalies:
        return "✅ **No anomalies detected!** Your transactions look consistent and within normal patterns."

    lines = [f"🕵️ **{len(anomalies)} Unusual Transaction(s) Detected**\n"]
    for a in anomalies[:3]:
        lines.append(
            f"• ₹{a['amount']:,.0f} in **{a['category'].title()}** — {a['reason']}"
        )
    if len(anomalies) > 3:
        lines.append(f"\n...and {len(anomalies)-3} more. Check the Anomaly panel on the dashboard.")
    lines.append("\n⚡ Review these transactions for approval validity or billing errors.")
    return "\n".join(lines)


def _respond_trends(df: pd.DataFrame) -> str:
    monthly = df.groupby("month")["amount"].sum().sort_index()
    if len(monthly) < 2:
        return "📈 I need at least 2 months of data to show trends. Keep adding expenses!"

    months = list(monthly.index)
    latest = monthly[months[-1]]
    prev = monthly[months[-2]]
    change = (latest - prev) / prev * 100

    direction = "📈 up" if change > 0 else "📉 down"
    emoji = "🚨" if change > 20 else "⚠️" if change > 10 else "✅"

    return (
        f"📊 **Monthly Trends**\n\n"
        f"Latest month ({months[-1]}): ₹{latest:,.0f}\n"
        f"Previous month ({months[-2]}): ₹{prev:,.0f}\n"
        f"Change: {direction} **{abs(change):.1f}%** {emoji}\n\n"
        f"{'⚡ Significant spike — investigate large category changes.' if abs(change) > 20 else '✅ Spending is relatively stable month-over-month.'}"
    )


def _respond_total(total: float, count: int, top_cat: str, top_amt: float) -> str:
    return (
        f"💼 **Spending Summary**\n\n"
        f"• Total expenses: **₹{total:,.0f}**\n"
        f"• Total transactions: **{count}**\n"
        f"• Average per transaction: **₹{total/count:,.0f}**\n"
        f"• Largest category: **{top_cat.title()}** (₹{top_amt:,.0f})\n\n"
        f"Ask me *\"How can I reduce costs?\"* for savings opportunities."
    )


def _respond_breakdown(cat_totals: pd.Series, total: float) -> str:
    lines = ["📊 **Category Breakdown**\n"]
    for cat, amt in cat_totals.items():
        pct = amt / total * 100
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        lines.append(f"**{cat.title()}**\n{bar} {pct:.1f}% — ₹{amt:,.0f}")
    return "\n\n".join(lines)


def _get_category_tip(cat: str, company_type: str) -> str:
    tips = {
        "edtech": {
            "marketing": "Run controlled A/B tests on ad campaigns. Pause underperforming channels immediately.",
            "cloud": "Enable auto-scaling policies and use cost allocation tags to identify waste.",
            "instructor": "Bundle instructor contracts for bulk sessions — negotiate 10–15% volume discount.",
            "content": "Repurpose high-performing content across formats to maximise ROI per production.",
        },
        "professional": {
            "travel": "Implement a travel pre-approval workflow and prefer virtual meetings for non-client interactions.",
            "salary": "Ensure >75% utilisation rate. Consider fractional roles for specialised needs.",
            "software": "Conduct a quarterly SaaS audit. Consolidate overlapping tools.",
            "office": "Analyse desk occupancy. A hot-desking model could reduce office costs by 20–35%.",
        },
    }
    return tips.get(company_type, {}).get(cat, "Review vendor contracts and explore alternatives.")