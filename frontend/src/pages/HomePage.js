import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import '../App.css';

// Helper: Which language to use (from localStorage, fallback 'fi')
function getCurrentLanguage() {
  return localStorage.getItem('nutritionLoggerLang') || 'fi';
}
function getFoodName(food, language) {
  return language === 'fi'
    ? food.name_fi || food.name_en || food.name
    : food.name_en || food.name_fi || food.name;
}
function formatTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function todayString() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "short", day: "numeric" });
}

export default function HomePage() {
  const [totals, setTotals] = useState(null);
  const [dayLog, setDayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`http://127.0.0.1:8000/logs/by_day?date=${today}`)
      .then(res => res.json())
      .then(data => {
        setDayLog(data);
        setTotals(data?.totals || null);
      })
      .catch(() => {
        setDayLog(null);
        setTotals(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-container">
      <div className="card">
        {/* Greeting + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="heading-main">Hello, Viktor!</div>
          <div className="heading-date">{todayString()}</div>
        </div>

        {/* Today’s Summary */}
        <div className="heading-section">--- Today’s Summary ---</div>
        {loading ? (
          <div style={{ textAlign: "center" }}><div className="loader"></div></div>
        ) : totals ? (
          <div className="summary-row">
            <span className="summary-badge">Calories: <b>{Math.round(totals.calories)}</b></span>
            <span className="summary-badge">Protein: <b>{Math.round(totals.protein)}g</b></span>
            <span className="summary-badge">Carbs: <b>{Math.round(totals.carbs)}g</b></span>
            <span className="summary-badge">Fat: <b>{Math.round(totals.fat)}g</b></span>
          </div>
        ) : (
          <div className="text-muted">No foods logged yet.</div>
        )}

        {/* Recent Meals */}
        <div className="heading-section">--- Recent Meals ---</div>
        {dayLog?.foods?.length > 0 ? (
          <ul className="meal-list">
            {dayLog.foods.slice(-3).reverse().map(food => (
              <li key={food.id} style={{ marginBottom: 2 }}>
                <b>{getFoodName(food, getCurrentLanguage())}</b>
                {" "}
                <span className="meal-time">
                  ({formatTime(food.created_at)})
                </span>
                &nbsp;
                <button className="btn-edit" onClick={() => navigate("/food-logger")}>edit</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted">No meals logged today.</div>
        )}

        {/* Action Buttons */}
        <div className="action-row">
          <Link to="/food-logger" className="btn-main">+ Add Food</Link>
          <Link to="/recipes" className="btn-main">Go to Recipes</Link>
          <Link to="/trends" className="btn-main">See Trends</Link>
        </div>

        {/* Ironman Motivation */}
        <div className="info-box">
          Every meal fuels your next Ironman victory. Keep moving forward!
        </div>
      </div>
    </div>
  );
}
