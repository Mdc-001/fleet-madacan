import React, { useState } from 'react';
import { parseISO, isAfter, isBefore } from 'date-fns';

export default function Dashboard({ jobCards }) {
  const [selectedTech, setSelectedTech] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredJobs = jobCards.filter(job => {
    const jobStart = parseISO(job.startDate || '');
    const matchTech = selectedTech === '' || job.mechanic === selectedTech;
    const matchStart = startDate === '' || !isBefore(jobStart, parseISO(startDate));
    const matchEnd = endDate === '' || !isAfter(jobStart, parseISO(endDate));
    return matchTech && matchStart && matchEnd;
  });

  let totalTasks = 0;
  let completedTasks = 0;
  const techStats = {};

  filteredJobs.forEach(job => {
    job.tasks.forEach(task => {
      totalTasks += 1;
      if (task.completed) completedTasks += 1;

      if (task.assignedTo) {
        if (!techStats[task.assignedTo]) {
          techStats[task.assignedTo] = { total: 0, completed: 0 };
        }
        techStats[task.assignedTo].total += 1;
        if (task.completed) techStats[task.assignedTo].completed += 1;
      }
    });
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <h2>📊 Dashboard Overview</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>Filter by Technician: </label>
        <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
          <option value="">All</option>
          <option value="MR MAHEFA">MR MAHEFA</option>
          <option value="MR DERA">MR DERA</option>
          <option value="MR EMILE">MR EMILE</option>
          <option value="MR JULIEN">MR JULIEN</option>
          <option value="MR ANTOINE">MR ANTOINE</option>
          <option value="MR ELYSEE">MR ELYSEE</option>
          <option value="MR SOLOFO">MR SOLOFO</option>
          <option value="MR NJAKA">MR NJAKA</option>
          <option value="MR VELOTIANA">MR VELOTIANA</option>
          <option value="MR DIMBY">MR DIMBY</option>
          <option value="MR FRANCK">MR FRANCK</option>
          <option value="MR ROCHIN">MR ROCHIN</option>
          <option value="MR NOMENA">MR NOMENA</option>
          <option value="MR VICTOR">MR VICTOR</option>
          <option value="MR ROMUALD">MR ROMUALD</option>
          <option value="MR CLERISS">MR CLERISS</option>
          <option value="MR JEAN AIME">MR JEAN AIME</option>
          <option value="MR DENIS">MR DENIS</option>
          <option value="MR NIVO">MR NIVO</option>
          <option value="MR MAMITIANA">MR MAMITIANA</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>From: </label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label style={{ marginLeft: '10px' }}>To: </label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <p><strong>Total Jobs:</strong> {filteredJobs.length}</p>
      <p><strong>Total Tasks:</strong> {totalTasks}</p>
      <p><strong>Completed Tasks:</strong> {completedTasks}</p>

      <h3>👨‍🔧 Technician Performance</h3>
      {Object.entries(techStats).map(([tech, stats]) => (
        <p key={tech}>
          <strong>{tech}</strong>: {stats.completed}/{stats.total} tasks completed
        </p>
      ))}
    </div>
  );
}
