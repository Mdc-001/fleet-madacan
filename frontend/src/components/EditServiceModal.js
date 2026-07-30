import React from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function EditServiceModal({
  editingEntry,
  editForm,
  setEditForm,
  setEditingEntry,
  fetchEntries
}) {
  if (!editingEntry) return null;

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'customerServiceTracking', editingEntry.id), {
        plate: editForm.plate,
        driverName: editForm.driverName,
        serviceProvider: editForm.serviceProvider,
        billingBatchId: editForm.billingBatchId
      });
      setEditingEntry(null);
      fetchEntries();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        width: '400px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <h3>Edit Service</h3>
        <label>Plate:</label>
        <input
          type="text"
          value={editForm.plate}
          onChange={(e) => setEditForm({ ...editForm, plate: e.target.value })}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <label>Driver Name:</label>
        <input
          type="text"
          value={editForm.driverName}
          onChange={(e) => setEditForm({ ...editForm, driverName: e.target.value })}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <label>Service Provider:</label>
        <input
          type="text"
          value={editForm.serviceProvider}
          onChange={(e) => setEditForm({ ...editForm, serviceProvider: e.target.value })}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <label>Billing Batch ID:</label>
        <input
          type="text"
          value={editForm.billingBatchId}
          onChange={(e) => setEditForm({ ...editForm, billingBatchId: e.target.value })}
          style={{ width: '100%', marginBottom: '10px' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={() => setEditingEntry(null)} style={{ padding: '8px 14px' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '8px 14px', backgroundColor: '#0077cc', color: 'white', borderRadius: '6px' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
