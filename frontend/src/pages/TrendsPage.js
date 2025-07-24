import React, { useEffect, useState } from "react";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import "../App.css";
import {
  toISO,
  defaultRange,
  getCurrentWeekRange,
  getCurrentMonthRange,
  fillDailyMacros,
  groupByWeekWithRanges,
  groupByMonthWithRanges,
  getMacroPercentages,
  kcalToKj,
  detectGrouping,
  getDaysInRange,
  getISOWeek,
} from "../utils/trendsUtils";

// --- Constants ---
const GOAL_KEYS = ["calories", "protein", "carbs", "fat"];
const GOAL_LABELS = {
  calories: "Calories",
  protein: "Protein (g)",
  carbs: "Carbs (g)",
  fat: "Fat (g)"
};
const PIE_COLORS = ["#0f9d58", "#fbbc05", "#db4437"]; // protein, carbs, fat

const activeBtnStyle = {
  background: "#e8f0fe",
  color: "#1967d2",
  borderColor: "#4285f4"
};

// --- LocalStorage helpers ---
function getStoredGoals() {
  try {
    const stored = localStorage.getItem("nutritionGoals");
    if (stored) {
      const parsed = JSON.parse(stored);
      return GOAL_KEYS.reduce((g, k) => ({ ...g, [k]: Number(parsed[k] || 0) }), {});
    }
  } catch (e) {}
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}
function setStoredGoals(goals) {
  localStorage.setItem("nutritionGoals", JSON.stringify(goals));
}

// --- Helpers for missing days ---
function fillWeekDays(data, weekRange) {
  const [start] = weekRange;
  const days = [];
  let d = new Date(start);
  for (let i = 0; i < 7; i++) {
    const iso = toISO(d);
    const found = data.find(x => x.date === iso);
    days.push({
      date: iso,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: found?.calories || 0,
      protein: found?.protein || 0,
      carbs: found?.carbs || 0,
      fat: found?.fat || 0,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function fillMonthDays(data, monthRange) {
  const [start, end] = monthRange;
  const days = [];
  let d = new Date(start);
  while (d <= new Date(end)) {
    const iso = toISO(d);
    const found = data.find(x => x.date === iso);
    days.push({
      date: iso,
      dayLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      calories: found?.calories || 0,
      protein: found?.protein || 0,
      carbs: found?.carbs || 0,
      fat: found?.fat || 0,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// --- Compare UI helpers ---
const COMPARE_TYPES = [
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" }
];
function isoWeekInputVal(weekNum, year) {
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
function tooltipFormatter(value, name) {
  return [Math.round(value), GOAL_LABELS[name] || name];
}

// --- Main Component ---
export default function TrendsPage() {
  // --- State ---
  const [range, setRange] = useState(() => defaultRange(30));
  const [customGroup, setCustomGroup] = useState("day");
  const [customPeriodActive, setCustomPeriodActive] = useState(false);
  const [rangeMode, setRangeMode] = useState("30d");
  const [compareMode, setCompareMode] = useState(false);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [goals, setGoals] = useState(getStoredGoals);
  const [shownMacros, setShownMacros] = useState({ calories: true, protein: true, carbs: true, fat: true });

  // --- Comparison state ---
  const [compareType, setCompareType] = useState("day");
  const today = toISO(new Date());
  function prevMonth(isoDate) {
    const d = new Date(isoDate.slice(0, 7) + "-01");
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  const [comp1, setComp1] = useState({ day: today, week: getISOWeek(today), month: today.slice(0, 7) });
  const [comp2, setComp2] = useState({ day: toISO(new Date(Date.now() - 86400000)), week: getISOWeek(toISO(new Date(Date.now() - 7 * 86400000))), month: prevMonth(today) });
  const [compData1, setCompData1] = useState([]);
  const [compData2, setCompData2] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  // --- Fetch logs ---
  useEffect(() => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/logs/by_range?start=${range[0]}&end=${range[1]}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setLogs(data || []))
      .finally(() => setLoading(false));
  }, [range]);
  useEffect(() => { setStoredGoals(goals); }, [goals]);

  // --- Grouping logic ---
  let grouping = detectGrouping(range);
  const periodDays = getDaysInRange(range[0], range[1]).length;
  if ((rangeMode === "custom" && periodDays > 14) || rangeMode === "month" || rangeMode === "30d") {
    grouping = customGroup;
  }
  let mainData = [];
  if (rangeMode === "today") {
    // Only today's log (don't fill empty days)
    const log = logs.find(x => x.date === range[0]);
    mainData = log
      ? [{
          ...log,
          dayLabel: new Date(range[0]).toLocaleDateString('en-US', { weekday: 'short' }),
        }]
      : [];
  } else if (rangeMode === "week") {
    mainData = fillWeekDays(fillDailyMacros(logs, range[0], range[1]), range);
  } else if (rangeMode === "month" && grouping === "day") {
    mainData = fillMonthDays(fillDailyMacros(logs, range[0], range[1]), range);
  } else if (grouping === "week") {
    mainData = groupByWeekWithRanges(fillDailyMacros(logs, range[0], range[1])).map(w => ({
      ...w,
      weekLabel: w.label || w.weekKey || w.weekRange || `Week`,
    }));
  } else if (grouping === "month") {
    mainData = groupByMonthWithRanges(fillDailyMacros(logs, range[0], range[1])).map(m => ({
      ...m,
      monthLabel: m.label || m.monthKey || m.monthRange || `Month`,
    }));
  } else {
    mainData = fillDailyMacros(logs, range[0], range[1]);
  }

  // --- Macro toggle ---
  function toggleMacro(k) {
    setShownMacros(m => ({ ...m, [k]: !m[k] }));
  }

  // --- Quick range handlers ---
  function setQuickRange(type) {
    if (type === "today") {
      const d = toISO(new Date());
      setRange([d, d]);
      setRangeMode("today");
      setCustomPeriodActive(false);
      setCustomGroup("day");
    }
    if (type === "week") {
      setRange(getCurrentWeekRange());
      setRangeMode("week");
      setCustomPeriodActive(false);
      setCustomGroup("day");
    }
    if (type === "month") {
      setRange(getCurrentMonthRange());
      setRangeMode("month");
      setCustomPeriodActive(false);
      setCustomGroup("day");
    }
    if (type === "30d") {
      setRange(defaultRange(30));
      setRangeMode("30d");
      setCustomPeriodActive(false);
      setCustomGroup("day");
    }
  }

  // --- Comparison data fetch ---
  useEffect(() => {
    if (!compareMode) return;
    setCompareLoading(true);

    const fetchData = async (type, value) => {
      let start, end;
      if (type === "day") {
        start = end = value;
      } else if (type === "week") {
        const year = today.slice(0, 4);
        const d = new Date(year + "-01-01");
        let dayNum = d.getDay() || 7;
        d.setDate(d.getDate() + (1 - dayNum) + (parseInt(value, 10) - 1) * 7);
        start = toISO(d);
        const endD = new Date(d);
        endD.setDate(endD.getDate() + 6);
        end = toISO(endD);
      } else if (type === "month") {
        start = value + "-01";
        const endD = new Date(value + "-01");
        endD.setMonth(endD.getMonth() + 1);
        endD.setDate(0);
        end = toISO(endD);
      }
      const res = await fetch(`http://127.0.0.1:8000/logs/by_range?start=${start}&end=${end}`);
      return res.ok ? await res.json() : [];
    };
    (async () => {
      const data1 = await fetchData(compareType, comp1[compareType]);
      const data2 = await fetchData(compareType, comp2[compareType]);
      setCompData1(data1 || []);
      setCompData2(data2 || []);
      setCompareLoading(false);
    })();
  }, [compareMode, compareType, comp1, comp2, today]);

  // --- Helpers for summary ---
  function periodSummary(data) {
    if (!data.length) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const sums = data.reduce((tot, e) => {
      GOAL_KEYS.forEach(k => { tot[k] += e[k]; });
      return tot;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const avg = {};
    GOAL_KEYS.forEach(k => { avg[k] = sums[k] / data.length; });
    return { ...sums, avg };
  }

  // --- Compare Table components ---
  function CompareTable({ data, shownMacros }) {
    const sum = periodSummary(data);
    const avg = sum.avg || {};
    const perc = getMacroPercentages(sum);
    return (
      <table className="cmp-table" style={{ marginTop: 8, marginBottom: 6, fontSize: 15 }}>
        <thead>
          <tr>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k => (
              <th key={k}>{GOAL_LABELS[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k =>
              <td key={k}>{Math.round(sum[k])}</td>
            )}
          </tr>
          <tr style={{ color: "#888" }}>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k =>
              <td key={k}>avg {avg[k] ? Math.round(avg[k]) : 0}</td>
            )}
          </tr>
          <tr>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k =>
              <td key={k} style={{ fontSize: 13, color: "#aaa" }}>{perc[k]}%</td>
            )}
          </tr>
        </tbody>
      </table>
    );
  }
  function CompareDiffTable({ d1, d2, shownMacros }) {
    const sum1 = periodSummary(d1), sum2 = periodSummary(d2);
    return (
      <table className="cmp-table" style={{ margin: "18px auto 0", fontSize: 15, borderTop: "2px solid #e9e9e9" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Difference</th>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k => <th key={k}>{GOAL_LABELS[k]}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Δ value</td>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k => {
              const diff = (sum1[k] || 0) - (sum2[k] || 0);
              const color = diff > 0 ? "#2c8a1f" : diff < 0 ? "#c21c1c" : "#666";
              return <td key={k} style={{ color }}>{diff > 0 ? "+" : ""}{Math.round(diff)}</td>
            })}
          </tr>
          <tr>
            <td>Δ %</td>
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k => {
              const v1 = sum1[k] || 0, v2 = sum2[k] || 0;
              let perc = v2 === 0 ? null : ((v1 - v2) / Math.abs(v2) * 100);
              const color = perc > 0 ? "#2c8a1f" : perc < 0 ? "#c21c1c" : "#666";
              return <td key={k} style={{ color }}>{perc === null ? "-" : (perc > 0 ? "+" : "") + Math.round(perc) + "%"}</td>
            })}
          </tr>
        </tbody>
      </table>
    );
  }
  // --- Render Compare UI ---
  const renderComparePicker = () => (
    <div className="compare-picker-card" style={{
      margin: "18px 0", padding: 14, background: "#f7fbff",
      borderRadius: 12, border: "1px solid #cbe4f8"
    }}>
      <div style={{ marginBottom: 10, fontWeight: 600 }}>
        Compare:&nbsp;
        {COMPARE_TYPES.map(t => (
          <button
            key={t.value}
            className={`btn-small${compareType === t.value ? " active" : ""}`}
            style={compareType === t.value ? activeBtnStyle : { marginRight: 6 }}
            onClick={() => setCompareType(t.value)}
          >
            {t.label}
          </button>
        ))}
        <button className="btn-small" style={{ float: "right", background: "#fff8f8", color: "#c00", borderColor: "#faa" }} onClick={() => setCompareMode(false)}>
          Close comparison
        </button>
      </div>
      <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginBottom: 10 }}>
        {/* Left period */}
        <div>
          <div style={{ fontWeight: 500 }}>Period 1</div>
          {compareType === "day" && (
            <input type="date" value={comp1.day}
              onChange={e => setComp1(c => ({ ...c, day: e.target.value }))} />
          )}
          {compareType === "week" && (
            <input type="week" value={isoWeekInputVal(comp1.week, new Date().getFullYear())}
              onChange={e => setComp1(c => ({ ...c, week: e.target.value.split("-W")[1] }))} />
          )}
          {compareType === "month" && (
            <input type="month" value={comp1.month}
              onChange={e => setComp1(c => ({ ...c, month: e.target.value }))} />
          )}
        </div>
        {/* Right period */}
        <div>
          <div style={{ fontWeight: 500 }}>Period 2</div>
          {compareType === "day" && (
            <input type="date" value={comp2.day}
              onChange={e => setComp2(c => ({ ...c, day: e.target.value }))} />
          )}
          {compareType === "week" && (
            <input type="week" value={isoWeekInputVal(comp2.week, new Date().getFullYear())}
              onChange={e => setComp2(c => ({ ...c, week: e.target.value.split("-W")[1] }))} />
          )}
          {compareType === "month" && (
            <input type="month" value={comp2.month}
              onChange={e => setComp2(c => ({ ...c, month: e.target.value }))} />
          )}
        </div>
      </div>
      {/* Macro toggles */}
      <div style={{ margin: "10px 0" }}>
        {GOAL_KEYS.map(k =>
          <button
            key={k}
            className={`btn-small${shownMacros[k] ? " active" : ""}`}
            style={shownMacros[k] ? activeBtnStyle : {}}
            onClick={() => toggleMacro(k)}
            title={`Show/hide ${GOAL_LABELS[k]}`}
          >
            {shownMacros[k] ? "✓ " : ""}{GOAL_LABELS[k].split(" ")[0]}
          </button>
        )}
      </div>
      {/* Results */}
      <div style={{ display: "flex", gap: 32, marginTop: 18, flexWrap: "wrap" }}>
        {[{ data: compData1, title: "Period 1" }, { data: compData2, title: "Period 2" }].map((side, idx) => (
          <div key={idx} style={{ minWidth: 320, maxWidth: 400 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{side.title}</div>
            {compareLoading ? <div>Loading…</div>
              : side.data.length === 0 ? <div style={{ color: "#888", margin: 12 }}>No data for selected period.</div>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={
                        fillDailyMacros(side.data, side.data[0]?.date || "2023-01-01", side.data[side.data.length - 1]?.date || "2023-01-01")
                      }>
                        {GOAL_KEYS.filter(k => shownMacros[k]).map((k, i) =>
                          <Bar key={k} dataKey={k} fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][i]} name={GOAL_LABELS[k]} barSize={24} />
                        )}
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                    <CompareTable data={side.data} shownMacros={shownMacros} />
                  </>
                )
            }
          </div>
        ))}
      </div>
      {/* Difference row */}
      <CompareDiffTable d1={compData1} d2={compData2} shownMacros={shownMacros} />
    </div>
  );

  // --- Render ---
  return (
    <div className="page-container">
      {/* CONTROLS */}
      {!compareMode &&
        <div className="section-card trends-controls" style={{ marginBottom: 18 }}>
          <div className="trends-quick-row">
            <label className="trends-label">Quick range:</label>
            {["today", "week", "month", "30d"].map(type => (
              <button
                key={type}
                className={`btn-small${rangeMode === type ? " active" : ""}`}
                onClick={() => setQuickRange(type)}
                style={rangeMode === type ? activeBtnStyle : {}}
              >
                {type === "today" ? "Today" : type === "week" ? "This week" : type === "month" ? "This month" : "Last 30d"}
              </button>
            ))}
            <button
              className={`btn-small${customPeriodActive ? " active" : ""}`}
              style={customPeriodActive ? activeBtnStyle : { marginLeft: 10 }}
              onClick={() => {
                setCustomPeriodActive(v => {
                  if (!v) setRangeMode("custom");
                  else setRangeMode("30d");
                  return !v;
                });
              }}
            >
              {customPeriodActive ? "Close custom period" : "Custom period"}
            </button>
            <button
              className={`btn-small${compareMode ? " active" : ""}`}
              style={compareMode ? activeBtnStyle : { marginLeft: 10 }}
              onClick={() => setCompareMode(true)}
            >
              Compare periods
            </button>
          </div>
          {customPeriodActive && (
            <div className="trends-custom-row" style={{ marginTop: 8 }}>
              <label className="trends-label">Custom period:</label>
              <input
                type="date"
                value={range[0]}
                max={range[1]}
                onChange={e => setRange([e.target.value, range[1]])}
                className="input"
              />
              <span style={{ margin: "0 6px" }}>to</span>
              <input
                type="date"
                value={range[1]}
                min={range[0]}
                max={toISO(new Date())}
                onChange={e => setRange([range[0], e.target.value])}
                className="input"
              />
            </div>
          )}
          {(
            ((rangeMode === "month" || rangeMode === "30d") ||
              (rangeMode === "custom" && periodDays > 14)) &&
            <div style={{ marginTop: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>Group by:</span>
              {["day", "week", "month"].map(g =>
                <button
                  key={g}
                  className={`btn-small${customGroup === g ? " active" : ""}`}
                  style={customGroup === g ? activeBtnStyle : {}}
                  onClick={() => setCustomGroup(g)}
                >{g.charAt(0).toUpperCase() + g.slice(1)}</button>
              )}
            </div>
          )}
        </div>
      }

      {/* --- Compare UI --- */}
      {compareMode && renderComparePicker()}

      {/* --- Macro % Pie --- */}
      {!compareMode && !(rangeMode === "today") && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <PieChart width={360} height={200}>
            <Pie
              data={[
                { name: "Protein", value: getMacroPercentages(periodSummary(mainData)).protein },
                { name: "Carbs", value: getMacroPercentages(periodSummary(mainData)).carbs },
                { name: "Fat", value: getMacroPercentages(periodSummary(mainData)).fat }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}%`}
              innerRadius={48}
              outerRadius={70}
              paddingAngle={4}
              dataKey="value"
              isAnimationActive={false}
            >
              {PIE_COLORS.map((color, idx) => <Cell key={color} fill={color} />)}
            </Pie>
          </PieChart>
        </div>
      )}

      {/* PERIOD AVERAGE SUMMARY */}
      {!compareMode && !(rangeMode === "today") && (
        <div className="section-card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div className="heading-section" style={{ marginBottom: 8, fontWeight: 700 }}>
              Your {grouping === "single" ? "Day" : grouping.charAt(0).toUpperCase() + grouping.slice(1)} Averages
              <span style={{ color: "#888", fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
                ({range[0]} to {range[1]})
              </span>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 4 }}>
              {GOAL_KEYS.map(k =>
                <button
                  key={k}
                  className={`btn-small${shownMacros[k] ? " active" : ""}`}
                  style={shownMacros[k] ? activeBtnStyle : {}}
                  onClick={() => toggleMacro(k)}
                  title={`Show/hide ${GOAL_LABELS[k]}`}
                >
                  {shownMacros[k] ? "✓ " : ""}{GOAL_LABELS[k].split(" ")[0]}
                </button>
              )}
            </div>
          </div>
          <div className="summary-row">
            {GOAL_KEYS.filter(k => shownMacros[k]).map(k => (
              <span key={k} className="summary-badge">
                {GOAL_LABELS[k]}: <b>{Math.round(periodSummary(mainData)[k] || 0)}</b>
                {k === "calories" &&
                  <span style={{ color: "#888", fontSize: 13, marginLeft: 5 }}>
                    ({kcalToKj(periodSummary(mainData).calories)} kJ)
                  </span>
                }
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MAIN GRAPH */}
      {!compareMode && (
        <div className="section-card graph-box" style={{ marginBottom: 20 }}>
          <h4 className="heading-section" style={{ marginBottom: 10 }}>
            {rangeMode === "week"
              ? "Macros per Day"
              : rangeMode === "month" && grouping === "week"
                ? "Macros per Week"
                : rangeMode === "month" && grouping === "day"
                  ? "Macros per Day"
                  : grouping === "week"
                    ? "Macros per Week"
                    : grouping === "month"
                      ? "Macros per Month"
                      : "Macros per Day"}
          </h4>
          {loading
            ? <div className="loader" />
            : mainData.length === 0
              ? <div className="empty-log">No data in this range.</div>
              : (rangeMode === "today")
                ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={mainData}>
                      {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                        <Bar
                          key={k}
                          dataKey={k}
                          fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                          name={GOAL_LABELS[k]}
                          barSize={35}
                        />
                      )}
                      <XAxis dataKey="dayLabel" />
                      <YAxis />
                      <Tooltip formatter={tooltipFormatter} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                )
                // --- BAR chart for week ---
                : (rangeMode === "week")
                  ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={mainData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dayLabel" />
                        <YAxis />
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />
                        {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                          <Bar
                            key={k}
                            dataKey={k}
                            fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                            name={GOAL_LABELS[k]}
                            barSize={18}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )
                  // --- Group by week ---
                  : ((rangeMode === "month" && grouping === "week") || grouping === "week")
                    ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={mainData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="weekLabel" />
                          <YAxis />
                          <Tooltip formatter={tooltipFormatter} />
                          <Legend />
                          {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                            <Bar
                              key={k}
                              dataKey={k}
                              fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                              name={GOAL_LABELS[k]}
                              barSize={18}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    )
                    // --- LINE chart for daily in month ---
                    : (rangeMode === "month" && grouping === "day")
                      ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={mainData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dayLabel" />
                            <YAxis />
                            <Tooltip formatter={tooltipFormatter} />
                            <Legend />
                            {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                              <Line
                                key={k}
                                type="monotone"
                                dataKey={k}
                                stroke={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                                name={GOAL_LABELS[k]}
                                dot={false}
                                isAnimationActive={false}
                                strokeWidth={2}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      )
                      // --- BAR chart for month summary ---
                      : grouping === "month"
                        ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={mainData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="monthLabel" />
                              <YAxis />
                              <Tooltip formatter={tooltipFormatter} />
                              <Legend />
                              {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                                <Bar
                                  key={k}
                                  dataKey={k}
                                  fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                                  name={GOAL_LABELS[k]}
                                  barSize={24}
                                />
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        )
                        // --- Default BAR chart for single-day or short range ---
                        : (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={mainData}>
                              {GOAL_KEYS.filter(k => shownMacros[k]).map((k, idx) =>
                                <Bar
                                  key={k}
                                  dataKey={k}
                                  fill={["#db4437", "#4285f4", "#fbbc05", "#0f9d58"][idx]}
                                  name={GOAL_LABELS[k]}
                                  barSize={35}
                                />
                              )}
                              <XAxis dataKey="dayLabel" />
                              <YAxis />
                              <Tooltip formatter={tooltipFormatter} />
                              <Legend />
                            </BarChart>
                          </ResponsiveContainer>
                        )
          }
        </div>
      )}
    </div>
  );
}
