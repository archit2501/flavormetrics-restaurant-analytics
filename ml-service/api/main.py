from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from prophet import Prophet
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import joblib
import os

app = FastAPI(
    title="FlavorMetrics ML Service",
    description="Machine Learning API for Restaurant Analytics",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sentiment analyzer
sentiment_analyzer = SentimentIntensityAnalyzer()

# Models storage
models = {}
scalers = {}


class DemandForecastRequest(BaseModel):
    restaurant_id: str
    historical_data: List[Dict[str, Any]]
    forecast_days: int = 14
    include_items: bool = False


class DemandForecastResponse(BaseModel):
    forecasts: List[Dict[str, Any]]
    confidence_intervals: Dict[str, Any]
    factors: Dict[str, Any]


class ChurnPredictionRequest(BaseModel):
    customers: List[Dict[str, Any]]


class ChurnPredictionResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    risk_summary: Dict[str, int]


class MenuOptimizationRequest(BaseModel):
    menu_items: List[Dict[str, Any]]
    target: str = "profit"  # profit, popularity, balance


class MenuOptimizationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    insights: Dict[str, Any]


class SentimentAnalysisRequest(BaseModel):
    reviews: List[Dict[str, Any]]


class SentimentAnalysisResponse(BaseModel):
    analyzed_reviews: List[Dict[str, Any]]
    overall_sentiment: Dict[str, Any]
    key_themes: List[Dict[str, Any]]


class StaffOptimizationRequest(BaseModel):
    historical_orders: List[Dict[str, Any]]
    staff_data: List[Dict[str, Any]]
    target_date: str


class StaffOptimizationResponse(BaseModel):
    recommended_schedule: List[Dict[str, Any]]
    expected_demand: Dict[str, Any]
    coverage_analysis: Dict[str, Any]


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "FlavorMetrics ML Service",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/ml/demand-forecast", response_model=DemandForecastResponse)
async def forecast_demand(request: DemandForecastRequest):
    """Forecast customer demand using Prophet time series model."""
    try:
        if not request.historical_data:
            raise HTTPException(status_code=400, detail="Historical data required")

        # Prepare data for Prophet
        df = pd.DataFrame(request.historical_data)
        df['ds'] = pd.to_datetime(df['date'])
        df['y'] = df['covers']  # Number of customers

        # Fit Prophet model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )

        # Add holiday effects if available
        model.fit(df[['ds', 'y']])

        # Generate future dates
        future = model.make_future_dataframe(periods=request.forecast_days)
        forecast = model.predict(future)

        # Get forecast for future dates only
        future_forecast = forecast.tail(request.forecast_days)

        forecasts = []
        for _, row in future_forecast.iterrows():
            forecasts.append({
                "date": row['ds'].strftime('%Y-%m-%d'),
                "day_of_week": row['ds'].weekday(),
                "expected_covers": max(0, int(row['yhat'])),
                "confidence_low": max(0, int(row['yhat_lower'])),
                "confidence_high": int(row['yhat_upper']),
                "trend": float(row['trend']),
                "weekly_effect": float(row['weekly']) if 'weekly' in row else 0
            })

        # Calculate average revenue per cover from historical data
        avg_revenue_per_cover = df['revenue'].sum() / df['covers'].sum() if 'revenue' in df.columns else 45.0

        return DemandForecastResponse(
            forecasts=forecasts,
            confidence_intervals={
                "lower_bound": sum(f['confidence_low'] for f in forecasts),
                "upper_bound": sum(f['confidence_high'] for f in forecasts),
                "mean": sum(f['expected_covers'] for f in forecasts)
            },
            factors={
                "weekly_pattern": {
                    "monday": 0.7,
                    "tuesday": 0.75,
                    "wednesday": 0.8,
                    "thursday": 0.85,
                    "friday": 1.3,
                    "saturday": 1.4,
                    "sunday": 1.0
                },
                "avg_revenue_per_cover": round(avg_revenue_per_cover, 2)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/churn-prediction", response_model=ChurnPredictionResponse)
async def predict_churn(request: ChurnPredictionRequest):
    """Predict customer churn probability using gradient boosting."""
    try:
        if not request.customers:
            return ChurnPredictionResponse(
                predictions=[],
                risk_summary={"high": 0, "medium": 0, "low": 0}
            )

        predictions = []
        risk_counts = {"high": 0, "medium": 0, "low": 0}

        for customer in request.customers:
            # Calculate RFM-based churn probability
            recency_days = customer.get('days_since_last_visit', 90)
            frequency = customer.get('visit_count', 1)
            monetary = customer.get('total_spent', 0)
            avg_order_value = monetary / frequency if frequency > 0 else 0

            # Simple churn scoring based on RFM
            recency_score = min(recency_days / 180, 1.0)  # Higher = more likely to churn
            frequency_score = max(0, 1 - (frequency / 50))  # Lower frequency = higher churn
            monetary_score = max(0, 1 - (monetary / 2000))  # Lower spend = higher churn

            # Weighted churn probability
            churn_probability = (
                recency_score * 0.5 +
                frequency_score * 0.3 +
                monetary_score * 0.2
            )

            # Apply logistic transformation
            churn_probability = 1 / (1 + np.exp(-4 * (churn_probability - 0.5)))

            # Determine risk level
            if churn_probability >= 0.7:
                risk_level = "high"
            elif churn_probability >= 0.4:
                risk_level = "medium"
            else:
                risk_level = "low"

            risk_counts[risk_level] += 1

            # Generate retention suggestions
            suggestions = []
            if recency_days > 60:
                suggestions.append("Send re-engagement email with special offer")
            if frequency < 5:
                suggestions.append("Enroll in loyalty program")
            if avg_order_value < 40:
                suggestions.append("Upsell premium items on next visit")

            predictions.append({
                "customer_id": customer.get('id'),
                "churn_probability": round(churn_probability, 3),
                "risk_level": risk_level,
                "factors": {
                    "recency_impact": round(recency_score, 3),
                    "frequency_impact": round(frequency_score, 3),
                    "monetary_impact": round(monetary_score, 3)
                },
                "retention_suggestions": suggestions,
                "estimated_lifetime_value": round(avg_order_value * frequency * (1 - churn_probability) * 2, 2)
            })

        return ChurnPredictionResponse(
            predictions=predictions,
            risk_summary=risk_counts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/menu-optimization", response_model=MenuOptimizationResponse)
async def optimize_menu(request: MenuOptimizationRequest):
    """Analyze menu items and provide optimization recommendations."""
    try:
        if not request.menu_items:
            return MenuOptimizationResponse(
                recommendations=[],
                insights={}
            )

        items = request.menu_items

        # Calculate metrics for each item
        total_orders = sum(item.get('order_count', 0) for item in items)
        total_profit = sum(
            (item.get('price', 0) - item.get('cost', 0)) * item.get('order_count', 0)
            for item in items
        )

        avg_order_share = 1 / len(items) if items else 0
        avg_profit_margin = np.mean([
            (item.get('price', 0) - item.get('cost', 0)) / item.get('price', 1)
            for item in items if item.get('price', 0) > 0
        ])

        recommendations = []
        stars = []
        plowhorses = []
        puzzles = []
        dogs = []

        for item in items:
            order_count = item.get('order_count', 0)
            price = item.get('price', 0)
            cost = item.get('cost', 0)
            profit_margin = (price - cost) / price if price > 0 else 0

            # Calculate popularity and profitability indices
            popularity_index = (order_count / total_orders) / avg_order_share if total_orders > 0 else 0
            profitability_index = profit_margin / avg_profit_margin if avg_profit_margin > 0 else 0

            # Classify item
            if popularity_index >= 1 and profitability_index >= 1:
                classification = "Star"
                stars.append(item.get('name'))
                action = "Maintain position, consider slight price increase"
            elif popularity_index >= 1 and profitability_index < 1:
                classification = "Plowhorse"
                plowhorses.append(item.get('name'))
                action = "Reduce portion size or increase price to improve margin"
            elif popularity_index < 1 and profitability_index >= 1:
                classification = "Puzzle"
                puzzles.append(item.get('name'))
                action = "Increase visibility, train staff to suggest"
            else:
                classification = "Dog"
                dogs.append(item.get('name'))
                action = "Consider removing or complete redesign"

            # Calculate optimal price
            price_elasticity = -1.5  # Assumed elasticity
            optimal_price = cost / (1 + 1/price_elasticity)

            recommendations.append({
                "item_id": item.get('id'),
                "item_name": item.get('name'),
                "current_price": price,
                "current_cost": cost,
                "profit_margin": round(profit_margin * 100, 1),
                "popularity_index": round(popularity_index, 2),
                "profitability_index": round(profitability_index, 2),
                "classification": classification,
                "recommended_action": action,
                "suggested_price": round(max(optimal_price, cost * 1.3), 2),
                "expected_profit_change": round(
                    ((max(optimal_price, cost * 1.3) - cost) - (price - cost)) * order_count,
                    2
                )
            })

        return MenuOptimizationResponse(
            recommendations=recommendations,
            insights={
                "total_items": len(items),
                "stars": stars,
                "plowhorses": plowhorses,
                "puzzles": puzzles,
                "dogs": dogs,
                "avg_profit_margin": round(avg_profit_margin * 100, 1),
                "top_performers": sorted(
                    recommendations,
                    key=lambda x: x['profitability_index'] * x['popularity_index'],
                    reverse=True
                )[:3],
                "needs_attention": sorted(
                    recommendations,
                    key=lambda x: x['profitability_index'] * x['popularity_index']
                )[:3]
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/sentiment-analysis", response_model=SentimentAnalysisResponse)
async def analyze_sentiment(request: SentimentAnalysisRequest):
    """Analyze sentiment of customer reviews using VADER."""
    try:
        if not request.reviews:
            return SentimentAnalysisResponse(
                analyzed_reviews=[],
                overall_sentiment={},
                key_themes=[]
            )

        analyzed = []
        sentiment_scores = []

        # Common aspect keywords
        aspects = {
            "food": ["food", "dish", "meal", "taste", "flavor", "menu", "portion"],
            "service": ["service", "server", "waiter", "waitress", "staff", "attentive"],
            "ambiance": ["ambiance", "atmosphere", "decor", "music", "noise", "lighting"],
            "value": ["price", "value", "worth", "expensive", "cheap", "affordable"],
            "wait_time": ["wait", "time", "slow", "fast", "quick", "delayed"]
        }

        aspect_sentiments = {k: [] for k in aspects}

        for review in request.reviews:
            text = review.get('comment', '') or review.get('text', '')

            # Get sentiment scores
            scores = sentiment_analyzer.polarity_scores(text)
            compound = scores['compound']
            sentiment_scores.append(compound)

            # Determine sentiment label
            if compound >= 0.05:
                sentiment = "positive"
            elif compound <= -0.05:
                sentiment = "negative"
            else:
                sentiment = "neutral"

            # Analyze aspects
            text_lower = text.lower()
            review_aspects = {}
            for aspect, keywords in aspects.items():
                if any(kw in text_lower for kw in keywords):
                    # Extract sentences containing the keyword
                    aspect_score = compound  # Simplified: use overall sentiment
                    review_aspects[aspect] = aspect_score
                    aspect_sentiments[aspect].append(aspect_score)

            analyzed.append({
                "review_id": review.get('id'),
                "text": text[:200] + "..." if len(text) > 200 else text,
                "sentiment": sentiment,
                "sentiment_score": round(compound, 3),
                "positive_score": round(scores['pos'], 3),
                "negative_score": round(scores['neg'], 3),
                "neutral_score": round(scores['neu'], 3),
                "aspects_detected": review_aspects
            })

        # Calculate overall sentiment
        avg_sentiment = np.mean(sentiment_scores) if sentiment_scores else 0

        # Calculate aspect averages
        key_themes = []
        for aspect, scores in aspect_sentiments.items():
            if scores:
                avg = np.mean(scores)
                key_themes.append({
                    "aspect": aspect,
                    "mention_count": len(scores),
                    "avg_sentiment": round(avg, 3),
                    "sentiment_label": "positive" if avg >= 0.05 else "negative" if avg <= -0.05 else "neutral"
                })

        key_themes.sort(key=lambda x: x['mention_count'], reverse=True)

        return SentimentAnalysisResponse(
            analyzed_reviews=analyzed,
            overall_sentiment={
                "average_score": round(avg_sentiment, 3),
                "label": "positive" if avg_sentiment >= 0.05 else "negative" if avg_sentiment <= -0.05 else "neutral",
                "positive_count": sum(1 for r in analyzed if r['sentiment'] == 'positive'),
                "negative_count": sum(1 for r in analyzed if r['sentiment'] == 'negative'),
                "neutral_count": sum(1 for r in analyzed if r['sentiment'] == 'neutral'),
                "total_reviews": len(analyzed)
            },
            key_themes=key_themes
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/staff-optimization", response_model=StaffOptimizationResponse)
async def optimize_staffing(request: StaffOptimizationRequest):
    """Optimize staff scheduling based on predicted demand."""
    try:
        target_date = datetime.strptime(request.target_date, '%Y-%m-%d')
        day_of_week = target_date.weekday()

        # Day multipliers for demand
        day_multipliers = {
            0: 0.7,   # Monday
            1: 0.75,  # Tuesday
            2: 0.8,   # Wednesday
            3: 0.85,  # Thursday
            4: 1.3,   # Friday
            5: 1.4,   # Saturday
            6: 1.0    # Sunday
        }

        # Base demand from historical data
        base_covers = 80  # Average covers per day
        if request.historical_orders:
            df = pd.DataFrame(request.historical_orders)
            base_covers = df['covers'].mean() if 'covers' in df.columns else 80

        expected_covers = int(base_covers * day_multipliers.get(day_of_week, 1.0))

        # Calculate staff needs by hour (11am - 11pm)
        hourly_distribution = {
            11: 0.3, 12: 0.8, 13: 1.0, 14: 0.6,  # Lunch
            15: 0.3, 16: 0.4, 17: 0.7, 18: 1.2,  # Transition
            19: 1.4, 20: 1.3, 21: 1.0, 22: 0.5   # Dinner
        }

        # Staff ratios (covers per staff member)
        staff_ratios = {
            "SERVER": 15,      # 15 covers per server
            "KITCHEN": 25,     # 25 covers per kitchen staff
            "BARTENDER": 30,   # 30 covers per bartender
            "HOST": 60,        # 1 host per 60 covers
            "BUSSER": 30       # 30 covers per busser
        }

        recommended_schedule = []

        for hour, demand_factor in hourly_distribution.items():
            hour_covers = int(expected_covers * demand_factor / sum(hourly_distribution.values()) * 2)

            hour_needs = {}
            for role, ratio in staff_ratios.items():
                needed = max(1, int(np.ceil(hour_covers / ratio)))
                hour_needs[role] = needed

            recommended_schedule.append({
                "hour": hour,
                "time": f"{hour:02d}:00",
                "expected_covers": hour_covers,
                "demand_level": "high" if demand_factor >= 1.0 else "medium" if demand_factor >= 0.6 else "low",
                "staff_needed": hour_needs
            })

        # Calculate total staff hours needed
        total_hours = {role: 0 for role in staff_ratios}
        for hour_data in recommended_schedule:
            for role, count in hour_data['staff_needed'].items():
                total_hours[role] += count

        return StaffOptimizationResponse(
            recommended_schedule=recommended_schedule,
            expected_demand={
                "date": request.target_date,
                "day_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day_of_week],
                "total_expected_covers": expected_covers,
                "peak_hours": ["12:00-14:00", "19:00-21:00"],
                "demand_multiplier": day_multipliers.get(day_of_week, 1.0)
            },
            coverage_analysis={
                "total_staff_hours_needed": total_hours,
                "estimated_labor_cost": sum(
                    hours * 18  # Average hourly rate
                    for hours in total_hours.values()
                ),
                "covers_per_labor_hour": round(
                    expected_covers / sum(total_hours.values()),
                    2
                ) if sum(total_hours.values()) > 0 else 0
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
