import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';

export default function TireSingleRequest({ onSaved, role }) {
  const [form, setForm] = useState({
    plate: '',
    driverName: '',
    repairDate: '',
    serviceProvider: '',
    status: 'pending',
    scmApproval: 'pending',
    finalApproval: false,
    closedDate: null,
    serviceType: 'tire',
  });

  const [batchOptions, setBatchOptions] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('UNASSIGNED');

  // Fetch existing open batches
 useEffect(() => {
  const fetchBatches = async () => {
    const snap = await getDocs(collection(db, 'customerServiceTracking'));
    const openBatches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.status !== 'Finished' && b.status !== 'complete'); 
      // only show batches not marked complete/finished
    setBatchOptions(openBatches);
  };
  fetchBatches();
}, []);


  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.plate.trim() || !form.driverName.trim() || !form.repairDate || !form.serviceProvider.trim()) {
      return alert('Plate, Driver, Service Date, and Service Provider are required.');
    }

    try {
      let batchDocRef;

      if (selectedBatchId === 'UNASSIGNED') {
        // ensure UNASSIGNED batch exists
        batchDocRef = doc(collection(db, 'customerServiceTracking'), 'UNASSIGNED');
        await setDoc(batchDocRef, {
          billingBatchId: 'UNASSIGNED',
          batchComplete: false,
          emailSent: false,
          createdAt: Timestamp.now()
        }, { merge: true });
      } else {
        batchDocRef = doc(db, 'customerServiceTracking', selectedBatchId);
      }

      // Add request inside the chosen batch’s sub-collection
      await addDoc(collection(batchDocRef, 'requests'), {
        ...form,
        repairDate: Timestamp.fromDate(new Date(form.repairDate)),
        timestamp: Timestamp.now(),
      });

      alert('✅ Tire service entry saved');
      setForm({
        plate: '',
        driverName: '',
        repairDate: '',
        serviceProvider: '',
        status: 'pending',
        scmApproval: 'pending',
        finalApproval: false,
        closedDate: null,
        serviceType: 'tire',
      });
      onSaved();
    } catch (err) {
      console.error('Save failed:', err);
      alert('✗ Failed to save request');
    }
  };

  const handleFinalApproval = async (approved, batchId, requestId) => {
    try {
      await updateDoc(doc(db, `customerServiceTracking/${batchId}/requests`, requestId), {
        status: approved ? 'Finished' : 'Rejected',
        finalApproval: approved,
        closedDate: Timestamp.now()
      });
      alert(`Request marked as ${approved ? 'Finished' : 'Rejected'}`);
      onSaved();
    } catch (err) {
      console.error('Final approval failed:', err);
    }
  };

  const inputStyle = {
    borderRadius: '8px',
    border: '1px solid #ddd',
    padding: '10px',
    backgroundColor: '#f9fafb',
    flex: '1',
    marginBottom: '10px',
  };

  const buttonStyle = {
    borderRadius: '20px',
    padding: '10px 18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    marginTop: '10px',
    marginRight: '8px',
  };

  return (
    <div style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px', backgroundColor: '#fff', marginBottom: '20px' }}>
      <h4 style={{ marginBottom: '16px', color: '#0077cc' }}>➕ Single Tire Request</h4>

      {/* Batch selector */}
      <select
        value={selectedBatchId}
        onChange={(e) => setSelectedBatchId(e.target.value)}
        style={{ ...inputStyle, marginBottom: '12px' }}
      >
        <option value="UNASSIGNED">UNASSIGNED</option>
        {batchOptions.map(b => (
          <option key={b.id} value={b.id}>
            {b.billingBatchId || b.id}
          </option>
        ))}
      </select>

      <input style={inputStyle} placeholder="Plate number" value={form.plate} onChange={(e) => handleChange('plate', e.target.value)} />
      <input style={inputStyle} placeholder="Driver name" value={form.driverName} onChange={(e) => handleChange('driverName', e.target.value)} />
      <input style={inputStyle} type="date" value={form.repairDate} onChange={(e) => handleChange('repairDate', e.target.value)} />
      <input style={inputStyle} placeholder="Service Provider" value={form.serviceProvider} onChange={(e) => handleChange('serviceProvider', e.target.value)} />

      <button onClick={handleSave} style={{ ...buttonStyle, backgroundColor: '#0077cc', color: 'white' }}>💾 Save</button>
    </div>
  );
}
