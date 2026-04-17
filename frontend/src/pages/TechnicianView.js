// src/pages/VehiclePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  collection, doc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function VehiclePage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({
    mechanic: '',
    description: '',
    status: 'Scheduled',
    priority: 'Medium',
    purchaseRequestNumber: '',
    purchaseFile: null
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setRole(snap.data()?.role);
      } else {
        navigate('/login');
      }
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    getDoc(vehicleRef).then(docSnap => {
      if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
    });

    const jobsRef = collection(db, 'vehicles', vehicleId, 'jobs');
    const unsub = onSnapshot(jobsRef, (snap) => {
      const jobsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJobs(jobsData);
    });

    return () => unsub();
  }, [vehicleId]);

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateJob = async () => {
    if (!form.description || !form.mechanic) {
      alert('Please fill in Description and Mechanic');
      return;
    }
    try {
      const jobData = {
        ...form,
        requester: auth.currentUser?.email || 'Unknown',
        approvalStatus: 'Waiting',
        tasks: [],
        createdAt: new Date(),
        purchaseFileName: '',
        purchaseFileUrl: ''
      };
      const jobsRef = collection(db, 'vehicles', vehicleId, 'jobs');
      await addDoc(jobsRef, jobData);
      setForm({ mechanic: '', description: '', status: 'Scheduled', priority: 'Medium', purchaseRequestNumber: '', purchaseFile: null });
    } catch (err) {
      console.error('Error creating job:', err);
      alert('Error creating job. See console for details.');
    }
  };

  const filteredJobs = jobs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => navigate(-1)}>⬅ Back</button>
      <h2>Vehicle: {vehicle?.plate || 'Loading...'}</h2>

      {(role === 'Admin' || role === 'User') && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Create Job Card</h3>
          <input placeholder="Description" value={form.description} onChange={(e) => handleInputChange('description', e.target.value)} />
          <input placeholder="Assign Technician" value={form.mechanic} onChange={(e) => handleInputChange('mechanic', e.target.value)} />
          <select value={form.status} onChange={(e) => handleInputChange('status', e.target.value)}>
            <option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Archived</option>
          </select>
          <select value={form.priority} onChange={(e) => handleInputChange('priority', e.target.value)}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
          <input placeholder="Purchase Request Number" value={form.purchaseRequestNumber} onChange={(e) => handleInputChange('purchaseRequestNumber', e.target.value)} />
          <button onClick={handleCreateJob}>Add Job</button>
        </div>
      )}

      <h3>Job Cards</h3>
      {filteredJobs.map(job => (
        <div key={job.id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px', borderRadius: '6px' }}>
          <strong>{job.description}</strong> — {job.status}<br />
          🛠 Mechanic: {job.mechanic} | 🎯 Priority: {job.priority}<br />
          👤 Requester: {job.requester || 'N/A'}<br />
          🕓 Created: {job.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}<br />
          <div>
            <strong>Approval:</strong>
            <span style={{ backgroundColor: 'gray', color: 'white', borderRadius: '4px', padding: '2px 6px', marginLeft: '5px' }}>
              {job.approvalStatus || 'Waiting'}
            </span>
          </div>
          <button onClick={() => navigate(`/vehicle/${vehicleId}/job/${job.id}`)} style={{ marginTop: '10px' }}>Open</button>
        </div>
      ))}
    </div>
  );
}
