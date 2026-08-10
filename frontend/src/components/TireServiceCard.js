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
  const [showApproveAction, setShowApproveAction] = useState(false);

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

  // Toggle between badge and button for Approval role
  useEffect(() => {
    const interval = setInterval(() => {
      setShowApproveAction(prev => !prev);
    }, 2000);
    return () => clearInterval(interval);
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

  // SCM triggers final approval for a whole batch
  const handleAskFinalApproval = async (batchId) => {
    try {
      for (const entry of groupedEntries[batchId]) {
        await updateDoc(doc(db, 'customerServiceTracking', entry.id), {
          status: "WaitingFinalApproval"
        });
      }
      fetchEntries();
      alert(`Batch ${batchId} is now waiting for Final Approval.`);
    } catch (err) {
      console.error("Final approval request failed:", err);
    }
  };

  // Approval role finalizes batch
  const handleFinalApproval = async (batchId, approved) => {
    try {
      for (const entry of groupedEntries[batchId]) {
        await updateDoc(doc(db, 'customerServiceTracking', entry.id), {
          status: approved ? "Finished" : "Rejected",
          finalApproval: approved,
          closedDate: new Date()
        });
      }
      fetchEntries();
      alert(`Batch ${batchId} has been ${approved ? "Final Approved" : "Rejected"}.`);
    } catch (err) {
      console.error("Final approval failed:", err);
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

      {mode === 'single' && <TireSingleRequest onSaved={fetchEntries} role={role} />}
      {mode === 'group' && <TireGroupedRequest onSaved={fetchEntries} role={role} />}

      {/* Grouped list */}
      <h4 style={{ marginTop: '30px', marginBottom: '16px', color: '#444' }}>📋 Tire Requests Grouped by Billing ID</h4>
      {Object.keys(groupedEntries).map(batchId => {
        const isExpanded = expandedBatch === batchId;
        const pendingCount = groupedEntries[batchId].filter(
          e => e.scmApproval?.toLowerCase() === 'pending'
        ).length;
        const allScmApproved = groupedEntries[batchId].every(
          e => e.scmApproval?.toLowerCase() === 'approved'
        );
        const batchWaitingFinalApproval = groupedEntries[batchId].every(
          e => e.status === 'WaitingFinalApproval'
        );

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

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {pendingCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#ffcccc',
                      color: '#b71c1c',
                      padding: '3px 50px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      animation: 'flash 1s infinite'
                    }}
                  >
                    ⏳ {pendingCount} waiting SCM approval
                  </span>
                )}

                {/* SCM-only Ask for Final Approval button */}
                                {role?.toLowerCase() === "scm" && allScmApproved && !batchWaitingFinalApproval && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskFinalApproval(batchId);
                    }}
                    style={{
                      background: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    Ask for Final Approval
                  </button>
                )}

                {/* Once escalated, show alternating badge/button for Approval role */}
                {batchWaitingFinalApproval && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {showApproveAction && role?.toLowerCase() === "approval" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinalApproval(batchId, true);
                        }}
                        style={{
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Click here to Final Approve
                      </button>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#fff3cd',
                          color: '#856404',
                          padding: '3px 50px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          animation: 'flash 1s infinite'
                        }}
                      >
                        ⏳ Waiting Final Approval
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '12px', marginTop: '8px', backgroundColor: '#fcfcfc', borderRadius: '8px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {groupedEntries[batchId].map(entry => (
                    <li
                      key={entry.id}
                      style={{
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '10px',
                        backgroundColor: '#fff'
                      }}
                    >
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
                      <br />
                      <strong>Status:</strong>{' '}
                      <span
                        style={{
                          fontWeight: '500',
                          color:
                            entry.status === 'Finished'
                              ? '#4caf50'
                              : entry.status === 'Rejected'
                              ? '#f44336'
                              : entry.status === 'WaitingFinalApproval'
                              ? '#ff9800'
                              : '#999'
                        }}
                      >
                        {entry.status || 'N/A'}
                      </span>

                      {/* Action dropdowns row */}
                      <ServiceDropdowns
                        entry={entry}
                        role={role}
                        dropdownStyle={dropdownStyle}
                        handleUpdateStatus={handleUpdateStatus}
                        handleManageAction={handleManageAction}
                        fetchEntries={fetchEntries}
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
