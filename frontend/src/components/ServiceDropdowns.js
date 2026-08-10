import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';

export default function ServiceDropdowns({
  entry,
  role,
  dropdownStyle,
  handleUpdateStatus,
  handleManageAction,
  fetchEntries
}) {
  const userRole = role?.toLowerCase() || '';
  const isPending = entry.scmApproval?.toLowerCase() === 'pending';
  const isApprovedOrRejected =
    entry.scmApproval?.toLowerCase() === 'approved' ||
    entry.scmApproval?.toLowerCase() === 'rejected';

  // Final Approval handler
  const handleFinalApproval = async (entryId, approved) => {
    try {
      await updateDoc(doc(db, 'customerServiceTracking', entryId), {
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
      {/* SCM/Admin Approval dropdown (locked after decision) */}
      {(userRole === 'admin' || userRole === 'scm') && (
        <select
          style={dropdownStyle}
          value={entry.scmApproval || ''}
          onChange={(e) => handleUpdateStatus(entry.id, e.target.value)}
          disabled={isApprovedOrRejected} // lock once approved/rejected
        >
          <option value="">⚙ Select SCM Action</option>
          <option value="approved">✅ SCM Approve</option>
          <option value="rejected">❌ SCM Reject</option>
        </select>
      )}

      {/* Final Approval dropdown (Approval role only) */}
      {userRole === 'approval' && (
        <select
          style={dropdownStyle}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value === 'finalApproved') {
              handleFinalApproval(entry.id, true);
            } else if (e.target.value === 'finalRejected') {
              handleFinalApproval(entry.id, false);
            }
          }}
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
          onChange={(e) => handleManageAction(entry.id, e.target.value)}
        >
          <option value="">⚙ Manage</option>

          {/* Admin options */}
          {userRole === 'admin' && (
            <>
              <option value="edit">✏️ Edit Service</option>
              <option value="delete">🗑 Delete Service</option>
              <option value="group">📦 Group Request</option>
            </>
          )}

          {/* SCM options (only if still pending) */}
          {userRole === 'scm' && isPending && (
            <option value="group">📦 Group Request</option>
          )}
        </select>
      )}
    </div>
  );
}
