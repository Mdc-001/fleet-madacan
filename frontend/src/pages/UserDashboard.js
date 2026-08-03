// src/pages/UserDashboard.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDoc, onSnapshot, getDocs
} from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import Select from 'react-select';


// ✅ PLACE HERE
const inputStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  fontSize: '14px',
  minWidth: '180px',
  outline: 'none',
  backgroundColor: '#f9f9f9',
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  transition: 'border-color 0.2s ease',
};

const inputFocusStyle = {
  ...inputStyle,
  borderColor: '#2196f3',
  boxShadow: '0 0 0 2px rgba(33, 150, 243, 0.2)',
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
  plate: '',
  type: '',
  notes: '',
  vin: '',
  Area: '',
  department: '',
  enduser: '',
  recipientEmail: ''
});

  const [filter, setFilter] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
  plate: '', type: '', notes: '', vin: '',
  Area: '', department: '', enduser: '', recipientEmail: []
});
  const { user, role, loading } = useContext(AuthContext);
  const [dropdownOpen, setDropdownOpen] = useState(null);

  const areaOptions = [
  { value: 'TNR', label: 'TNR' },
  { value: 'Toamasina', label: 'Toamasina' },
  { value: 'Moramanga', label: 'Moramanga' }
];
const [formErrors, setFormErrors] = useState({});
const [touched, setTouched] = useState({
  plate: false,
  type: false,
  vin: false,
  Area: false
});

const allVehicles = vehicles.filter(v => !v.isTest); // only count non-test vehicles
const visibleVehicles = vehicles.filter(v => !v.isTest); // excludes test vehicles

  useEffect(() => {
  if (loading || !user) return;

  const unsub = onSnapshot(collection(db, 'vehicles'), async (snapshot) => {
    const vehicleList = await Promise.all(
      snapshot.docs.map(async (vehicleDoc) => {
        const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs'));
        const jobs = await Promise.all(
          jobsSnap.docs.map(async (jobDoc) => {
            const jobData = { id: jobDoc.id, ...jobDoc.data() };
            const tasksSnap = await getDocs(collection(db, 'vehicles', vehicleDoc.id, 'jobs', jobDoc.id, 'tasks'));
            const tasks = tasksSnap.docs.map(t => t.data());
            const isCompleted = tasks.length > 0 && tasks.every(t => t.completed);
            return { ...jobData, isCompleted };
          })
        );

        const preApprovalWaiting = jobs.filter(j => j.adminApprovalStatus === 'Waiting' && j.purchaseFileUrl);
        const finalApprovalWaiting = jobs.filter(
          j => j.adminApprovalStatus === 'Approved' &&
               j.finalApprovalStatus === 'Waiting' &&
               !j.urgentApproval &&
               j.purchaseFileUrl
        );

        const highPriorityPreWaiting = preApprovalWaiting.filter(j => j.priority === 'High');
        const notCompletedCount = jobs.filter(j => !j.isCompleted).length;
        const allJobsCompleted = jobs.length > 0 && jobs.every(j => j.isCompleted);

        

        return {
          id: vehicleDoc.id,
          createdAt: vehicleDoc.data().createdAt || null,
          ...vehicleDoc.data(),
          jobs,
          hasJobs: jobs.length > 0,
          preApprovalWaitingCount: preApprovalWaiting.length,
          finalApprovalWaitingCount: finalApprovalWaiting.length,
          notCompletedCount,
          allJobsCompleted
        };
      })
    );

    const sortedVehicles = vehicleList.sort((a, b) => {
      const aFinal = a.finalApprovalWaitingCount > 0;
      const bFinal = b.finalApprovalWaitingCount > 0;
      if (aFinal && !bFinal) return -1;
      if (!aFinal && bFinal) return 1;

      const aPre = a.preApprovalWaitingCount > 0;
      const bPre = b.preApprovalWaitingCount > 0;
      if (aPre && !bPre) return -1;
      if (!aPre && bPre) return 1;

      if (a.hasJobs && !b.hasJobs) return -1;
      if (!a.hasJobs && b.hasJobs) return 1;

      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate - aDate;
    });

    setVehicles(sortedVehicles);
  });

  return () => unsub();
}, [loading, user]);


 const handleInputChange = (field, value) => {
  setForm((prev) => ({ ...prev, [field]: value }));
  if (touched[field]) {
    setTouched((prev) => ({ ...prev, [field]: false })); // Clear red when fixed
  }
};


  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddVehicle = async (e) => {
  e.preventDefault();

  const missing = {
    plate: !form.plate,
    type: !form.type,
    vin: !form.vin,
    Area: !form.Area
  };

  if (Object.values(missing).some(Boolean)) {
    setTouched(missing); // only set red for missing fields
    return;
  }

  await addDoc(collection(db, 'vehicles'), {
    ...form,
    recipientEmail: form.recipientEmail || ''
  });

  setForm({
    plate: '',
    type: '',
    notes: '',
    vin: '',
    Area: '',
    department: '',
    enduser: '',
    recipientEmail: ''
  });
  setTouched({});
};




  const handleStartEdit = (vehicle) => {
    setEditId(vehicle.id);
    setEditForm({
  plate: vehicle.plate,
  type: vehicle.type,
  notes: vehicle.notes || '',
  vin: vehicle.vin || '',
  Area: vehicle.Area || '',
  department: vehicle.department || '',
  enduser: vehicle.enduser || '',
  recipientEmail: vehicle.recipientEmail || []
});

    setDropdownOpen(null);
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.plate || !editForm.type) return;
    await updateDoc(doc(db, 'vehicles', id), {
  plate: editForm.plate,
  type: editForm.type,
  notes: editForm.notes,
  vin: editForm.vin,
  Area: editForm.Area,
  department: editForm.department,
  enduser: editForm.enduser
});

    setEditId(null);
  };

  const handleDeleteVehicle = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      await deleteDoc(doc(db, 'vehicles', id));
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(filter.toLowerCase()) ||
    v.type.toLowerCase().includes(filter.toLowerCase())
  );

  const typeCounts = visibleVehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  const badgeStyle = (type) => ({
    backgroundColor: type === 'Unknown' ? '#fdd835' : '#90caf9',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '0.8rem'
  });

  return (
    <div>
      <Header />
<div style={{ padding: '20px', textAlign: 'center' }}>
  <h2 style={{ marginBottom: '8px' }}>User Dashboard</h2>
  <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
    All jobs on vehicles must be recorded here. Only jobs with PR need approval.
  </p>

        <button
          onClick={() => navigate('/dashboard-analytics')}
          style={{ marginBottom: '16px', backgroundColor: '#2196f3', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '6px' }}
        >
          📊 Go to Analytics Dashboard
        </button>
        <button
          onClick={() => navigate('/warehouse-dashboard')}
          style={{
            marginBottom: '16px',
            marginLeft: '10px',
            backgroundColor: '#4caf50',
            color: 'white',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px'
          }}
        >
          🏷️ Go to Warehouse Dashboard
        </button>

        <button
  onClick={() => navigate('/maintenance-follow-up')}
  style={{
    backgroundColor: '#757575',
    color: 'white',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    marginLeft: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }}
>
  🛢 Mileage & Lubrification Tracking
</button>


 <div
  style={{
    marginBottom: '20px',
    padding: '16px',
    border: '1px solid #ddd',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  }}
>
  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', color: '#333' }}>
    🚗 Total Vehicles: {allVehicles.length}
  </div>

  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
    }}
  >
    {Object.entries(typeCounts).map(([type, count]) => (
      <div
        key={type}
        style={{
          padding: '8px 14px',
          backgroundColor: '#e3f2fd',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#1976d2',
          boxShadow: 'inset 0 0 2px rgba(0,0,0,0.05)',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>{type}</span>: {count}
      </div>
    ))}
  </div>
</div>





<form onSubmit={handleAddVehicle}>
  <div
    style={{
      border: '1px solid #ccc',
      borderRadius: '10px',
      padding: '20px',
      marginBottom: '24px',
      backgroundColor: '#f0f4f8',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center'
    }}
  >
  <input
  type="text"
  placeholder="Plate Number"
  value={form.plate}
  onChange={(e) => handleInputChange('plate', e.target.value)}
  style={{
    ...inputStyle,
    borderColor: touched.plate ? 'red' : '#ccc'
  }}
/>

<input
  type="text"
  placeholder="Vehicle Type"
  value={form.type}
  onChange={(e) => handleInputChange('type', e.target.value)}
  style={{
    ...inputStyle,
    borderColor: touched.type ? 'red' : '#ccc'
  }}
/>

<input
  type="text"
  placeholder="VIN"
  value={form.vin}
  onChange={(e) => handleInputChange('vin', e.target.value)}
  style={{
    ...inputStyle,
    borderColor: touched.vin ? 'red' : '#ccc'
  }}
/>

<Select
  options={areaOptions}
  value={areaOptions.find(opt => opt.value === form.Area)}
  onChange={(selectedOption) => handleInputChange('Area', selectedOption.value)}
  placeholder="Select Area"
  styles={{
    control: (base) => ({
      ...base,
      background: '#f9f9f9',
      borderColor: touched.Area ? 'red' : '#ccc',
      borderRadius: '8px',
      padding: '2px'
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999
    })
  }}
/>


<input
  type="text"
  placeholder="Department"
  value={form.department}
  onChange={(e) => handleInputChange('department', e.target.value)}
  style={inputStyle}
/>

<input
  type="text"
  placeholder="EndUser"
  value={form.enduser}
  onChange={(e) => handleInputChange('enduser', e.target.value)}
  style={inputStyle}
/>

<input
  type="text"
  placeholder="Recipient Email (Optional)"
  value={form.recipientEmail}
  onChange={(e) => handleInputChange('recipientEmail', e.target.value)}
  style={inputStyle}
/>


  <button
  type="submit"
  style={{
    backgroundColor: '#2196f3',
    color: '#fff',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease'
  }}
>
  ➕ Add Vehicle
</button>
</div>
</form>





<div style={{ width: '100%', textAlign: 'left', marginBottom: '20px' }}>
  <input
    type="text"
    placeholder="Search plate or type..."
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    style={{
      padding: '6px 10px',
      width: '300px',
      border: '1px solid #ccc',
      borderRadius: '6px'
    }}
  />
</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {filteredVehicles.map(vehicle => (
            <div
  style={{
  border: '1px solid #ccc',
  borderRadius: '12px',
  padding: '16px',
  width: 'calc(100% / 9 - 14px)', // 9 per row, minus the gap
  minWidth: '140px',
  backgroundColor: '#fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  position: 'relative',
  cursor: editId ? 'default' : 'pointer',
  textAlign: 'left'
}}

  onClick={() => editId ? null : navigate(`/vehicle/${vehicle.id}`)}
>

              {editId === vehicle.id ? (
                <>
                  <input value={editForm.plate} onChange={(e) => handleEditChange('plate', e.target.value)} />
                  <input value={editForm.type} onChange={(e) => handleEditChange('type', e.target.value)} />
                  <input value={editForm.notes} onChange={(e) => handleEditChange('notes', e.target.value)} />
                  <input
                        value={editForm.vin}
                        placeholder="VIN"
                        onChange={(e) => handleEditChange('vin', e.target.value)}
                      />
                      <select
                          value={editForm.Area}
                          onChange={(e) => handleEditChange('Area', e.target.value)}
                          style={{ minWidth: '140px', padding: '4px' }}
                        >
                          <option value="">Select Area</option>
                          <option value="TNR">TNR</option>
                          <option value="Toamasina">Toamasina</option>
                          <option value="Moramanga">Moramanga</option>
                        </select>

                      <input
                        value={editForm.department}
                        placeholder="Department"
                        onChange={(e) => handleEditChange('department', e.target.value)}
                      />
                      <input
                        value={editForm.enduser}
                        placeholder="End User"
                        onChange={(e) => handleEditChange('enduser', e.target.value)}
                      />

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(vehicle.id); }}>💾 Save</button>
                    <button onClick={(e) => { e.stopPropagation(); setEditId(null); }}>❌ Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div><strong>🚗 Plate:</strong> {vehicle.plate}</div>
                  <div><strong>📘 Type:</strong> <span style={badgeStyle(vehicle.type)}>{vehicle.type}</span></div>
                  <div><strong>📝 Notes:</strong> {vehicle.notes || '—'}</div>
                  <div><strong>🔢 VIN:</strong> {vehicle.vin || '—'}</div>

                  {vehicle.jobs.length > 0 && (
                    <>
                      <div style={{ color: 'green', marginTop: '6px' }}>📋 Total Jobs: {vehicle.jobs.length}</div>

                      {vehicle.preApprovalWaitingCount > 0 && (
                        <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                          ⏳ Jobs Waiting Pre-Approval: {vehicle.preApprovalWaitingCount}
                        </div>
                      )}

                      {vehicle.finalApprovalWaitingCount > 0 && (
                        <div style={{ color: '#f57c00', fontWeight: 'bold' }}>
                          🕒 Jobs Waiting Final Approval: {vehicle.finalApprovalWaitingCount}
                        </div>
                      )}

                      {vehicle.notCompletedCount > 0 && (
                        <div style={{ color: '#fbc02d', fontWeight: 'bold' }}>
                          🟡 Jobs Not Completed: {vehicle.notCompletedCount}
                        </div>
                      )}

                      {vehicle.notCompletedCount === 0 &&
                      vehicle.preApprovalWaitingCount === 0 &&
                      vehicle.finalApprovalWaitingCount === 0 && (
                        <div style={{ color: 'green', fontWeight: 'bold' }}>
                          ✅ All Jobs Completed
                        </div>
                      )}
                    </>
                  )}


                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === vehicle.id ? null : vehicle.id); }}>⋮</button>
                    {dropdownOpen === vehicle.id && (
                      <div style={{ position: 'absolute', right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 1 }}>
                        <button style={{ display: 'block', width: '100%' }} onClick={(e) => { e.stopPropagation(); handleStartEdit(vehicle); }}>✏️ Edit</button>
                        <button style={{ display: 'block', width: '100%' }} onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}>🗑 Delete</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

