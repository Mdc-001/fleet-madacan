import React from 'react';

export default function ServiceDropdowns({
  entry,
  role,
  dropdownStyle,
  handleUpdateStatus,
  handleManageAction
}) {
  const userRole = role?.toLowerCase() || '';
  const isPending = entry.scmApproval?.toLowerCase() === 'pending';
  const isApprovedOrRejected =
    entry.scmApproval?.toLowerCase() === 'approved' ||
    entry.scmApproval?.toLowerCase() === 'rejected';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
      {/* SCM Approval dropdown (locked after decision) */}
      {(userRole === 'admin' || userRole === 'scm') && (
        <select
          style={dropdownStyle}
          value={entry.scmApproval || ''}
          onChange={(e) => handleUpdateStatus(entry.id, e.target.value)}
          disabled={isApprovedOrRejected} // lock once approved/rejected
        >
          <option value="">⚙ Select Action</option>
          <option value="approved">✅ Approve</option>
          <option value="rejected">❌ Reject</option>
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
