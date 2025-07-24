// src/utils/trendsUtils.js

// --- Date Utilities ---

// Convert a Date object to YYYY-MM-DD ISO string
export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

// Returns default range [start, end] for last N days
export function defaultRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return [toISO(start), toISO(end)];
}

// Returns [YYYY-MM-01, today]
export function getCurrentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return [toISO(first), toISO(now)];
}

// Returns [start-of-week (Monday), today]
export function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay() || 7; // Make Sunday = 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  return [toISO(monday), toISO(now)];
}

// Returns array of YYYY-MM-DD from start to end (inclusive)
export function getDaysInRange(startISO, endISO) {
  const arr = [];
  let d = new Date(startISO);
  const end = new Date(endISO);
  while (d <= end) {
    arr.push(toISO(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

// --- Macro Data Helpers ---

// Fills in a daily macro array for the date range, with zeros if missing
export function fillDailyMacros(logs, startISO, endISO) {
  // logs: [{date: YYYY-MM-DD, ...macros}]
  const dayMap = {};
  logs.forEach(item => { dayMap[item.date] = item; });
  return getDaysInRange(startISO, endISO).map(date => (
    dayMap[date]
      ? { ...dayMap[date], date }
      : { date, protein: 0, fat: 0, carbs: 0, calories: 0 }
  ));
}

// --- Hourly (for "Today" view) ---

export function getDayHoursArray() {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
}

// Fills in hourly macro totals for a given day's logs
export function getHourlyMacros(logs, dateISO) {
  const hourly = {};
  logs.forEach(item => {
    const dt = new Date(item.created_at);
    if (dt.toISOString().slice(0, 10) !== dateISO) return;
    const hour = String(dt.getHours()).padStart(2, "0");
    if (!hourly[hour]) hourly[hour] = { protein: 0, fat: 0, carbs: 0, calories: 0 };
    hourly[hour].protein += item.protein;
    hourly[hour].fat += item.fat;
    hourly[hour].carbs += item.carbs;
    hourly[hour].calories += item.calories;
  });
  // Fill missing hours with zeros
  return getDayHoursArray().map(hour => ({
    hour,
    ...["protein", "fat", "carbs", "calories"].reduce(
      (obj, key) => ({ ...obj, [key]: (hourly[hour]?.[key] || 0) }),
      {}
    ),
  }));
}

// --- Grouping helpers ---

// ISO Week number
export function getISOWeek(dateString) {
  const date = new Date(dateString);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Group daily data by week and label with range
// type: "avg" (average per week) or "sum" (total per week)
export function groupByWeekWithRanges(dailyLogs, type = "avg") {
  // Input: [{date, protein, ...}] (daily)
  if (!dailyLogs.length) return [];
  const byWeek = {};
  dailyLogs.forEach(entry => {
    const weekNum = getISOWeek(entry.date);
    const year = entry.date.slice(0, 4);
    const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(entry);
  });
  // Calendar accurate: set label to full week (Monday-Sunday)
  const weekLabels = key => {
    const [year, weekPart] = key.split('-W');
    const week = parseInt(weekPart, 10);
    // First Monday of the year
    const jan4 = new Date(Date.UTC(parseInt(year), 0, 4));
    const firstMonday = new Date(jan4);
    firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
    const weekStart = new Date(firstMonday);
    weekStart.setUTCDate(firstMonday.getUTCDate() + 7 * (week - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    return `${toISO(weekStart)} - ${toISO(weekEnd)}`;
  };

  return Object.entries(byWeek).map(([key, entries]) => {
    // Averages and sums
    const macros = { protein: 0, fat: 0, carbs: 0, calories: 0 };
    entries.forEach(e => {
      macros.protein += e.protein;
      macros.fat += e.fat;
      macros.carbs += e.carbs;
      macros.calories += e.calories;
    });
    const result = {
      weekRange: weekLabels(key),
      weekKey: key,
      ...(
        type === "avg"
          ? Object.fromEntries(Object.entries(macros).map(([k, v]) => [k, v / entries.length]))
          : macros
      )
    };
    return result;
  });
}

// --- Macro calculations ---

// Returns {protein: %, carbs: %, fat: %} (rounded to 1 decimal)
export function getMacroPercentages(arrOrTotals) {
  let protein = 0, carbs = 0, fat = 0;
  if (Array.isArray(arrOrTotals)) {
    arrOrTotals.forEach(row => {
      protein += row.protein || 0;
      carbs += row.carbs || 0;
      fat += row.fat || 0;
    });
  } else {
    protein = arrOrTotals.protein || 0;
    carbs = arrOrTotals.carbs || 0;
    fat = arrOrTotals.fat || 0;
  }
  const total = protein + carbs + fat;
  return total
    ? {
        protein: +(100 * protein / total).toFixed(1),
        carbs: +(100 * carbs / total).toFixed(1),
        fat: +(100 * fat / total).toFixed(1)
      }
    : { protein: 0, carbs: 0, fat: 0 };
}

// Convert kcal to kilojoules (rounded)
export function kcalToKj(kcal) {
  return Math.round((kcal || 0) * 4.184);
}

// --- Grouping logic for Trends Page ---
// Given range array [startISO, endISO], return "single", "day", "week", "month"
export function detectGrouping(rangeArr) {
  const start = new Date(rangeArr[0]);
  const end = new Date(rangeArr[1]);
  const days = Math.round((end - start) / 86400000) + 1;
  if (days === 1) return "single";
  if (days <= 14) return "day";
  if (days <= 60) return "week";
  return "month";
}

// Group daily data by month, with proper labels
export function groupByMonthWithRanges(dailyLogs) {
  if (!dailyLogs.length) return [];
  const byMonth = {};
  dailyLogs.forEach(entry => {
    const month = entry.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(entry);
  });
  return Object.entries(byMonth).map(([key, entries]) => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0].date;
    const end = sorted[sorted.length - 1].date;
    // Average or sum macros as needed
    const sum = { protein: 0, fat: 0, carbs: 0, calories: 0 };
    sorted.forEach(e => {
      sum.protein += e.protein;
      sum.fat += e.fat;
      sum.carbs += e.carbs;
      sum.calories += e.calories;
    });
    // Label like "July 2025" or "2025-07"
    const label = customMonthLabel(key);
    return {
      monthRange: `${start} - ${end}`,
      monthKey: key,
      label,
      ...sum
    };
  });
}

// Optional: Month label helper
export function customMonthLabel(yyyyMM) {
  const [year, month] = yyyyMM.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}
