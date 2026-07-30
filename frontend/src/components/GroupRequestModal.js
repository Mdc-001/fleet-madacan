import React from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function GroupRequestModal({
  groupingEntry,
  groupedEntries,
  newBatchId,
  setNewBatchId,
  setGroupingEntry,
  handleAssignToBatch,
  dropdownStyle
}) {
  if (!groupingEntry) return null;

  const handleAssign = () => {
    handleAssignToBatch(groupingEntry, newBatchId);
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
        <h3>Group Request</h3>
        <p>Select or create a batch ID to group this request.</p>

        <label>Existing Batch IDs:</label>
        <select
          style={dropdownStyle}
          value={newBatchId}
          onChange={(e) => setNewBatchId(e.target.value)}
        >
          <option value="">-- Select Batch --</option>
          {Object.keys(groupedEntries).map(batchId => (
            <option key={batchId} value={batchId}>{batchId}</option>
          ))}
        </select>

        <label style={{ marginTop: '10px' }}>Or New Batch ID:</label>
        <input
          type="text"
          value={newBatchId}
          onChange={(e) => setNewBatchId(e.target.value)}
          style={{ width: '100%', marginBottom: '10px' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={() => setGroupingEntry(null)} style={{ padding: '8px 14px' }}>Cancel</button>
          <button onClick={handleAssign} style={{ padding: '8px 14px', backgroundColor: '#0077cc', color: 'white', borderRadius: '6px' }}>Assign</button>
        </div>
      </div>
    </div>
  );
}
