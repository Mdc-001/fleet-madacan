import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

export default function AssuranceServiceCard() {
  const [form, setForm] = useState({
    policyNumber: '',
    insurer: '',
    expiryDate: '',
    status: 'pending',
    billingBatchId: '',
    scmApproval: 'pending',
    closedDate: null,
    serviceType: 'assurance',
  });

  const [entries, setEntries] = useState([]);
  const [expandedBatch, setExpandedBatch] = useState(null);

  // Fetch Assurance service entries only
  const fetchEntries = async () => {
    const snap = await getDocs(collection(db, 'customerServiceTracking'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.serviceType === 'assurance');
    setEntries(data);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.policyNumber.trim()) return alert('Policy number is required.');
    if (!form.expiryDate) return alert('Expiry date is required.');

    try {
      await addDoc(collection(db, 'customerServiceTracking'), {
        ...form,
        expiryDate: form.expiryDate,
        timestamp: Timestamp.now(),
      });
      alert('✅ Assurance service entry saved');
      setForm({
        policyNumber: '',
        insurer: '',
        expiryDate: '',
        status: 'pending',
        billingBatchId: '',
        scmApproval: 'pending',
        closedDate: null,
        serviceType: 'assurance',
      });
      fetchEntries();
    } catch (err) {
      console.error('❌ Error saving assurance service:', err);
      alert('Failed to save');
    }
  };

  const handleComplete = async (entry) => {
    if (!entry.billingBatchId) {
      return alert('⚠️ Assign a Billing Batch ID before closing this request.');
    }
    await updateDoc(doc(db, 'customerServiceTracking', entry.id), {
      status: 'completed',
      closedDate: Timestamp.now(),
    });
    fetchEntries();
  };

  const handleUpdateStatus = async (entry, action) => {
    await updateDoc(doc(db, 'customerServiceTracking', entry.id), {
      scmApproval: action,
    });
    fetchEntries();
  };

  const handleBatchAction = async (batchId, action) => {
    const batchEntries = groupedEntries[batchId];
    for (const entry of batchEntries) {
      await updateDoc(doc(db, 'customerServiceTracking', entry.id), {
        status: action === 'completed' ? 'completed' : entry.status,
        scmApproval: action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : entry.scmApproval,
        closedDate: action === 'completed' ? Timestamp.now() : entry.closedDate,
      });
    }
    alert(`Batch ${batchId} marked as ${action}`);
    fetchEntries();
  };

  // Group entries by billingBatchId
  const groupedEntries = entries.reduce((groups, entry) => {
    const batchId = entry.billingBatchId || 'UNASSIGNED';
    if (!groups[batchId]) groups[batchId] = [];
    groups[batchId].push(entry);
    return groups;
  }, {});

  return (
    <div style={{ backgroundColor: '#fffbe8', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
      <h3>📑 Assurance Service Tracking</h3>

      {/* Form */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <input
          placeholder="Policy Number"
          value={form.policyNumber}
          onChange={(e) => handleChange('policyNumber', e.target.value)}
        />
        <input
          placeholder="Insurer"
          value={form.insurer}
          onChange={(e) => handleChange('insurer', e.target.value)}
        />
        <input
          type="date"
          value={form.expiryDate}
          onChange={(e) => handleChange('expiryDate', e.target.value)}
        />
        <input
          placeholder="Billing Batch ID (optional)"
          value={form.billingBatchId}
          onChange={(e) => handleChange('billingBatchId', e.target.value)}
        />

        <button
          onClick={handleSave}
          style={{ backgroundColor: '#0077cc', color: 'white', padding: '6px 12px' }}
        >
          💾 Save
        </button>
      </div>

      {/* Grouped list */}
      <h4>📋 Assurance Requests Grouped by Billing ID</h4>
      {Object.keys(groupedEntries).map(batchId => (
        <div key={batchId} style={{ marginBottom: '20px' }}>
          <h5
            onClick={() => setExpandedBatch(expandedBatch === batchId ? null : batchId)}
            style={{ backgroundColor: '#f0f0f0', padding: '6px', cursor: 'pointer' }}
          >
            ▶ Billing Batch: {batchId} ({groupedEntries[batchId].length} services)
          </h5>

          {expandedBatch === batchId && (
            <>
              {/* Bulk actions */}
              <div style={{ marginBottom: '10px' }}>
                <button onClick={() => handleBatchAction(batchId, 'completed')} style={{ backgroundColor: '#4caf50', color: 'white', padding: '4px 8px', marginRight: '6px' }}>
                  ✅ Complete All
                </button>
                <button onClick={() => handleBatchAction(batchId, 'approved')} style={{ backgroundColor: '#2196f3', color: 'white', padding: '4px 8px', marginRight: '6px' }}>
                  ✔ Approve All
                </button>
                <button onClick={() => handleBatchAction(batchId, 'rejected')} style={{ backgroundColor: '#f44336', color: 'white', padding: '4px 8px' }}>
                  ❌ Reject All
                </button>
              </div>

              <ul style={{ listStyle: 'none', padding: 0 }}>
                {groupedEntries[batchId].map(entry => (
                  <li key={entry.id} style={{ border: '1px solid #ccc', marginBottom: '10px', padding: '10px' }}>
                    <strong>{entry.policyNumber}</strong> — {entry.insurer || 'N/A'}  
                    <br />
                    Expiry Date: {entry.expiryDate}  
                    <br />
                    Status: {entry.status} | SCM Approval: {entry.scmApproval}
                    {entry.closedDate && <div>Closed: {new Date(entry.closedDate).toLocaleString()}</div>}
                    {entry.status !== 'completed' && (
                      <>
                        <button onClick={() => handleComplete(entry)} style={{ backgroundColor: '#4caf50', color: 'white', padding: '4px 8px', marginTop: '6px', marginRight: '6px' }}>
                          ✅ Complete
                        </button>
                        <button onClick={() => handleUpdateStatus(entry, 'approved')} style={{ backgroundColor: '#2196f3', color: 'white', padding: '4px 8px', marginTop: '6px', marginRight: '6px' }}>
                          ✔ Approve
                        </button>
                        <button onClick={() => handleUpdateStatus(entry, 'rejected')} style={{ backgroundColor: '#f44336', color: 'white', padding: '4px 8px', marginTop: '6px' }}>
                          ❌ Reject
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
