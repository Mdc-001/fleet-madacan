import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';

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

    try {
      // 1️⃣ Create batch doc
      const batchDocRef = await addDoc(collection(db, 'customerServiceTracking'), {
        billingBatchId: batchId,
        createdAt: Timestamp.now(),
        batchComplete: false,
        status: 'pending',
        finalApproval: false,
        closedDate: null,
      });

      console.log("Created batch doc:", batchDocRef.id);

      // 2️⃣ Add each request into sub-collection
      for (const req of groupRequests) {
        console.log("Saving request:", req);
        await addDoc(collection(db, `customerServiceTracking/${batchDocRef.id}/requests`), {
          plate: req.plate,
          driverName: req.driverName,
          serviceProvider: req.serviceProvider,
          status: 'pending',
          scmApproval: 'pending',
          finalApproval: false,
          closedDate: null,
          serviceType: 'tire',
          repairDate: Timestamp.fromDate(new Date(req.repairDate)),
          timestamp: Timestamp.now(),
        });
      }

      // 3️⃣ Mark batch as complete → triggers Firebase function
      await updateDoc(doc(db, 'customerServiceTracking', batchDocRef.id), {
        batchComplete: true,
      });

      alert(`✅ Saved ${groupRequests.length} Tire requests under batch ${batchId}`);
      setGroupRequests([]);
      setBatchId('');
      onSaved();
    } catch (err) {
      console.error('Save group failed:', err);
    }
  };

  return (
    <div>
      <h4>📦 Grouped Tire Requests by Billing</h4>
      <input placeholder="Billing Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
      <input placeholder="Plate number" value={form.plate} onChange={(e) => handleChange('plate', e.target.value)} />
      <input placeholder="Driver name" value={form.driverName} onChange={(e) => handleChange('driverName', e.target.value)} />
      <input type="date" value={form.repairDate} onChange={(e) => handleChange('repairDate', e.target.value)} />
      <input placeholder="Service Provider" value={form.serviceProvider} onChange={(e) => handleChange('serviceProvider', e.target.value)} />
      <button onClick={addToGroup}>➕ Add to Group</button>
      <button onClick={saveGroup}>💾 Save Group</button>

      {groupRequests.length > 0 && (
        <div>
          <h5>📝 Pending Group Requests (Batch: {batchId || 'N/A'})</h5>
          <ul>
            {groupRequests.map((req, idx) => (
              <li key={idx}>
                Plate: {req.plate}, Driver: {req.driverName}, Date: {req.repairDate}, Provider: {req.serviceProvider}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
