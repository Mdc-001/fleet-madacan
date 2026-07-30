import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export default function TireGroupedRequest({ onSaved }) {
  const [batchId, setBatchId] = useState('');
  const [form, setForm] = useState({ plate: '', driverName: '', repairDate: '', serviceProvider: '' });
  const [groupRequests, setGroupRequests] = useState([]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addToGroup = () => {
    if (!batchId) return alert('Billing Batch ID is required.');
    if (!form.plate.trim() || !form.driverName.trim() || !form.repairDate || !form.serviceProvider.trim()) {
      return alert('Plate, Driver, Service Date, and Service Provider are required.');
    }
    setGroupRequests(prev => [...prev, { ...form }]);
    setForm({ plate: '', driverName: '', repairDate: '', serviceProvider: '' });
  };

  const saveGroup = async () => {
    if (!batchId) return alert('Billing Batch ID is required.');
    if (groupRequests.length === 0) return alert('No requests to save.');
    for (const req of groupRequests) {
      await addDoc(collection(db, 'customerServiceTracking'), {
        ...req,
        billingBatchId: batchId,
        status: 'pending',
        scmApproval: 'pending',
        closedDate: null,
        serviceType: 'tire',
        repairDate: Timestamp.fromDate(new Date(req.repairDate)),
        timestamp: Timestamp.now(),
      });
    }
    alert(`✅ Saved ${groupRequests.length} Tire requests under batch ${batchId}`);
    setGroupRequests([]);
    setBatchId('');
    onSaved();
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
      <h4 style={{ marginBottom: '16px', color: '#0077cc' }}>📦 Grouped Tire Requests by Billing</h4>
      <input style={inputStyle} placeholder="Billing Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
      <input style={inputStyle} placeholder="Plate number" value={form.plate} onChange={(e) => handleChange('plate', e.target.value)} />
      <input style={inputStyle} placeholder="Driver name" value={form.driverName} onChange={(e) => handleChange('driverName', e.target.value)} />
      <input style={inputStyle} type="date" value={form.repairDate} onChange={(e) => handleChange('repairDate', e.target.value)} />
      <input style={inputStyle} placeholder="Service Provider" value={form.serviceProvider} onChange={(e) => handleChange('serviceProvider', e.target.value)} />
      <div>
        <button onClick={addToGroup} style={{ ...buttonStyle, backgroundColor: '#2196f3', color: 'white' }}>➕ Add to Group</button>
        <button onClick={saveGroup} style={{ ...buttonStyle, backgroundColor: '#4caf50', color: 'white' }}>💾 Save Group</button>
      </div>
      {groupRequests.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h5 style={{ color: '#333' }}>📝 Pending Group Requests (Batch: {batchId || 'N/A'})</h5>
          <ul>
            {groupRequests.map((req, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>
                Plate: {req.plate}, Driver: {req.driverName}, Date: {req.repairDate}, Provider: {req.serviceProvider}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
