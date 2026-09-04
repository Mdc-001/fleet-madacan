import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';

export default function ServiceDropdowns({
  entry,
  role,
  dropdownStyle,
  handleUpdateStatus,
  handleManageAction,
  fetchEntries,
  batchId // 🔧 now required
}) {
  const userRole = role?.toLowerCase() || '';
  const isPending = entry.scmApproval?.toLowerCase() === 'pending';
  const isApprovedOrRejected =
    entry.scmApproval?.toLowerCase() === 'approved' ||
    entry.scmApproval?.toLowerCase() === 'rejected';

  const isFinalized =
    entry.status?.toLowerCase() === 'finished' ||
    entry.status?.toLowerCase() === 'rejected';

  // Final Approval handler
  const handleFinalApproval = async (requestId, approved) => {
    try {
      await updateDoc(doc(db, `customerServiceTracking/${batchId}/requests`, requestId), {
        status: approved ? 'Finished' : 'Rejected',
        finalApproval: approved,
        closedDate: Timestamp.now()
      });
      if (fetchEntries) fetchEntries();
    } catch (err) {
      console.error('Final approval failed:', err);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
      {/* SCM/Admin Approval dropdown */}
      {(userRole === 'admin' || userRole === 'scm') && (
        <select
          style={dropdownStyle}
          value={entry.scmApproval || ''}
          onChange={(e) => handleUpdateStatus(batchId, entry.id, e.target.value)}
          disabled={isApprovedOrRejected}
        >
          <option value="">⚙ Select SCM Action</option>
          <option value="approved">✅ SCM Approve</option>
          <option value="rejected">❌ SCM Reject</option>
        </select>
      )}

      {/* Final Approval dropdown */}
      {userRole === 'approval' && (
        <select
          style={dropdownStyle}
          value={isFinalized ? (entry.status === 'Finished' ? 'finalApproved' : 'finalRejected') : ''}
          onChange={(e) => {
            if (e.target.value === 'finalApproved') {
              handleFinalApproval(entry.id, true);
            } else if (e.target.value === 'finalRejected') {
              handleFinalApproval(entry.id, false);
            }
          }}
          disabled={entry.scmApproval?.toLowerCase() !== 'approved' || isFinalized}
        >
          <option value="">⚙ Final Approval</option>
          <option value="finalApproved">✅ Final Approve</option>
          <option value="finalRejected">❌ Final Reject</option>
        </select>
      )}

      {/* Manage dropdown */}
      {(userRole === 'admin' || (userRole === 'scm' && isPending)) && (
        <select
          style={dropdownStyle}
          defaultValue=""
          onChange={(e) => handleManageAction(batchId, entry.id, e.target.value)}
        >
          <option value="">⚙ Manage</option>
          {userRole === 'admin' && (
            <>
              <option value="edit">✏️ Edit Service</option>
              <option value="delete">🗑 Delete Service</option>
              <option value="group">📦 Group Request</option>
            </>
          )}
          {userRole === 'scm' && isPending && (
            <option value="group">📦 Group Request</option>
          )}
        </select>
      )}
    </div>
  );
}
