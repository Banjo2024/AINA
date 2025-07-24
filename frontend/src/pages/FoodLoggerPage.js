import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import React, { useState, useEffect, useMemo } from "react";
import '../App.css';

function getLocalDateTimeString(date = new Date()) {
  const pad = n => n.toString().padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes())
  );
}

function getFoodName(item) {
  return item?.name_fi || item?.name_en || item?.name || "Unknown";
}

export default function FineliNutritionLogger() {
  // Language toggle
  const [language, setLanguage] = useState(() => localStorage.getItem('nutritionLoggerLang') || 'fi');
  useEffect(() => { localStorage.setItem('nutritionLoggerLang', language); }, [language]);

  // Search states
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [grams, setGrams] = useState(100);
  const [loading, setLoading] = useState(false);
  const [dateTime, setDateTime] = useState(() => getLocalDateTimeString());
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Log-by-day states
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date(); return now.toISOString().slice(0, 10);
  });
  const [dayLog, setDayLog] = useState(null);

  // Edit/delete
  const [editId, setEditId] = useState(null);
  const [editGrams, setEditGrams] = useState(100);
  const [deletingId, setDeletingId] = useState(null);

  // Graph toggle
  const [showGraph, setShowGraph] = useState("");

  // --- SUGGESTION SEARCH: Fineli + recipes, both languages ---
  useEffect(() => {
    if (search.length < 2) {
      setSuggestions([]); return;
    }
    setLoading(true);

    const backendFetch = fetch(
      `http://127.0.0.1:8000/search/foods/?q=${encodeURIComponent(search)}&lang=${language}`
    )
      .then(res => res.ok ? res.json() : [])
      .catch(() => []);

    const recipeFetch = fetch(
      `http://127.0.0.1:8000/recipes/`
    )
      .then(res => res.ok ? res.json() : [])
      .catch(() => []);

    Promise.all([backendFetch, recipeFetch])
      .then(([fineliFoods, recipes]) => {
        // Recipes: filter for partial match
        const recipeResults = recipes
          .filter(r =>
            (r.name ?? "").toLowerCase().includes(search.toLowerCase())
          )
          .map(r => ({ ...r, isRecipe: true }));

        // Merge: recipes first, then foods
        setSuggestions([...recipeResults, ...(fineliFoods || [])]);
      })
      .finally(() => setLoading(false));
  }, [search, language]);

  // --- When a suggestion is selected, fetch full details if needed (Fineli details) ---
  useEffect(() => {
    if (!selected) { setDetails(null); return; }
    if (selected.isRecipe) { setDetails(selected); return; }
    setLoading(true);
    if (selected.id) {
      fetch(`https://fineli.fi/fineli/api/v1/foods/${selected.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setDetails({
          ...selected,
          ...data,
          name_fi: selected.name_fi || data?.name?.fi,
          name_en: selected.name_en || data?.name?.en,
        }))
        .finally(() => setLoading(false));
    } else {
      setDetails(selected);
      setLoading(false);
    }
  }, [selected, language]);

  // --- Food Log by Day ---
  function fetchDayLog(dateString) {
    fetch(`http://127.0.0.1:8000/logs/by_day?date=${dateString}`)
      .then(res => res.json())
      .then(data => setDayLog(data))
      .catch(() => setDayLog(null));
  }
  useEffect(() => {
    if (selectedDay) { fetchDayLog(selectedDay); }
  }, [selectedDay]);

  // --- Macro Calculation ---
  function getNutrient(food, id) {
    if (food?.nutrients && Array.isArray(food.nutrients)) {
      let found = food.nutrients.find(n => n.nutrientId === id);
      if (!found) found = food.nutrients.find(n => n.id === id);
      return typeof found?.valuePer100g === "number"
        ? found.valuePer100g
        : Number(found?.valuePer100g) || 0;
    }
    if (food?.isRecipe) {
      switch (id) {
        case 79: return Number(food.protein_100g) || 0;
        case 80: return Number(food.fat_100g) || 0;
        case 82: return Number(food.carbs_100g) || 0;
        case 106: return Number(food.calories_100g) || 0;
        default: return 0;
      }
    }
    switch (id) {
      case 79: return Number(food.protein) || 0;
      case 80: return Number(food.fat) || 0;
      case 82: return Number(food.carbohydrate) || 0;
      case 106: return Number(food.energyKcal) || 0;
      default: return 0;
    }
  }

  const calcMacros = () => {
    if (!details || !grams) return null;
    const g = Number(grams) || 100;
    const scale = g / 100;
    return {
      carbs: Number(getNutrient(details, 82)) * scale || 0,
      protein: Number(getNutrient(details, 79)) * scale || 0,
      fat: Number(getNutrient(details, 80)) * scale || 0,
      calories: Number(getNutrient(details, 106)) * scale || 0,
    };
  };
  const macros = calcMacros();

  // --- Add food or recipe to backend (sends both fi/en names) ---
  const handleAdd = async () => {
    if (!details || !macros) return;
    const g = Number(grams) || 100;
    const payload = details.isRecipe
      ? {
          name: details.name,
          protein: Number(macros.protein) || 0,
          fat: Number(macros.fat) || 0,
          carbs: Number(macros.carbs) || 0,
          calories: Number(macros.calories) || 0,
          grams: g,
          created_at: dateTime,
        }
      : {
          name_fi: details.name_fi || details.name?.fi || "",
          name_en: details.name_en || details.name?.en || "",
          protein: Number(macros.protein) || 0,
          fat: Number(macros.fat) || 0,
          carbs: Number(macros.carbs) || 0,
          calories: Number(macros.calories) || 0,
          grams: g,
          created_at: dateTime,
        };
    const res = await fetch("http://127.0.0.1:8000/foods/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setSearch(""); setSelected(null); setDetails(null); setGrams(100);
      setDateTime(getLocalDateTimeString());
      fetchDayLog(selectedDay);
    } else {
      alert("Failed to add food.");
    }
  };

  // --- Edit/Delete log entries ---
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this food log?")) return;
    setDeletingId(id);
    const res = await fetch(`http://127.0.0.1:8000/foods/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchDayLog(selectedDay);
    } else {
      alert("Failed to delete.");
    }
    setDeletingId(null);
  };

  const startEdit = (food) => { setEditId(food.id); setEditGrams(Number(food.grams)); };
  const cancelEdit = () => { setEditId(null); setEditGrams(100); };
  const handleSaveEdit = async (food) => {
    if (!editGrams || editGrams < 1) {
      alert("Enter grams > 0"); return;
    }
    const res = await fetch(`http://127.0.0.1:8000/foods/${food.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: editGrams }),
    });
    if (res.ok) {
      fetchDayLog(selectedDay); setEditId(null);
    } else {
      alert("Failed to update grams.");
    }
  };

  // --- Graph data calculation ---
  const graphData = useMemo(() => {
    if (!dayLog) return [];
    const hours = {};
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, "0") + ":00";
      hours[hour] = { hour, carbs: 0, fat: 0, protein: 0, calories: 0 };
    }
    for (const food of dayLog.foods) {
      const date = new Date(food.created_at);
      const hour = date.getHours().toString().padStart(2, "0") + ":00";
      hours[hour].carbs += food.carbs;
      hours[hour].fat += food.fat;
      hours[hour].protein += food.protein;
      hours[hour].calories += food.calories;
    }
    return Object.values(hours);
  }, [dayLog]);

  // --- Graph rendering function ---
  function renderGraph(macro) {
    const macroLabels = {
      carbs: "Carbs (g)", fat: "Fat (g)", protein: "Protein (g)", calories: "Calories"
    };
    return (
      <div className="graph-box">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" interval={0} tick={{ fontSize: 12, angle: -45, dy: 10 }} />
            <YAxis label={{ value: macroLabels[macro], angle: -90, position: "insideLeft" }}
                   tickFormatter={value => Math.round(value)} />
            <Tooltip formatter={value => Math.round(value)} labelFormatter={label => label} />
            <Bar dataKey={macro} fill={
              macro === "carbs" ? "#4285f4" :
              macro === "fat" ? "#fbbc05" :
              macro === "protein" ? "#0f9d58" :
              "#db4437"
            } />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ textAlign: "center", fontSize: 14, marginTop: 4, color: "#666" }}>
          {macroLabels[macro]} per hour for {dayLog.date}
        </div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="page-container">
      <h2 className="heading-main">AINA</h2>

      {/* Language Toggle */}
      <div className="flex-row" style={{ marginBottom: 8 }}>
        <button
          className="btn-small"
          style={{
            fontWeight: language === 'fi' ? 'bold' : 'normal',
            background: language === 'fi' ? '#e0ffe0' : 'white'
          }}
          onClick={() => setLanguage('fi')}
        >FI</button>
        <button
          className="btn-small"
          style={{
            fontWeight: language === 'en' ? 'bold' : 'normal',
            background: language === 'en' ? '#e0ffe0' : 'white'
          }}
          onClick={() => setLanguage('en')}
        >EN</button>
      </div>

      {/* Search and Suggestions */}
      <div style={{ position: "relative" }}>
        <input
          className="input"
          value={search}
          placeholder={language === 'fi' ? "Hae ruokia…" : "Search foods…"}
          autoComplete="off"
          onChange={e => {
            setSearch(e.target.value);
            setSelected(null); setDetails(null);
            setDateTime(getLocalDateTimeString());
            setShowSuggestions(true);
          }}
          onFocus={() => { if (search.length > 1 && suggestions.length > 0) setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === "Escape") setShowSuggestions(false); }}
          style={{ width: "100%" }}
        />
        {loading && <div style={{ margin: 6 }}>Loading…</div>}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestion-list">
            {suggestions.slice(0, 10).map(item => (
              <li
                key={(item.id || item.name) + (item.isRecipe ? "-recipe" : "")}
                className="suggestion-item"
                onClick={() => {
                  setSelected(item);
                  setSearch(item.name_fi && item.name_en
                    ? (language === 'fi' ? item.name_fi : item.name_en)
                    : getFoodName(item));
                  setDateTime(getLocalDateTimeString());
                  setShowSuggestions(false);
                }}
              >
                {item.name_fi && item.name_en
                  ? (language === 'fi' ? item.name_fi : item.name_en)
                  : getFoodName(item)}
                {item.isRecipe && <span style={{
                  color: "#0f9d58", fontSize: "0.96em", fontWeight: 600, marginLeft: 6
                }}>[Recipe]</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Food Details and Macro Calculation */}
      {details && (
        <div className="section-card" style={{ background: "#f9f9f9", marginTop: 20, border: "1px solid #e5e5e5" }}>
          <b style={{ fontSize: "1.1em" }}>
            {details.name_fi && details.name_en
              ? (language === 'fi' ? details.name_fi : details.name_en)
              : getFoodName(details)}
          </b>
          <div className="flex-row" style={{ margin: "10px 0" }}>
            <label>
              Grams:&nbsp;
              <input
                className="input"
                type="number"
                min={1}
                value={grams}
                onChange={e => setGrams(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
          </div>
          <ul style={{ paddingLeft: 22, margin: "10px 0" }}>
            <li><b>Carbs:</b> {macros ? macros.carbs.toFixed(2) : "--"}g</li>
            <li><b>Protein:</b> {macros ? macros.protein.toFixed(2) : "--"}g</li>
            <li><b>Fat:</b> {macros ? macros.fat.toFixed(2) : "--"}g</li>
            <li><b>Calories:</b> {macros ? macros.calories.toFixed(2) : "--"}</li>
          </ul>
          <div className="flex-row" style={{ margin: "10px 0" }}>
            <label>
              Date & Time:&nbsp;
              <input
                className="input"
                type="datetime-local"
                value={dateTime}
                onChange={e => setDateTime(e.target.value)}
                max={getLocalDateTimeString()}
                required
              />
            </label>
          </div>
          <button className="btn-main" style={{ marginTop: 6 }} onClick={handleAdd}>
            Add to Log
          </button>
        </div>
      )}

      {/* Log-by-day controls */}
      <h3 className="heading-section" style={{ marginTop: 40 }}>{language === 'fi' ? "Päiväkirja" : "Food Log by Day"}</h3>
      <div className="flex-row" style={{ margin: "20px 0" }}>
        <button className="btn-small" onClick={() => setSelectedDay(new Date().toISOString().slice(0, 10))}>
          {language === 'fi' ? "Tänään" : "Today"}
        </button>
        <input
          className="input"
          type="date"
          value={selectedDay}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => setSelectedDay(e.target.value)}
        />
      </div>
      {dayLog ? (
        <div>
          <h4 className="heading-section" style={{ marginBottom: 6 }}>
            {language === 'fi'
              ? `Ruokakirja ${dayLog.date}`
              : `Food log for ${dayLog.date}`}
          </h4>
          <div className="card-info">
            <b>{language === 'fi' ? "Yhteensä" : "Totals"} for {dayLog.date}:</b><br />
            Protein: <b>{dayLog.totals.protein.toFixed(2)}g</b>,&nbsp;
            Fat: <b>{dayLog.totals.fat.toFixed(2)}g</b>,&nbsp;
            Carbs: <b>{dayLog.totals.carbs.toFixed(2)}g</b>,&nbsp;
            Calories: <b>{dayLog.totals.calories.toFixed(0)}</b>,&nbsp;
            Grams: <b>{dayLog.totals.grams.toFixed(0)}</b>
          </div>
          <div className="flex-row">
            <button className="btn-small" onClick={() => setShowGraph(showGraph === "carbs" ? "" : "carbs")}>Carbs graph</button>
            <button className="btn-small" onClick={() => setShowGraph(showGraph === "fat" ? "" : "fat")}>Fats graph</button>
            <button className="btn-small" onClick={() => setShowGraph(showGraph === "protein" ? "" : "protein")}>Proteins graph</button>
            <button className="btn-small" onClick={() => setShowGraph(showGraph === "calories" ? "" : "calories")}>Calories graph</button>
          </div>
          {showGraph && renderGraph(showGraph)}
          {dayLog.foods.length === 0 ? (
            <div>{language === 'fi' ? "Ei ruokia kirjattu tälle päivälle." : "No foods logged for this day."}</div>
          ) : (
            <ul className="food-log">
              {dayLog.foods.map(food => (
                <li key={food.id} style={{ marginBottom: 10 }}>
                  {editId === food.id ? (
                    <>
                      <b>
                        {food.name_fi && food.name_en
                          ? (language === 'fi' ? food.name_fi : food.name_en)
                          : getFoodName(food)}
                      </b> (
                      <input
                        className="input"
                        type="number"
                        value={editGrams}
                        min={1}
                        style={{ width: 65 }}
                        onChange={e => setEditGrams(Number(e.target.value))}
                        disabled={deletingId === food.id}
                      />
                      g)&nbsp;
                      <button className="btn-small" onClick={() => handleSaveEdit(food)}>Save</button>
                      <button className="btn-small" onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <b>
                        {food.name_fi && food.name_en
                          ? (language === 'fi' ? food.name_fi : food.name_en)
                          : getFoodName(food)}
                      </b> ({food.grams ?? 100}g) —
                      Protein: {food.protein?.toFixed(2)}g,
                      Fat: {food.fat?.toFixed(2)}g,
                      Carbs: {food.carbs?.toFixed(2)}g,
                      Calories: {food.calories?.toFixed(0)}
                      <br />
                      <span style={{ fontSize: "0.95em", color: "#666" }}>
                        {food.created_at
                          ? new Date(food.created_at).toLocaleString('fi-FI', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })
                          : ""}
                      </span>
                      <br />
                      <button className="btn-small" style={{ marginRight: 6 }} onClick={() => startEdit(food)}>Edit</button>
                      <button
                        className="btn-small"
                        onClick={() => handleDelete(food.id)}
                        disabled={deletingId === food.id}
                      >
                        {deletingId === food.id ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>Loading…</div>
      )}
    </div>
  );
}
