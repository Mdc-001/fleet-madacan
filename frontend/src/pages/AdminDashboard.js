import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useContext } from 'react';
import Header from '../components/Header';
import { db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDocs, onSnapshot
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { AuthContext } from '../context/AuthContext';
import Select from 'react-select';
import ExportOptions from '../components/ExportOptions';

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, role, loading } = useContext(AuthContext);
  const dropdownRef = useRef(null);

  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    plate: '', type: '', notes: '', vin: '', Area: '',
    department: '', enduser: '', recipientEmail: ''
  });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    plate: '', type: '', notes: '', vin: '', Area: '',
    department: '', enduser: '', recipientEmail: []
  });
  const [emailEditId, setEmailEditId] = useState(null);
  const [emailInputs, setEmailInputs] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({
    plate: false, type: false, vin: false, Area: false
  });
  const [showExportModal, setShowExportModal] = useState(false);

  const areaOptions = [
    { value: 'TNR', label: 'TNR' },
    { value: 'Toamasina', label: 'Toamasina' },
    { value: 'Moramanga', label: 'Moramanga' }
  ];

  const allVehicles = vehicles.filter(v => !v.isTest);
  const visibleVehicles = vehicles.filter(v => !v.isTest);
  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(filter.toLowerCase()) ||
    v.type.toLowerCase().includes(filter.toLowerCase())
  );
 useEffect(() => {
  if (loading || !user || role !== 'Admin') return;

  const unsub = onSnapshot(collection(db, 'vehicles'), async (snapshot) => {
    const vehicleList = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const vehicle = { id: docSnap.id, ...docSnap.data() };

      const jobsSnap = await getDocs(collection(db, 'vehicles', vehicle.id, 'jobs'));
      const jobs = await Promise.all(jobsSnap.docs.map(async (jobDoc) => {
        const jobData = { id: jobDoc.id, ...jobDoc.data() };

        const tasksSnap = await getDocs(collection(db, 'vehicles', vehicle.id, 'jobs', jobDoc.id, 'tasks'));
        const tasks = tasksSnap.docs.map(t => t.data());
        const isCompleted = tasks.length > 0 && tasks.every(t => t.completed);

        return { ...jobData, isCompleted };
      }));

// ✅ Only count jobs with a purchase requisition (based on file presence)
// ✅ AND exclude jobs that are completed
const jobsWithPR = jobs.filter(j =>
  j.purchaseFileName &&
  j.purchaseFileUrl &&
  !j.isCompleted
);

const preApprovalWaiting = jobsWithPR.filter(j => j.adminApprovalStatus === 'Waiting');
const finalApprovalWaiting = jobsWithPR.filter(j =>
  j.adminApprovalStatus === 'Approved' &&
  j.finalApprovalStatus === 'Waiting' &&
  !j.urgentApproval
);
const highPriorityWaiting = preApprovalWaiting.filter(j => j.priority === 'High');
const notCompletedCount = jobs.filter(j => !j.isCompleted).length;

let priorityTag = 3;
if (highPriorityWaiting.length > 0) priorityTag = 1;
else if (preApprovalWaiting.length > 0) priorityTag = 2;

return {
  ...vehicle,
  jobs,
  preApprovalWaitingCount: preApprovalWaiting.length,
  finalApprovalWaitingCount: finalApprovalWaiting.length,
  notCompletedCount,
  totalJobs: jobs.length,
  priorityTag
};


    }));

    const sortedVehicles = vehicleList.sort((a, b) => {
      if (a.jobs.length && !b.jobs.length) return -1;
      if (!a.jobs.length && b.jobs.length) return 1;
      return a.priorityTag - b.priorityTag;
    });

    setVehicles(sortedVehicles);
  });

  return () => unsub();
}, [loading, user, role]);

const badgeStyle = (type) => ({
  backgroundColor: type === 'Unknown' ? '#fdd835' : '#90caf9',
  color: '#000',
  padding: '2px 6px',
  borderRadius: '6px',
  fontSize: '0.8rem'
});

const toggleDropdown = (vehicleId) => {
  setOpenDropdownId(prevId => prevId === vehicleId ? null : vehicleId);
};

const handleInputChange = (field, value) => {
  setForm((prev) => ({ ...prev, [field]: value }));
  if (touched[field]) {
    setTouched((prev) => ({ ...prev, [field]: false }));
  }
};


  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

    // ➕ Add Vehicle
  const handleAddVehicle = async (e) => {
    e.preventDefault();

    const missing = {
      plate: !form.plate?.trim(),
      type: !form.type?.trim(),
      vin: !form.vin?.trim(),
      Area: !form.Area?.trim(),
    };

    if (Object.values(missing).some(Boolean)) {
      setTouched(missing);
      return;
    }

    try {
      await addDoc(collection(db, 'vehicles'), {
        plate: form.plate.trim(),
        type: form.type.trim(),
        notes: form.notes?.trim() || '',
        vin: form.vin.trim(),
        Area: form.Area,
        department: form.department?.trim() || '',
        enduser: form.enduser?.trim() || '',
        // store as array for consistency
        recipientEmail: form.recipientEmail
          ? [form.recipientEmail.trim()]
          : [],
        createdAt: Date.now(),
      });

      setForm({
        plate: '',
        type: '',
        notes: '',
        vin: '',
        Area: '',
        department: '',
        enduser: '',
        recipientEmail: '',
      });
      setTouched({ plate: false, type: false, vin: false, Area: false });
    } catch (err) {
      console.error('Error adding vehicle:', err);
      alert('Failed to add vehicle');
    }
  };

  // ✏️ Begin Edit
  const handleStartEdit = (vehicle) => {
    if (role !== 'Admin') return;
    setEditId(vehicle.id);
    setEditForm({
      plate: vehicle.plate || '',
      type: vehicle.type || '',
      notes: vehicle.notes || '',
      vin: vehicle.vin || '',
      Area: vehicle.Area || '',
      department: vehicle.department || '',
      enduser: vehicle.enduser || '',
      recipientEmail: Array.isArray(vehicle.recipientEmail)
        ? vehicle.recipientEmail
        : vehicle.recipientEmail
        ? [vehicle.recipientEmail]
        : [],
    });
  };

  // 💾 Save Edit
  const handleSaveEdit = async (vehicleId) => {
    if (!vehicleId) return;

    const payload = {
      plate: editForm.plate?.trim() || '',
      type: editForm.type?.trim() || '',
      notes: editForm.notes?.trim() || '',
      vin: editForm.vin?.trim() || '',
      Area: editForm.Area || '',
      department: editForm.department?.trim() || '',
      enduser: editForm.enduser?.trim() || '',
    };

    try {
      await updateDoc(doc(db, 'vehicles', vehicleId), payload);
      setEditId(null);
    } catch (err) {
      console.error('Error updating vehicle:', err);
      alert('Failed to update vehicle');
    }
  };

  // 🗑 Delete
  const handleDeleteVehicle = async (id) => {
    if (role !== 'Admin') return;
    if (!id) return;
    const ok = window.confirm('Are you sure you want to delete this vehicle?');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Failed to delete vehicle');
    }
  };

  // ✉️ Email edit (open modal with current emails)
  const handleStartEmailEdit = (vehicle) => {
    setEmailEditId(vehicle.id);
    const current = Array.isArray(vehicle.recipientEmail)
      ? vehicle.recipientEmail
      : vehicle.recipientEmail
      ? [vehicle.recipientEmail]
      : [];
    setEmailInputs(current);
    setNewEmail('');
  };

  // ✉️ Email helpers (used in modal in Part 6)
  const addEmail = () => {
    const email = newEmail.trim();
    if (!email) return;
    if (emailInputs.includes(email)) return;
    setEmailInputs((prev) => [...prev, email]);
    setNewEmail('');
  };

  const removeEmailAt = (idx) => {
    setEmailInputs((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEmails = async () => {
    if (!emailEditId) return;
    try {
      await updateDoc(doc(db, 'vehicles', emailEditId), {
        recipientEmail: emailInputs,
      });
      setEmailEditId(null);
    } catch (err) {
      console.error('Error updating recipientEmail:', err);
      alert('Failed to update emails');
    }
  };

  // 🔢 Type counts for the summary badges
  const typeCounts = visibleVehicles.reduce((acc, v) => {
    const key = v.type || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

    return (
    <div>
      <Header />

      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '8px' }}>Admin Dashboard</h2>
        <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
          All jobs on vehicles must be recorded here. Only jobs with PR need approval.
        </p>

        <button
          onClick={() => navigate('/dashboard-analytics')}
          style={{
            marginBottom: '16px',
            backgroundColor: '#2196f3',
            color: 'white',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px'
          }}
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
      </div>

      {/* ➕ Add Vehicle Form */}
      {role === 'Admin' && (
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
      )}

      {/* 🔍 Search and Export */}
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
            borderRadius: '6px',
          }}
        />
        <button
          onClick={() => setShowExportModal(true)}
          style={{
            padding: '10px 16px',
            backgroundColor: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'background-color 0.3s ease',
            marginLeft: '12px'
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = '#1976d2')}
          onMouseLeave={(e) => (e.target.style.backgroundColor = '#2196f3')}
        >
          📥 Export
        </button>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingLeft: '40px'
      }}>
        {filteredVehicles.map(vehicle => (
          <div key={vehicle.id} style={{
            border: vehicle.priorityTag === 1 ? '2px solid red' : '1px solid #ccc',
            borderRadius: '12px',
            padding: '16px',
            width: '240px',
            backgroundColor: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            cursor: 'pointer',
            textAlign: 'left',
            position: 'relative'
          }} onClick={() => editId ? null : navigate(`/vehicle/${vehicle.id}`)}>

            {/* ✏️ Edit Mode */}
            {editId === vehicle.id ? (
              <>
                <input
                  value={editForm.plate}
                  onChange={(e) => handleEditChange('plate', e.target.value)}
                  placeholder="Plate"
                  style={inputStyle}
                />
                <input
                  value={editForm.type}
                  onChange={(e) => handleEditChange('type', e.target.value)}
                  placeholder="Type"
                  style={inputStyle}
                />
                <input
                  value={editForm.notes}
                  onChange={(e) => handleEditChange('notes', e.target.value)}
                  placeholder="Notes"
                  style={inputStyle}
                />
                <input
                  value={editForm.vin}
                  onChange={(e) => handleEditChange('vin', e.target.value)}
                  placeholder="VIN"
                  style={inputStyle}
                />
                <select
                  value={editForm.Area}
                  onChange={(e) => handleEditChange('Area', e.target.value)}
                  style={{ minWidth: '140px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }}
                >
                  <option value="">Select Area</option>
                  <option value="TNR">TNR</option>
                  <option value="Toamasina">Toamasina</option>
                  <option value="Moramanga">Moramanga</option>
                </select>
                <input
                  value={editForm.department}
                  onChange={(e) => handleEditChange('department', e.target.value)}
                  placeholder="Department"
                  style={inputStyle}
                />
                <input
                  value={editForm.enduser}
                  onChange={(e) => handleEditChange('enduser', e.target.value)}
                  placeholder="End User"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit(vehicle.id);
                    }}
                    style={{
                      backgroundColor: '#4caf50',
                      color: '#fff',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    💾 Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditId(null);
                    }}
                    style={{
                      backgroundColor: '#f44336',
                      color: '#fff',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Cancel
                  </button>
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

                {/* ⋮ Dropdown */}
                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(dropdownOpen === vehicle.id ? null : vehicle.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    ⋮
                  </button>
                  {dropdownOpen === vehicle.id && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      background: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      zIndex: 1,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}>
                      <button
                        style={{ display: 'block', width: '100%', padding: '1px', textAlign: 'left' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(vehicle);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        style={{ display: 'block', width: '100%', padding: '1px', textAlign: 'left', color: 'red' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVehicle(vehicle.id);
                        }}
                      >
                        🗑 Delete
                      </button>
                      <button
                        style={{ display: 'block', width: '100%', padding: '4px', textAlign: 'left' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEmailEdit(vehicle);
                        }}
                      >
                        ✉️ Edit Emails
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {/* 📧 Email Edit Modal */}
      {emailEditId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '10px',
            width: '400px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginBottom: '12px' }}>📧 Edit Recipient Emails</h3>

            <div style={{ marginBottom: '12px' }}>
              {emailInputs.map((email, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span>{email}</span>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'red',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                    onClick={() => removeEmailAt(idx)}
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="Add new email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{
                width: '100%',
                marginBottom: '8px',
                padding: '6px',
                fontSize: '0.9rem',
                borderRadius: '6px',
                border: '1px solid #ccc'
              }}
            />
            <button
              onClick={addEmail}
              style={{
                width: '100%',
                marginBottom: '12px',
                padding: '8px',
                fontSize: '0.9rem',
                backgroundColor: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: '6px'
              }}
            >
              ➕ Add Email
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={saveEmails}
                style={{
                  fontSize: '0.9rem',
                  padding: '8px',
                  width: '48%',
                  backgroundColor: '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px'
                }}
              >
                💾 Save
              </button>
              <button
                onClick={() => setEmailEditId(null)}
                style={{
                  fontSize: '0.9rem',
                  padding: '8px',
                  width: '48%',
                  backgroundColor: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px'
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📥 Export Modal */}
      {showExportModal && (
  <ExportOptions
    vehicles={vehicles}
    onClose={() => setShowExportModal(false)}
  />
)}

    </div>
  );
}
