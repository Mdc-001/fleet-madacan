// src/pages/SCMDashboard.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';

export default function SCMDashboard() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState('');
  const { user, role, loading } = useContext(AuthContext);

  useEffect(() => {
    if (loading || !user) return;

    const unsub = onSnapshot(collection(db, 'vehicles'), async (snapshot) => {
      const vehicleList = await Promise.all(
        snapshot.docs.map(async (vehicleDoc) => {
          const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs'));
          const jobs = await Promise.all(
            jobsSnap.docs.map(async (jobDoc) => {
              const jobData = { id: jobDoc.id, ...jobDoc.data() };
              const tasksSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs', jobDoc.id, 'tasks'));
              const tasks = tasksSnap.docs.map(t => t.data());
              const isCompleted = tasks.length > 0 && tasks.every(t => t.completed);
              return { ...jobData, isCompleted };
            })
          );

          const preApprovalWaiting = jobs.filter(j => j.adminApprovalStatus === 'Waiting' && j.purchaseFileUrl);
          const finalApprovalWaiting = jobs.filter(
            j => j.adminApprovalStatus === 'Approved' &&
                 j.finalApprovalStatus === 'Waiting' &&
                 !j.urgentApproval &&
                 j.purchaseFileUrl
          );

          const notCompletedCount = jobs.filter(j => !j.isCompleted).length;
          const allJobsCompleted = jobs.length > 0 && jobs.every(j => j.isCompleted);

          return {
            id: vehicleDoc.id,
            createdAt: vehicleDoc.data().createdAt || null,
            ...vehicleDoc.data(),
            jobs,
            hasJobs: jobs.length > 0,
            preApprovalWaitingCount: preApprovalWaiting.length,
            finalApprovalWaitingCount: finalApprovalWaiting.length,
            notCompletedCount,
            allJobsCompleted
          };
        })
      );

      const sortedVehicles = vehicleList.sort((a, b) => {
        const aFinal = a.finalApprovalWaitingCount > 0;
        const bFinal = b.finalApprovalWaitingCount > 0;
        if (aFinal && !bFinal) return -1;
        if (!aFinal && bFinal) return 1;

        const aPre = a.preApprovalWaitingCount > 0;
        const bPre = b.preApprovalWaitingCount > 0;
        if (aPre && !bPre) return -1;
        if (!aPre && bPre) return 1;

        if (a.hasJobs && !b.hasJobs) return -1;
        if (!a.hasJobs && b.hasJobs) return 1;

        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate - aDate;
      });

      setVehicles(sortedVehicles);
    });

    return () => unsub();
  }, [loading, user]);

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(filter.toLowerCase()) ||
    v.type.toLowerCase().includes(filter.toLowerCase())
  );

  const typeCounts = vehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  const badgeStyle = (type) => ({
    backgroundColor: type === 'Unknown' ? '#fdd835' : '#90caf9',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '0.8rem'
  });

  return (
    <div>
      <Header />
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>SCM Dashboard</h2>
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
          style={{ marginBottom: '16px', marginLeft: '10px', backgroundColor: '#4caf50', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '6px' }}
        >
          🏷️ Go to Warehouse Dashboard
        </button>

        <button
          onClick={() => navigate('/maintenance-follow-up')}
          style={{ backgroundColor: '#757575', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🛢 Mileage & Lubrification Tracking
        </button>

        <div style={{ marginTop: '20px', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', background: '#ffffff', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', color: '#333' }}>
            🚗 Total Vehicles: {vehicles.length}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
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
                  boxShadow: 'inset 0 0 2px rgba(0,0,0,0.05)'
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{type}</span>: {count}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', textAlign: 'left', marginTop: '24px', marginBottom: '20px' }}>
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
              style={{
                border: '1px solid #ccc',
                borderRadius: '12px',
                padding: '16px',
                width: 'calc(100% / 9 - 14px)',
                minWidth: '140px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                position: 'relative',
                textAlign: 'left',
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/vehicle/${vehicle.id}`)}
            >
              <div><strong>🚗 Plate:</strong> {vehicle.plate}</div>
              <div><strong>📘 Type:</strong> <span style={badgeStyle(vehicle.type)}>{vehicle.type}</span></div>
              <div><strong>📝 Notes:</strong> {vehicle.notes || '—'}</div>
              <div><strong>🔢 VIN:</strong> {vehicle.vin || '—'}</div>

              {vehicle.jobs.length > 0 && (
                <>
                  <div style={{ color: 'green', marginTop: '6px' }}>📋 Total Jobs: {vehicle.jobs.length}</div>

                  {vehicle.preApprovalWaitingCount > 0 && (
                    <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                      ⏳ Jobs Waiting Pre-Approval: {vehicle.preApprovalWaitingCount}
                    </div>
                  )}

                  {vehicle.finalApprovalWaitingCount > 0 && (
                    <div style={{ color: '#f57c00', fontWeight: 'bold' }}>
                      🕒 Jobs Waiting Final Approval: {vehicle.finalApprovalWaitingCount}
                    </div>
                  )}

                  {vehicle.notCompletedCount > 0 && (
                    <div style={{ color: '#fbc02d', fontWeight: 'bold' }}>
                      🟡 Jobs Not Completed: {vehicle.notCompletedCount}
                    </div>
                  )}

                  {vehicle.notCompletedCount === 0 &&
                    vehicle.preApprovalWaitingCount === 0 &&
                    vehicle.finalApprovalWaitingCount === 0 && (
                      <div style={{ color: 'green', fontWeight: 'bold' }}>
                        ✅ All Jobs Completed
                      </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
