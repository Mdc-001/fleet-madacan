import React from 'react';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { saveAs } from 'file-saver';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

export default function AnalyticsPanel({ jobCards }) {
  // Aggregate data
  const taskData = jobCards.flatMap(job => job.tasks || []);
  const technicianStats = {};
  const jobByDay = {};

  let completed = 0;
  let open = 0;

  jobCards.forEach(job => {
    const day = new Date(job.startDate).toLocaleDateString();
    jobByDay[day] = (jobByDay[day] || 0) + 1;

    (job.tasks || []).forEach(task => {
      if (task.completed) completed++;
      else open++;

      if (task.assignedTo) {
        if (!technicianStats[task.assignedTo]) {
          technicianStats[task.assignedTo] = 0;
        }
        technicianStats[task.assignedTo]++;
      }
    });
  });

  const pieData = {
    labels: ['Completed', 'Open'],
    datasets: [{
      data: [completed, open],
      backgroundColor: ['#36A2EB', '#FF6384'],
    }],
  };

  const barData = {
    labels: Object.keys(technicianStats),
    datasets: [{
      label: 'Tasks per Technician',
      data: Object.values(technicianStats),
      backgroundColor: '#4BC0C0',
    }],
  };

  const lineData = {
    labels: Object.keys(jobByDay),
    datasets: [{
      label: 'Jobs per Day',
      data: Object.values(jobByDay),
      borderColor: '#36A2EB',
      fill: false,
    }],
  };

  const exportCSV = () => {
    const headers = "Vehicle,Technician,Start Date,End Date,Task,Assigned To,Completed\n";
    const rows = jobCards.flatMap(job => (job.tasks || []).map(task =>
      `${job.vehicle},${job.mechanic},${job.startDate},${job.endDate},"${task.name}",${task.assignedTo},${task.completed}`
    ));
    const blob = new Blob([headers + rows.join("\n")], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'fleet_report.csv');
  };

  return (
    <div>
      <h2>📈 Visual Analytics</h2>
      <button onClick={exportCSV} style={{ marginBottom: '10px' }}>📤 Export to CSV</button>

      <div style={{ width: '400px', marginBottom: '20px' }}>
        <Pie data={pieData} />
      </div>

      <div style={{ width: '400px', marginBottom: '20px' }}>
        <Bar data={barData} />
      </div>

      <div style={{ width: '400px' }}>
        <Line data={lineData} />
      </div>
    </div>
  );
}
