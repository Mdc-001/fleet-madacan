import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export default function TireSingleRequest({ onSaved }) {
  const [form, setForm] = useState({
    plate: '',
    driverName: '',
    repairDate: '',
    serviceProvider: '',
    status: 'pending',
    scmApproval: 'pending',
    closedDate: null,
    serviceType: 'tire',
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.plate.trim() || !form.driverName.trim() || !form.repairDate || !form.serviceProvider.trim()) {
      return alert('Plate, Driver, Service Date, and Service Provider are required.');
    }
    await addDoc(collection(db, 'customerServiceTracking'), {
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
      closedDate: null,
      serviceType: 'tire',
    });
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
  };

  return (
    <div style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px', backgroundColor: '#fff', marginBottom: '20px' }}>
      <h4 style={{ marginBottom: '16px', color: '#0077cc' }}>➕ Single Tire Request</h4>
      <input style={inputStyle} placeholder="Plate number" value={form.plate} onChange={(e) => handleChange('plate', e.target.value)} />
      <input style={inputStyle} placeholder="Driver name" value={form.driverName} onChange={(e) => handleChange('driverName', e.target.value)} />
      <input style={inputStyle} type="date" value={form.repairDate} onChange={(e) => handleChange('repairDate', e.target.value)} />
      <input style={inputStyle} placeholder="Service Provider" value={form.serviceProvider} onChange={(e) => handleChange('serviceProvider', e.target.value)} />
      <button onClick={handleSave} style={{ ...buttonStyle, backgroundColor: '#0077cc', color: 'white' }}>💾 Save</button>
    </div>
  );
}
