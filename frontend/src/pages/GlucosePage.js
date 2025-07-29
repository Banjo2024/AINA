import React, { useEffect, useState } from "react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function GlucosePage() {
  const [latest, setLatest] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/glucose/latest")
      .then(res => res.ok ? res.json() : null)
      .then(setLatest);
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    fetch(`http://127.0.0.1:8000/glucose/range?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(res => res.ok ? res.json() : [])
      .then(setData);
  }, []);

  const formatTime = ts => new Date(ts).toLocaleTimeString();

  return (
    <div className="page-container">
      <div className="section-card">
        <h2>Glucose Trends</h2>
        {latest && (
          <div style={{ marginBottom: 10 }}>
            Current value: <b>{latest.glucose}</b>
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} />
            <YAxis />
            <Tooltip labelFormatter={t => new Date(t).toLocaleString()} />
            <Line type="monotone" dataKey="glucose" stroke="#4285f4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
