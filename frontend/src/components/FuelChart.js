import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function FuelChart({ logs = [], plate }) {
  if (!logs.length) return null;

  const sortedLogs = [...logs].sort((a, b) => {
    if (!a.date || !b.date) return 0;
    const [dayA, monthA, yearA] = a.date.split('/');
    const [dayB, monthB, yearB] = b.date.split('/');
    return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
  });

  const consumptionData = [];
  for (let i = 1; i < sortedLogs.length; i++) {
    const prev = sortedLogs[i - 1];
    const curr = sortedLogs[i];
    if (curr.mileage > prev.mileage && curr.fuelInput) {
      const distance = curr.mileage - prev.mileage;
      const efficiency = (curr.fuelInput / distance) * 100;
      consumptionData.push({
        date: curr.date,
        consumption: parseFloat(efficiency.toFixed(2))
      });
    }
  }

  if (!consumptionData.length) return <p>No valid data to plot fuel consumption.</p>;

  const values = consumptionData.map(d => d.consumption);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div style={{ marginTop: '30px', background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
      <h3>Fuel Consumption Trend for {plate}</h3>
      <p>
        <strong>Average:</strong> {avg.toFixed(2)} L/100km &nbsp; | &nbsp;
        <strong>Min:</strong> {min.toFixed(2)} &nbsp; | &nbsp;
        <strong>Max:</strong> {max.toFixed(2)}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={consumptionData}>
          <XAxis dataKey="date" />
          <YAxis
            domain={['auto', 'auto']}
            label={{ value: 'L/100km', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="consumption"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 3 }}
          />

          {/* Reference lines for average, min, max */}
          <ReferenceLine
            y={avg}
            stroke="green"
            strokeDasharray="3 3"
            label={{ position: 'left', value: `Avg: ${avg.toFixed(2)}`, fill: 'green' }}
          />
          <ReferenceLine
            y={min}
            stroke="goldenrod"
            strokeDasharray="3 3"
            label={{ position: 'left', value: `Min: ${min.toFixed(2)}`, fill: 'goldenrod' }}
          />
          <ReferenceLine
            y={max}
            stroke="red"
            strokeDasharray="3 3"
            label={{ position: 'left', value: `Max: ${max.toFixed(2)}`, fill: 'red' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
