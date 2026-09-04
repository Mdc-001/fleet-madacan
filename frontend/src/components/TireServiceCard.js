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

  useEffect(() => {
    const interval = setInterval(() => {
      setShowApproveAction(prev => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchEntries = async () => {
    try {
      const batchSnap = await getDocs(collection(db, 'customerServiceTracking'));
      const batches = [];

      for (const batchDoc of batchSnap.docs) {
        const batchId = batchDoc.id;
        const batchData = batchDoc.data();

        const requestsSnap = await getDocs(collection(db, `customerServiceTracking/${batchId}/requests`));
        const requests = requestsSnap.docs.map(r => ({
          id: r.id,
          ...r.data()
        }));

        batches.push({
          batchId,
          billingBatchId: batchData.billingBatchId || batchId,
          ...batchData,
          requests
        });
      }

      setEntries(batches);
    } catch (err) {
      console.error('Fetch failed:', err);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleUpdateStatus = async (batchId, requestId, status) => {
    if (!status) return;
    try {
      await updateDoc(doc(db, `customerServiceTracking/${batchId}/requests`, requestId), {
        scmApproval: status
      });
      fetchEntries();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleManageAction = async (batchId, requestId, action) => {
    try {
      if (action === 'edit') {
        const batch = entries.find(b => b.batchId === batchId);
        const entry = batch.requests.find(r => r.id === requestId);
        setEditingEntry(entry);
        setEditForm({
          plate: entry.plate || '',
          driverName: entry.driverName || '',
          serviceProvider: entry.serviceProvider || '',
          billingBatchId: batch.billingBatchId || 'UNASSIGNED',
        });
      } else if (action === 'delete') {
        await deleteDoc(doc(db, `customerServiceTracking/${batchId}/requests`, requestId));
        fetchEntries();
      } else if (action === 'group') {
        setGroupingEntry(requestId);
      }
    } catch (err) {
      console.error('Manage action failed:', err);
    }
  };

  const handleAssignToBatch = async (batchId, requestId, newBatchId) => {
    if (!newBatchId) return;
    try {
      await updateDoc(doc(db, `customerServiceTracking/${batchId}/requests`, requestId), {
        billingBatchId: newBatchId
      });
      setGroupingEntry(null);
      setNewBatchId('');
      fetchEntries();
    } catch (err) {
      console.error('Assign to batch failed:', err);
    }
  };

  // 🔧 SCM explicitly asks for final approval → sets scmFinalApproval:true
  const handleAskFinalApproval = async (batchId) => {
    try {
      await updateDoc(doc(db, "customerServiceTracking", batchId), {
        scmFinalApproval: true,
        finalApproval: false,
        status: "WaitingFinalApproval"
      });
      fetchEntries();
      alert(`Batch ${batchId} is now waiting for Final Approval.`);
    } catch (err) {
      console.error("Final approval request failed:", err);
    }
  };

  const handleFinalApproval = async (batchId, approved) => {
    try {
      await updateDoc(doc(db, "customerServiceTracking", batchId), {
        finalApproval: approved,
        status: approved ? "Finished" : "Rejected",
        closedDate: new Date()
      });
      fetchEntries();
      alert(`Batch ${batchId} has been ${approved ? "Final Approved" : "Rejected"}.`);
    } catch (err) {
      console.error("Final approval failed:", err);
    }
  };

  const handleScmApproveBatch = async (batchId) => {
    try {
      const requestsSnap = await getDocs(collection(db, `customerServiceTracking/${batchId}/requests`));
      for (const req of requestsSnap.docs) {
        await updateDoc(doc(db, `customerServiceTracking/${batchId}/requests`, req.id), {
          scmApproval: "approved"
        });
      }
      fetchEntries();
      alert(`✅ All requests in batch ${batchId} approved by SCM.`);
    } catch (err) {
      console.error("SCM batch approval failed:", err);
    }
  };

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

      <h4 style={{ marginTop: '30px', marginBottom: '16px', color: '#444' }}>📋 Tire Requests Grouped by Billing ID</h4>
      {entries.map(batch => {
        const isExpanded = expandedBatch === batch.batchId;
        const pendingCount = batch.requests.filter(r => r.scmApproval?.toLowerCase() === 'pending').length;
        const allScmApproved = batch.requests.every(r => r.scmApproval?.toLowerCase() === 'approved');
        const batchWaitingFinalApproval = batch.status === "WaitingFinalApproval";

        return (
          <div key={batch.batchId} style={{ marginBottom: '20px' }}>
            <div
              onClick={() => setExpandedBatch(isExpanded ? null : batch.batchId)}
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
                {isExpanded ? '▼' : '▶'} Billing Batch: {batch.billingBatchId} ({batch.requests.length} services)
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

                {/* SCM bulk approve button */}
                {role?.toLowerCase() === "scm" && pendingCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScmApproveBatch(batch.batchId);
                    }}
                    style={{
                      background: '#0077cc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Approve All Requests
                  </button>
                )}

                {/* SCM-only Ask for Final Approval button */}
                {role?.toLowerCase() === "scm" && allScmApproved && !batchWaitingFinalApproval && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskFinalApproval(batch.batchId);
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

                {/* Approval role finalization */}
                {batchWaitingFinalApproval && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {showApproveAction && role?.toLowerCase() === "approval" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinalApproval(batch.batchId, true);
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
                  {batch.requests.map(entry => (
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
                      <strong>Billing Batch ID:</strong> {batch.billingBatchId || 'UNASSIGNED'} <br />
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

                      <ServiceDropdowns
                        entry={entry}
                        role={role}
                        dropdownStyle={dropdownStyle}
                        handleUpdateStatus={handleUpdateStatus}
                        handleManageAction={handleManageAction}
                        fetchEntries={fetchEntries}
                        batchId={batch.batchId}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      <EditServiceModal
        editingEntry={editingEntry}
        editForm={editForm}
        setEditForm={setEditForm}
        setEditingEntry={setEditingEntry}
        fetchEntries={fetchEntries}
      />

      <GroupRequestModal
        groupingEntry={groupingEntry}
        groupedEntries={entries}
        newBatchId={newBatchId}
        setNewBatchId={setNewBatchId}
        setGroupingEntry={setGroupingEntry}
        handleAssignToBatch={handleAssignToBatch}
        dropdownStyle={dropdownStyle}
      />
    </div>
  );
}
