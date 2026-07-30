import React, { useState, useEffect } from 'react';
import TireSingleRequest from './TireSingleRequest';
import TireGroupedRequest from './TireGroupedRequest';
import ServiceDropdowns from './ServiceDropdowns';
import EditServiceModal from './EditServiceModal';
import GroupRequestModal from './GroupRequestModal';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';

export default function TireServiceCard({ role }) {
  const [entries, setEntries] = useState([]);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [mode, setMode] = useState('single');
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [groupingEntry, setGroupingEntry] = useState(null);
  const [newBatchId, setNewBatchId] = useState('');

  // Flash animation style
  useEffect(() => {
    const flashStyle = `
      @keyframes flash {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    `;
    const styleTag = document.createElement('style');
    styleTag.innerHTML = flashStyle;
    document.head.appendChild(styleTag);
  }, []);

  const fetchEntries = async () => {
    try {
      const snap = await getDocs(collection(db, 'customerServiceTracking'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.serviceType === 'tire');
      setEntries(data);
    } catch (err) {
      console.error('Fetch failed:', err);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleUpdateStatus = async (entryId, status) => {
    if (!status) return;
    try {
      await updateDoc(doc(db, 'customerServiceTracking', entryId), { scmApproval: status });
      fetchEntries();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleManageAction = async (entryId, action) => {
    try {
      if (action === 'edit') {
        const entry = entries.find(e => e.id === entryId);
        setEditingEntry(entry);
        setEditForm({
          plate: entry.plate || '',
          driverName: entry.driverName || '',
          serviceProvider: entry.serviceProvider || '',
          billingBatchId: entry.billingBatchId || 'UNASSIGNED',
        });
      } else if (action === 'delete') {
        await deleteDoc(doc(db, 'customerServiceTracking', entryId));
        fetchEntries();
      } else if (action === 'group') {
        setGroupingEntry(entryId);
      }
    } catch (err) {
      console.error('Manage action failed:', err);
    }
  };

  const handleAssignToBatch = async (entryId, batchId) => {
    if (!batchId) return;
    try {
      await updateDoc(doc(db, 'customerServiceTracking', entryId), { billingBatchId: batchId });
      setGroupingEntry(null);
      setNewBatchId('');
      fetchEntries();
    } catch (err) {
      console.error('Assign to batch failed:', err);
    }
  };

  const groupedEntries = entries.reduce((groups, entry) => {
    const batchId = entry.billingBatchId || 'UNASSIGNED';
    if (!groups[batchId]) groups[batchId] = [];
    groups[batchId].push(entry);
    return groups;
  }, {});

  const dropdownStyle = {
    borderRadius: '8px',
    padding: '6px 12px',
    border: '1px solid #ccc',
    backgroundColor: '#f9fafb',
    fontWeight: '500',
    marginTop: '8px',
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
      <h3 style={{ marginBottom: '20px', color: '#0077cc' }}>🛞 Tire Service Tracking</h3>

      {/* Mode selector */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setMode('single')} style={{ borderRadius: '20px', padding: '10px 18px', marginRight: '12px', backgroundColor: mode === 'single' ? '#0077cc' : '#e0e0e0', color: mode === 'single' ? 'white' : '#333' }}>
          ➕ Single Tire Request
        </button>
        <button onClick={() => setMode('group')} style={{ borderRadius: '20px', padding: '10px 18px', backgroundColor: mode === 'group' ? '#0077cc' : '#e0e0e0', color: mode === 'group' ? 'white' : '#333' }}>
          📦 Grouped by Billing
        </button>
      </div>

      {mode === 'single' && <TireSingleRequest onSaved={fetchEntries} />}
      {mode === 'group' && <TireGroupedRequest onSaved={fetchEntries} />}

      {/* Grouped list */}
      <h4 style={{ marginTop: '30px', marginBottom: '16px', color: '#444' }}>📋 Tire Requests Grouped by Billing ID</h4>
      {Object.keys(groupedEntries).map(batchId => {
        const isExpanded = expandedBatch === batchId;
        const pendingCount = groupedEntries[batchId].filter(
          e => e.scmApproval?.toLowerCase() === 'pending'
        ).length;

        return (
          <div key={batchId} style={{ marginBottom: '20px' }}>
            <div
              onClick={() => setExpandedBatch(isExpanded ? null : batchId)}
              style={{
                backgroundColor: isExpanded ? '#0077cc' : '#f9fafb',
                color: isExpanded ? 'white' : '#333',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>
                {isExpanded ? '▼' : '▶'} Billing Batch: {batchId} ({groupedEntries[batchId].length} services)
              </span>

              {pendingCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#ffcccc',
                    color: '#b71c1c',
                    padding: '4px 200px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    animation: 'flash 1s infinite'
                  }}
                >
                  ⏳ {pendingCount} waiting approval
                </span>
              )}
            </div>

            {isExpanded && (
              <div style={{ padding: '12px', marginTop: '8px', backgroundColor: '#fcfcfc', borderRadius: '8px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {groupedEntries[batchId].map(entry => (
                    <li key={entry.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '12px', marginBottom: '10px', backgroundColor: '#fff' }}>
                      <strong>Plate:</strong> {entry.plate || 'N/A'} <br />
                      <strong>Driver:</strong> {entry.driverName || 'N/A'} <br />
                      <strong>Service Provider:</strong> {entry.serviceProvider || 'N/A'} <br />
                      <strong>Billing Batch ID:</strong> {entry.billingBatchId || 'UNASSIGNED'} <br />
                      <strong>SCM Approval:</strong>{' '}
                      <span
                        style={{
                          fontWeight: '500',
                          color:
                            entry.scmApproval?.toLowerCase() === 'approved'
                              ? '#4caf50'
                              : entry.scmApproval?.toLowerCase() === 'rejected'
                              ? '#f44336'
                              : '#999'
                        }}
                      >
                        ✔ {entry.scmApproval || 'N/A'}
                      </span>

                      {/* Action dropdowns row */}
                      <ServiceDropdowns
                        entry={entry}
                        role={role}
                        dropdownStyle={dropdownStyle}
                        handleUpdateStatus={handleUpdateStatus}
                        handleManageAction={handleManageAction}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

           {/* Modals */}
      <EditServiceModal
        editingEntry={editingEntry}
        editForm={editForm}
        setEditForm={setEditForm}
        setEditingEntry={setEditingEntry}
        fetchEntries={fetchEntries}
      />

      <GroupRequestModal
        groupingEntry={groupingEntry}
        groupedEntries={groupedEntries}
        newBatchId={newBatchId}
        setNewBatchId={setNewBatchId}
        setGroupingEntry={setGroupingEntry}
        handleAssignToBatch={handleAssignToBatch}
        dropdownStyle={dropdownStyle}
      />
    </div>
  );
}
