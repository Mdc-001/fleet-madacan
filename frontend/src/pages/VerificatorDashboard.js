import Header from '../components/Header';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { getDoc, doc, getDocs, collection } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [role, setRole] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const allVehicles = vehicles.filter(v => !v.isTest); // only count non-test vehicles
const visibleVehicles = vehicles.filter(v => !v.isTest); // excludes test vehicles

  // ✅ Step 1: Authenticate + load role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setRole(snap.data()?.role || null);
        setLoading(false);
      } else {
        navigate('/login');
      }
    });
    return () => unsub();
  }, [navigate]);

   useEffect(() => {
    if (loading || role !== 'verificator') return;

    const fetchData = async () => {
      const vehicleSnap = await getDocs(collection(db, 'vehicles'));
      const vehicleList = await Promise.all(vehicleSnap.docs.map(async (vehicleDoc) => {
        const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs'));

        const jobs = await Promise.all(jobsSnap.docs.map(async (jobDoc) => {
          const jobData = { id: jobDoc.id, ...jobDoc.data() };
          const tasksSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs', jobDoc.id, 'tasks'));
          const tasks = tasksSnap.docs.map(t => t.data());
          const isCompleted = tasks.length > 0 && tasks.every(t => t.completed);
          return { ...jobData, isCompleted };
        }));

        const waitingVerificationCount = jobs.filter(j =>
          j.adminApprovalStatus === 'Approved' &&
          j.finalApprovalStatus === 'Approved' &&
          j.status === 'Completed' &&
          j.verificationStatus !== 'Verified'
        ).length;

        const notCompletedCount = jobs.filter(j => !j.isCompleted).length;

        return {
          id: vehicleDoc.id,
          ...vehicleDoc.data(),
          jobs,
          waitingVerificationCount,
          notCompletedCount
        };
      }));

      // Sort vehicles by jobs needing verification
      vehicleList.sort((a, b) => {
        if (a.waitingVerificationCount && !b.waitingVerificationCount) return -1;
        if (!a.waitingVerificationCount && b.waitingVerificationCount) return 1;
        return b.jobs.length - a.jobs.length;
      });

      setVehicles(vehicleList);
    };

    fetchData();
  }, [role, loading]);

  const badgeStyle = (type) => ({
    backgroundColor: '#d1c4e9',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '0.8rem'
  });

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
       <h2 style={{ marginBottom: '8px' }}>Verificator Dashboard</h2>
       <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
         All jobs on vehicles must be recorded here. Only jobs with PR need approval.
       </p>
     
             <button
               onClick={() => navigate('/dashboard-analytics')}
               style={{ marginBottom: '16px', backgroundColor: '#2196f3', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '6px' }}
             >
               📊 Go to Analytics Dashboard
             </button>
             <button
               onClick={() => navigate('/warehouse-dashboard')}
               style={{
                 marginBottom: '16px',
                 marginLeft: '10px',
                 backgroundColor: '#4caf50',
                 color: 'white',
                 padding: '8px 12px',
                 border: 'none',
                 borderRadius: '6px'
               }}
             >
               🏷️ Go to Warehouse Dashboard
             </button>
     
             <button
       onClick={() => navigate('/maintenance-follow-up')}
       style={{
         backgroundColor: '#757575',
         color: 'white',
         padding: '8px 16px',
         border: 'none',
         borderRadius: '6px',
         marginLeft: '8px',
         cursor: 'pointer',
         fontWeight: 'bold'
       }}
     >
       🛢 Mileage & Lubrification Tracking
     </button>
     
     
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
              {vehicle.waitingVerificationCount > 0 && (
                <div style={{ color: '#9c27b0', fontWeight: 'bold' }}>🔍 Jobs Waiting Verification: {vehicle.waitingVerificationCount}</div>
              )}
              {vehicle.notCompletedCount > 0 && (
                <div style={{ color: '#f57c00', fontWeight: 'bold' }}>🟡 Jobs Not Completed: {vehicle.notCompletedCount}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
