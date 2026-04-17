// src/pages/DashboardAnalytics.js
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardAnalytics() {
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [dateRange, setDateRange] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [comparison, setComparison] = useState(null);
  const [vehicleJobCounts, setVehicleJobCounts] = useState([]);

  useEffect(() => {
  const unsubVehicles = onSnapshot(collection(db, 'vehicles'), async (snap) => {
    const vehicleDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setVehicles(vehicleDocs);

    const allJobs = [];
    const unsubJobsList = [];

    for (const vehicle of vehicleDocs) {
      const jobsRef = collection(db, 'vehicles', vehicle.id, 'jobs');
      const unsub = onSnapshot(jobsRef, (jobSnap) => {
        const jobsForVehicle = jobSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          vehicleId: vehicle.id,
          plate: vehicle.plate || 'Unknown'
        }));
        allJobs.push(...jobsForVehicle);
        setJobs(prev => [...prev.filter(j => j.vehicleId !== vehicle.id), ...jobsForVehicle]);
      });
      unsubJobsList.push(unsub);
    }

    // Unsubscribe cleanup
    return () => unsubJobsList.forEach(unsub => unsub());
  });

  return () => unsubVehicles();
}, []);


  useEffect(() => {
    let result = [...jobs];

    if (selectedVehicle !== 'All') {
      result = result.filter(job => job.vehicleId === selectedVehicle);
    }

    if (dateRange !== 'All') {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - Number(dateRange));

      result = result.filter(job => {
        const created = job.createdAt?.seconds
          ? new Date(job.createdAt.seconds * 1000)
          : job.createdAt?.toDate?.();
        return created >= cutoff;
      });
    }

    result.sort((a, b) => {
      const getDate = (d) => d?.seconds ? new Date(d.seconds * 1000) : d?.toDate?.() || new Date(0);
      const dateA = getDate(a.createdAt);
      const dateB = getDate(b.createdAt);

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'priority') return (b.priority || '').localeCompare(a.priority || '');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      return 0;
    });

    setFilteredJobs(result);

    const countMap = {};
    result.forEach(job => {
      countMap[job.vehicleId] = (countMap[job.vehicleId] || 0) + 1;
    });

    const counts = Object.entries(countMap).map(([vid, count]) => {
      const vehicle = vehicles.find(v => v.id === vid);
      return {
        plate: vehicle?.plate || vid,
        count
      };
    }).sort((a, b) => b.count - a.count);

    setVehicleJobCounts(counts);
  }, [jobs, selectedVehicle, dateRange, sortBy, vehicles]);

  useEffect(() => {
    if (dateRange === '7' || dateRange === '30') {
      const now = new Date();
      const currentCutoff = new Date(now);
      currentCutoff.setDate(now.getDate() - Number(dateRange));

      const previousCutoff = new Date(currentCutoff);
      previousCutoff.setDate(previousCutoff.getDate() - Number(dateRange));

      const currentJobs = jobs.filter(job => {
        const created = job.createdAt?.seconds
          ? new Date(job.createdAt.seconds * 1000)
          : job.createdAt?.toDate?.();
        return created >= currentCutoff;
      });

      const previousJobs = jobs.filter(job => {
        const created = job.createdAt?.seconds
          ? new Date(job.createdAt.seconds * 1000)
          : job.createdAt?.toDate?.();
        return created >= previousCutoff && created < currentCutoff;
      });

      const diff = currentJobs.length - previousJobs.length;
      const percentChange = previousJobs.length > 0
        ? ((diff / previousJobs.length) * 100).toFixed(1)
        : 'N/A';

      setComparison({
        current: currentJobs.length,
        previous: previousJobs.length,
        percentChange
      });
    } else {
      setComparison(null);
    }
  }, [jobs, dateRange]);

  const statusCounts = filteredJobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  const approvalCounts = filteredJobs.reduce((acc, job) => {
    acc[job.approvalStatus] = (acc[job.approvalStatus] || 0) + 1;
    return acc;
  }, {});

  const dataByDate = filteredJobs.reduce((acc, job) => {
    const dateObj = job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : job.createdAt?.toDate?.();
    const dateLabel = dateObj?.toLocaleDateString() || 'Unknown';
    acc[dateLabel] = (acc[dateLabel] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(dataByDate).map(([date, count]) => ({ date, jobs: count }));
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AB47BC'];

  const handleExportCSV = () => {
    const csv = [['Description', 'Status', 'Approval Status', 'Vehicle ID', 'Created At']];
    filteredJobs.forEach(job => {
      const createdAt = job.createdAt?.seconds
        ? new Date(job.createdAt.seconds * 1000).toLocaleString()
        : job.createdAt?.toDate?.().toLocaleString() || 'N/A';
      csv.push([job.description, job.status, job.approvalStatus, job.vehicleId, createdAt]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csv.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'dashboard_jobs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>📊 Dashboard Analytics</h2>
      <button onClick={() => setFiltersOpen(prev => !prev)} style={{ marginBottom: '10px' }}>
        {filtersOpen ? '⬆ Hide Filters' : '⬇ Show Filters'}
      </button>

      {filtersOpen && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <label><strong>Chart Type:</strong></label><br />
            <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie (Status)</option>
            </select>
          </div>

          <div>
            <label><strong>Filter by Vehicle:</strong></label><br />
            <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}>
              <option value="All">All</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate}</option>
              ))}
            </select>
          </div>

          <div>
            <label><strong>Date Range:</strong></label><br />
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="All">All</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>

          <div>
            <label><strong>Sort Jobs:</strong></label><br />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Created (Newest)</option>
              <option value="oldest">Created (Oldest)</option>
              <option value="priority">Priority (High→Low)</option>
              <option value="status">Status (A→Z)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <button onClick={handleExportCSV}>⬇ Export CSV</button>
          </div>
        </div>
      )}

      {comparison && (
        <div style={{ marginBottom: '20px' }}>
          📈 <strong>Change vs previous {dateRange} days:</strong> {comparison.current} jobs
          {comparison.percentChange !== 'N/A' && ` (${comparison.percentChange}% vs previous)`}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={cardStyle}><strong>Total Vehicles</strong><div>{vehicles.length}</div></div>
        <div style={cardStyle}><strong>Total Jobs</strong><div>{filteredJobs.length}</div></div>
        <div style={cardStyle}>
          <strong>Jobs by Status</strong>
          {Object.entries(statusCounts).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
        </div>
        <div style={cardStyle}>
          <strong>Approval Status</strong>
          {Object.entries(approvalCounts).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
        </div>
      </div>

      {filteredJobs.length === 0 ? <p>No jobs match your criteria.</p> : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="50%" height="100%">
            {chartType === 'bar' && (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jobs" fill="#82ca9d" name="Jobs" />
              </BarChart>
            )}

            {chartType === 'line' && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="jobs" stroke="#8884d8" strokeWidth={2} name="Jobs" />
              </LineChart>
            )}

            {chartType === 'pie' && (
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={Object.entries(statusCounts).map(([k, v]) => ({ name: k, value: v }))}
                     dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {Object.entries(statusCounts).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginTop: '40px' }}>
        <h3>🚗 Jobs per Vehicle</h3>
        {vehicleJobCounts.length === 0 ? <p>No jobs to display</p> : (
          <ResponsiveContainer width="50%" height={300}>
            <BarChart data={vehicleJobCounts} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="plate" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Job Count" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  padding: '16px',
  background: '#f0f4f8',
  border: '1px solid #ccc',
  borderRadius: '8px',
  minWidth: '200px'
};
