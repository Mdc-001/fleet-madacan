import { Link } from 'react-router-dom';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDoc, onSnapshot, getDocs
} from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import Select from 'react-select';
import ExportOptions from '../components/ExportOptions';

// ✅ PLACE HERE
const inputStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  fontSize: '14px',
  minWidth: '180px',
  outline: 'none',
  backgroundColor: '#f9f9f9',
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  transition: 'border-color 0.2s ease',
};

const inputFocusStyle = {
  ...inputStyle,
  borderColor: '#2196f3',
  boxShadow: '0 0 0 2px rgba(33, 150, 243, 0.2)',
};

export default function ApprovalDashboard() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState('');
  const { user, role, loading } = useContext(AuthContext);
 const [showExportModal, setShowExportModal] = useState(false);
  const allVehicles = vehicles.filter(v => !v.isTest); // only count non-test vehicles
const visibleVehicles = vehicles.filter(v => !v.isTest); // excludes test vehicles

 useEffect(() => {
  if (loading || !user || role !== 'Approval') return;

  const unsub = onSnapshot(collection(db, 'vehicles'), async (snapshot) => {
    const vehicleList = await Promise.all(snapshot.docs.map(async (vehicleDoc) => {
      const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs'));

      const jobs = await Promise.all(jobsSnap.docs.map(async (jobDoc) => {
        const jobData = { id: jobDoc.id, ...jobDoc.data() };
        const tasksSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs', jobDoc.id, 'tasks'));
        const tasks = tasksSnap.docs.map(t => t.data());
        const isCompleted = tasks.length > 0 && tasks.every(t => t.completed);
        return { ...jobData, isCompleted };
      }));

      const waitingCount = jobs.filter(j =>
        j.finalApprovalStatus === 'Waiting' && j.adminApprovalStatus === 'Approved'
      ).length;

      const notCompletedCount = jobs.filter(j => !j.isCompleted).length;

      return {
        id: vehicleDoc.id,
        ...vehicleDoc.data(),
        jobs,
        waitingCount,
        notCompletedCount
      };
    }));

    vehicleList.sort((a, b) => {
      const getPriorityValue = (priority) => {
        if (priority === 'High') return 3;
        if (priority === 'Medium') return 2;
        if (priority === 'Low') return 1;
        return 0;
      };

      const aWaitingJobs = a.jobs.filter(j => j.adminApprovalStatus === 'Approved' && j.finalApprovalStatus === 'Waiting');
      const bWaitingJobs = b.jobs.filter(j => j.adminApprovalStatus === 'Approved' && j.finalApprovalStatus === 'Waiting');

      if (aWaitingJobs.length && !bWaitingJobs.length) return -1;
      if (!aWaitingJobs.length && bWaitingJobs.length) return 1;

      if (aWaitingJobs.length && bWaitingJobs.length) {
        const aMax = Math.max(...aWaitingJobs.map(j => getPriorityValue(j.priority)));
        const bMax = Math.max(...bWaitingJobs.map(j => getPriorityValue(j.priority)));
        return bMax - aMax;
      }

      return b.jobs.length - a.jobs.length;
    });

    setVehicles(vehicleList);
  });

  return () => unsub();
}, [loading, user, role]);


  const updateApprovalStatus = async (vehicleId, jobId, newStatus) => {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), {
      approvalStatus: newStatus
    });
  };

  const badgeStyle = (type) => ({
    backgroundColor: type === 'Unknown' ? '#fdd835' : '#90caf9',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '0.8rem'
  });

  const getBadgeStyle = (status) => {
    const colors = {
      Approved: 'green',
      Rejected: 'red',
      Waiting: 'gray',
      Scheduled: '#0277bd',
      'In Progress': '#f9a825',
      Completed: '#2e7d32',
      Archived: '#6d4c41'
    };
    return {
      backgroundColor: colors[status] || 'gray',
      color: 'white',
      borderRadius: '4px',
      padding: '2px 6px',
      fontSize: '0.8rem',
      marginLeft: '5px'
    };
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(filter.toLowerCase()) ||
    v.type.toLowerCase().includes(filter.toLowerCase())
  );

  const typeCounts = visibleVehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <Header />
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Approval Dashboard</h2>
        <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
    All jobs on vehicles must be recorded here. Only jobs with PR need approval.
  </p>

        <div
  style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  }}
>
  <Link to="/dashboard-analytics">
    <button
      style={{
        backgroundColor: '#2196f3',
        color: 'white',
        padding: '10px 16px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      📊 Go to Analytics Dashboard
    </button>
  </Link>

  <Link to="/warehouse-dashboard">
    <button
      style={{
        backgroundColor: '#4caf50',
        color: 'white',
        padding: '10px 16px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      🏷️ Go to Warehouse Dashboard
    </button>
  </Link>

  <button
    onClick={() => navigate('/maintenance-follow-up')}
    style={{
      backgroundColor: '#757575',
      color: 'white',
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: 'bold',
    }}
  >
    🛢 Mileage & Lubrification Tracking
  </button>
</div>


           <div
  style={{
    marginBottom: '20px',
    padding: '16px',
    border: '1px solid #ddd',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  }}
>
  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', color: '#333' }}>
    🚗 Total Vehicles: {allVehicles.length}
  </div>

  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    }}
  >
    {Object.entries(typeCounts).map(([type, count]) => (
      <div
        key={type}
        style={{
          padding: '8px 14px',
          backgroundColor: '#e3f2fd',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#1976d2',
          boxShadow: 'inset 0 0 2px rgba(0,0,0,0.05)',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>{type}</span>: {count}
      </div>
    ))}
  </div>
</div>


        <div style={{ width: '100%', textAlign: 'left', marginBottom: '20px' }}>
  <input
    type="text"
    placeholder="Search plate or type..."
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    style={{
      padding: '6px 10px',
      width: '300px',
      border: '1px solid #ccc',
      borderRadius: '6px'
    }}
  />
   <button
          onClick={() => setShowExportModal(true)}
          style={{
            padding: '10px 16px',
            backgroundColor: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'background-color 0.3s ease',
            marginLeft: '12px'
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = '#1976d2')}
          onMouseLeave={(e) => (e.target.style.backgroundColor = '#2196f3')}
        >
          
          📥 Export
        </button>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingLeft: '40px'
      }}>
</div>



        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {filteredVehicles.map(vehicle => (
            <div
  key={vehicle.id}
  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
  style={{
    border: '1px solid #ccc',
    borderRadius: '12px',
    padding: '16px',
    width: '260px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    position: 'relative',
    textAlign: 'left',
    cursor: 'pointer', // 👈 makes it obvious it’s clickable
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
  }}
>
  

              <div><strong>🚗 Plate:</strong> {vehicle.plate}</div>
              <div><strong>📘 Type:</strong> <span style={badgeStyle(vehicle.type)}>{vehicle.type}</span></div>
              <div><strong>📝 Notes:</strong> {vehicle.notes || '—'}</div>
              {vehicle.jobs.length > 0 && (
                <div style={{ color: 'green' }}>📋 Total Jobs: {vehicle.jobs.length}</div>
              )}
              {vehicle.waitingCount > 0 && (
                <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>🕒 Jobs Waiting Approval: {vehicle.waitingCount}</div>
              )}
              {vehicle.notCompletedCount > 0 && (
                <div style={{ color: '#f57c00', fontWeight: 'bold' }}>🟡 Jobs Not Completed: {vehicle.notCompletedCount}</div>
              )}
              
            </div>
            
          ))}
        </div>
      </div>
      {showExportModal && (
  <ExportOptions
    vehicles={vehicles}
    onClose={() => setShowExportModal(false)}
  />
)}
 
    </div>
    
  );
}
