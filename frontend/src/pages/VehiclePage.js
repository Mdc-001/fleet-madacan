
import { generateReport } from '../utils/generateReport'; // or the correct relative path
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import {
  collection, doc, getDoc, getDocs, onSnapshot,
  addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export default function VehiclePage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [role, setRole] = useState(null);
  const [editId, setEditId] = useState(null);
  const [verificatorNotes, setVerificatorNotes] = useState({});
  const [purchaseFile, setPurchaseFile] = useState(null);

  const [editForm, setEditForm] = useState({
    mechanic: '', description: '', status: '', priority: '',
    purchaseRequestNumber: '', mileage: '', createdAt: '', purchaseFile: null,transfer: false   // ✅ add this
  });
// Add these hooks at the top of your component:
const [showFinalApprovalConfirm, setShowFinalApprovalConfirm] = useState(false);
const [pendingFinalApprovalJob, setPendingFinalApprovalJob] = useState(null);
const [allVehicles, setAllVehicles] = useState([]);
const [fromVehicleId, setFromVehicleId] = useState('');


useEffect(() => {
  const fetchVehicles = async () => {
    const snap = await getDocs(collection(db, 'vehicles'));
    setAllVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };
  fetchVehicles();
}, []);

  const [noteInputs, setNoteInputs] = useState({});
 const [form, setForm] = useState({
  mechanic: '',
  description: '',
  status: 'In Progress',
  priority: 'Medium',
  purchaseRequestNumber: '',
  purchaseFile: null,
  mileage: '',
  createdAt: '',
  transfer: false   // ✅ add this
});


  const [filter, setFilter] = useState({ search: '', status: '', priority: '', approval: '' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdTokenResult();
        setRole(token.claims.role || null);
      } else {
        navigate('/login');
      }
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    getDoc(doc(db, 'vehicles', vehicleId)).then(docSnap => {
      if (docSnap.exists()) setVehicle({ id: docSnap.id, ...docSnap.data() });
    });

    const unsub = onSnapshot(collection(db, 'vehicles', vehicleId, 'jobs'), async (snap) => {
      const jobsData = await Promise.all(
  snap.docs.map(async (d) => {
    const data = d.data();
    const taskSnap = await getDocs(collection(db, 'vehicles', vehicleId, 'jobs', d.id, 'tasks'));
    const tasks = taskSnap.docs.map(t => t.data());
    const allTasksDone = tasks.length > 0 && tasks.every(t => t.completed);

    let computedStatus;
const hasPR = !!data.purchaseFileUrl;

// ✅ 0. If finalApproval is Rejected, override status to Rejected
if (data.finalApprovalStatus === 'Rejected') {
  computedStatus = 'Rejected';
}

// ✅ 1. If manually marked as Completed, keep it
else if (data.status === 'Completed') {
  computedStatus = 'Completed';
}

// ✅ 2. With PR: calculate based on approval & task completion
else if (hasPR) {
  if (data.urgentApproval || (data.adminApprovalStatus === 'Approved' && data.finalApprovalStatus === 'Approved')) {
    computedStatus = allTasksDone ? 'Completed' : 'In Progress';
  } else {
    computedStatus = 'Scheduled';
  }
}

// ✅ 3. No PR = In Progress until manually completed
else {
  computedStatus = 'In Progress';
}


    const approvalStatus = data.urgentApproval
      ? 'Approved'
      : (data.adminApprovalStatus === 'Rejected' || data.finalApprovalStatus === 'Rejected')
        ? 'Rejected'
        : (data.adminApprovalStatus === 'Approved' && data.finalApprovalStatus === 'Approved')
          ? 'Approved'
          : 'Waiting';

    return {
  id: d.id,
  ...data,
  tasks,
  allTasksDone,
  status: computedStatus,
  approvalStatus,
  approvalNote: data.approvalNote || null,
  verificationNote: data.verificationNote || null,     // ✅ add this
  verifiedBy: data.verifiedBy || null,                 // ✅ add this
  verifiedAt: data.verifiedAt || null                  // ✅ add this
};


  })
);
      setJobs(jobsData);
    });
    return () => unsub();
  }, [vehicleId]);



  
  const handleInputChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const handleEditChange = (field, value) => setEditForm(prev => ({ ...prev, [field]: value }));

 const handleStartEdit = (job) => {
  setEditId(job.id);
  setEditForm({
    mechanic: job.mechanic || '',
    description: job.description || '',
    status: job.status || 'In Progress',
    priority: job.priority || 'Medium',
    purchaseRequestNumber: job.purchaseRequestNumber || '',
    mileage: job.mileage || '',
    createdAt: job.createdAt
      ? (job.createdAt.toDate
          ? job.createdAt.toDate().toISOString().substr(0, 10)
          : new Date(job.createdAt).toISOString().substr(0, 10))
      : '',
    purchaseFile: null,
    transfer: !!job.transfer, // ✅ fixed (no inversion)
  });
};



  
  const markJobAsCompletedManually = async (jobId) => {
    try {
      const jobRef = doc(db, 'vehicles', vehicleId, 'jobs', jobId);
      await updateDoc(jobRef, {
        status: 'Completed',
        finishedAt: new Date()
      });
    } catch (err) {
      console.error('❌ Failed to mark job as complete manually:', err);
      alert('Could not mark job as completed.');
    }
  };
  
const handleCreateJob = async () => {
  if (!form.description || !form.mechanic) {
    alert('Please fill in Description and Mechanic');
    return;
  }

   // ✅ If transfer is checked, ensure a vehicle is selected
  if (form.transfer && !fromVehicleId) {
    alert("Please select a vehicle to demande parts");
    return;
  }

  try {
    let purchaseFileUrl = '', purchaseFileName = '';

    // ✅ Upload Purchase Request file if it exists
    if (form.purchaseFile) {
      try {
        const fileRef = ref(
          storage,
          `purchase-requests/${Date.now()}_${form.purchaseFile.name}`
        );
        await uploadBytes(fileRef, form.purchaseFile);
        purchaseFileUrl = await getDownloadURL(fileRef);
        purchaseFileName = form.purchaseFile.name;
      } catch (fileErr) {
        console.warn('⚠️ Failed to upload Purchase Request file:', fileErr);
        // continue without blocking job creation
      }
    }

    // ✅ Main job data
    const jobData = {
      mechanic: form.mechanic,
      description: form.description,
      status: form.status,
      priority: form.priority,
      requester: auth.currentUser?.email || 'Unknown',
      adminApprovalStatus: 'Waiting',
      finalApprovalStatus: 'Waiting',
      urgentApproval: false,
      preApprovalLocked: false,
      finalApprovalLocked: false,
      purchaseRequestNumber: form.purchaseRequestNumber,
      mileage: form.mileage,
      createdAt: form.createdAt ? new Date(form.createdAt) : new Date(),
      purchaseFileUrl,
      purchaseFileName,
      transfer: form.transfer || false
    };

    // ✅ Create the main job
    const jobRef = await addDoc(
      collection(db, 'vehicles', vehicleId, 'jobs'),
      jobData
    );
    const jobId = jobRef.id;

    // ✅ If transfer, create mirrored job in fromVehicleId
    if (form.transfer && fromVehicleId) {
      const requestingVehicleSnap = await getDoc(doc(db, 'vehicles', vehicleId));
      const requestingVehicle = requestingVehicleSnap.exists()
        ? requestingVehicleSnap.data()
        : {};

      const requestingVehicleLabel = `${requestingVehicle.type || 'Vehicle'} - ${
        requestingVehicle.plate || vehicleId
      }`;

      const mirroredJobRef = await addDoc(
        collection(db, 'vehicles', fromVehicleId, 'jobs'),
        {
          description: `Part transferred to vehicle ${requestingVehicleLabel}`,
          mechanic: jobData.mechanic,
          priority: jobData.priority,
          status: jobData.status,
          purchaseRequestNumber: jobData.purchaseRequestNumber || '',
          purchaseFileUrl: jobData.purchaseFileUrl || '',
          purchaseFileName: jobData.purchaseFileName || '',
          createdAt: new Date(),
          transfer: true,
          transferMirror: true,
          toVehicleId: vehicleId,
          mirrorOfJobId: jobId
        }
      );

      await updateDoc(jobRef, { linkedJobId: mirroredJobRef.id });
      console.log('✅ Mirrored job created and linked:', mirroredJobRef.id);
    }

    // ✅ Reset form
    setForm({
      mechanic: '',
      description: '',
      status: 'In Progress',
      priority: 'Medium',
      purchaseRequestNumber: '',
      purchaseFile: null,
      mileage: '',
      createdAt: '',
      transfer: false
    });

  } catch (err) {
    console.error('❌ Error creating job:', err);
    alert('Error creating job. See console for details.');
  }
};



  const handleUpdateProforma = async (jobId, file) => {
  if (!file) {
    alert("Please select a file to upload.");
    return;
  }

  try {
    // Upload to Firebase Storage
    const fileRef = ref(storage, `updated-proformas/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    // Update ONLY the updatedProforma fields in Firestore
    const jobRef = doc(db, 'vehicles', vehicleId, 'jobs', jobId);
    await updateDoc(jobRef, {
      updatedProformaUrl: downloadURL,
      updatedProformaFileName: file.name
    });

    alert("✅ Updated Proforma uploaded successfully.");
    setEditId(null);
    setEditForm(prev => ({ ...prev, purchaseFile: null })); // Reset the file input
  } catch (err) {
    console.error("❌ Failed to upload updated proforma:", err);
    alert("Failed to upload updated Proforma.");
  }
};


  const handleSaveEdit = async (jobId) => {
  try {
    const jobRef = doc(db, 'vehicles', vehicleId, 'jobs', jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) {
      throw new Error("Job document not found");
    }

    const updatedData = {
  mechanic: editForm.mechanic || '',
  description: editForm.description || '',
  priority: editForm.priority || 'Medium',
  status: editForm.status || 'In Progress',
  mileage: editForm.mileage || '',
  purchaseRequestNumber: editForm.purchaseRequestNumber || '',
  createdAt: editForm.createdAt ? new Date(editForm.createdAt) : new Date(),
  transfer: editForm.transfer || false   // ✅ include transfer when saving
};


    if (editForm.purchaseFile) {
  const fileRef = ref(storage, `purchase-requests/${Date.now()}_${editForm.purchaseFile.name}`);
  await uploadBytes(fileRef, editForm.purchaseFile);
  const downloadURL = await getDownloadURL(fileRef);
  updatedData.purchaseFileUrl = downloadURL;
  updatedData.purchaseFileName = editForm.purchaseFile.name;
}



    await updateDoc(jobRef, updatedData);
    setEditId(null);
  } catch (err) {
    console.error('❌ Error in handleSaveEdit:', err.message, err);
    alert('Failed to save job edits.');
  }
};


const handleSaveApprovalNote = async (jobId) => {
  const note = noteInputs[jobId]?.trim();
  if (!note) {
    alert("Note cannot be empty.");
    return;
  }

  try {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), {
      approvalNote: note
    });
    console.log(`✅ Saved approval note for job ${jobId}`);
    setNoteInputs((prev) => ({ ...prev, [jobId]: '' }));
  } catch (err) {
    console.error(`❌ Failed to save approval note for job ${jobId}:`, err);
    alert("Failed to save approval note.");
  }
};

const handleSaveFinalApprovalNote = async (jobId) => {
  const note = noteInputs[`final-${jobId}`]?.trim();
  if (!note) {
    alert("Final Approval Note cannot be empty.");
    return;
  }

  try {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), {
      finalApprovalNote: note
    });
    console.log(`✅ Saved final approval note for job ${jobId}`);
    setNoteInputs((prev) => ({ ...prev, [`final-${jobId}`]: '' }));
  } catch (err) {
    console.error(`❌ Failed to save final approval note for job ${jobId}:`, err);
    alert("Failed to save final approval note.");
  }
};


const handleDeletePR = async (jobId, fileUrl) => {
  if (!window.confirm("Are you sure you want to delete this PR file?")) return;

  try {
    // Get the full path after /o/ to decode the filename correctly
    const pathPart = decodeURIComponent(fileUrl.split("/o/")[1].split("?")[0]);
    const fileRef = ref(storage, pathPart);

    await deleteObject(fileRef); // 🔥 Delete from Firebase Storage

    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), {
      purchaseFileUrl: '',
      purchaseFileName: ''
    });

    console.log(`✅ Deleted PR file from Storage and cleared Firestore fields for job ${jobId}`);
  } catch (err) {
    console.error(`❌ Failed to delete PR file for job ${jobId}:`, err.message);
    alert('Failed to delete PR file. Please check console for details.');
  }
};

  const handleDeleteJob = async (jobId) => {
  if (!window.confirm("Are you sure you want to delete this job card? This action cannot be undone.")) return;

  try {
    const jobRef = doc(db, 'vehicles', vehicleId, 'jobs', jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) {
      console.warn("⚠️ Job document not found in Firestore.");
      alert("Job does not exist or was already deleted.");
      return;
    }

    const data = jobSnap.data();

    // ✅ Call the PR deletion helper
    if (data.purchaseFileUrl) {
      await handleDeletePR(jobId, data.purchaseFileUrl);
    }

    // 🗑️ Delete the job document
    await deleteDoc(jobRef);
    alert("✅ Job successfully deleted.");
    console.log("✅ Job document deleted from Firestore.");
  } catch (err) {
    console.error("❌ Unexpected error during job deletion:", err);
    alert("An unexpected error occurred while deleting the job.");
  }
};

  const updateApprovalField = async (jobId, field, value) => {
  const updatePayload = { [field]: value };

  const currentUser = auth.currentUser?.email || 'Unknown';
  const now = new Date();

  // Set metadata per approval type
  if (field === 'adminApprovalStatus' && value === 'Approved') {
    updatePayload.preApprovalLocked = true;
    updatePayload.preApprovedBy = currentUser;
    updatePayload.preApprovedAt = now;
  }

  if (field === 'finalApprovalStatus' && value === 'Approved') {
    updatePayload.finalApprovalLocked = true;
    updatePayload.finalApprovedBy = currentUser;
    updatePayload.finalApprovedAt = now;
  }

  // Optional: Keep backward compatibility (if needed elsewhere)
  if (value === 'Approved') {
    updatePayload.approvedBy = currentUser;
    updatePayload.approvedAt = now;
  }

  await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), updatePayload);
};


  const handleUrgentApproval = async (jobId) => {
    if (!window.confirm("Confirm URGENT approval without Admin validation?")) return;
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), {
      urgentApproval: true,
      finalApprovalStatus: 'Approved',
      approvedBy: auth.currentUser?.email || 'Unknown',
      approvedAt: new Date()
    });
  };

  const getBadgeStyle = (status) => {
    const colors = {
      Approved: 'green', Rejected: 'red', Waiting: 'gray', Scheduled: '#0277bd',
      'In Progress': '#f9a825', Completed: '#2e7d32', Archived: '#6d4c41'
    };
    return {
      backgroundColor: colors[status] || 'gray', color: 'white', borderRadius: '4px',
      padding: '2px 6px', marginLeft: '5px', fontSize: '0.8rem'
    };
  };

  const getCardBackground = (status) => {
    const backgrounds = {
      Scheduled: '#e3f2fd', 'In Progress': '#fff8e1', Completed: '#e8f5e9', Archived: '#efebe9'
    };
    return backgrounds[status] || '#fff';
  };

  const filteredJobs = jobs.filter(job => {
    const s = filter.search.toLowerCase();
    return (
      (!filter.status || job.status === filter.status) &&
      (!filter.priority || job.priority === filter.priority) &&
      (!filter.approval || job.approvalStatus === filter.approval) &&
      (job.description?.toLowerCase().includes(s) || job.mechanic?.toLowerCase().includes(s))
    );
  }).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => navigate(-1)}>⬅ Back</button>
      <h2>Vehicle: {vehicle?.plate || 'Loading...'}</h2>

      {(role === 'Admin' || role === 'User') && (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      handleCreateJob();
    }}
    style={{
      marginBottom: '32px',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '12px',
      backgroundColor: '#f9f9f9',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}
  >
    <h3 style={{ marginBottom: '16px', color: '#333' }}>➕ Create Job Card</h3>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        justifyContent: 'flex-start',
      }}
    >
      <input
        type="text"
        placeholder="Description *"
        value={form.description}
        onChange={(e) => handleInputChange('description', e.target.value)}
        required
        style={{ flex: '1 1 200px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <input
        type="text"
        placeholder="Assign Technician *"
        value={form.mechanic}
        onChange={(e) => handleInputChange('mechanic', e.target.value)}
        required
        style={{ flex: '1 1 200px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <select
        value={form.priority}
        onChange={(e) => handleInputChange('priority', e.target.value)}
        style={{ flex: '1 1 150px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
      </select>

      <input
        type="text"
        placeholder="Mileage"
        value={form.mileage}
        onChange={(e) => handleInputChange('mileage', e.target.value)}
        style={{ flex: '1 1 150px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <input
        type="text"
        placeholder="PR Number"
        value={form.purchaseRequestNumber}
        onChange={(e) => handleInputChange('purchaseRequestNumber', e.target.value)}
        style={{ flex: '1 1 180px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => handleInputChange('purchaseFile', e.target.files[0])}
        style={{ flex: '1 1 200px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <input
        type="date"
        value={form.createdAt}
        onChange={(e) => handleInputChange('createdAt', e.target.value)}
        style={{ flex: '1 1 180px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

        {/* ✅ Transfer Checkbox */}
  <label style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: '6px' }}>
    <input
      type="checkbox"
      checked={form.transfer || false}
      onChange={(e) => handleInputChange('transfer', e.target.checked)}
    />
    Transfer
  </label>

{form.transfer && (
  <select
    value={fromVehicleId}
    onChange={(e) => setFromVehicleId(e.target.value)}
    style={{ flex: '1 1 250px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
  >
    <option value="">-- Select From Vehicle --</option>
    {allVehicles
      .filter(v => v.id !== vehicleId) // ✅ prevent selecting itself
      .map(v => (
        <option key={v.id} value={v.id}>
          {v.plate || v.type || v.id}
        </option>
      ))}
  </select>
)}

    
      <button
        type="submit"
        style={{
          flex: '1 1 180px',
          backgroundColor: '#2196f3',
          color: 'white',
          padding: '10px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        ✅ Add Job
      </button>
    </div>
  </form>
)}



   <div
  style={{
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '10px 16px',
    borderRadius: '10px',
    backgroundColor: '#f0f4f8', // 🔵 Custom background color
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    maxWidth: '700px',
    marginLeft: '0',        // 🔄 Align to left
    marginRight: 'auto'     // 🔄 Avoid centering
  }}
>
  <input
    type="text"
    placeholder="Search..."
    value={filter.search}
    onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
    style={{
      width: '160px',
      padding: '8px',
      fontSize: '13px',
      borderRadius: '6px',
      border: '1px solid #ccc'
    }}
  />

  <select  value={filter.status}  onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
    style={{
      width: '160px',
      padding: '8px',
      fontSize: '13px',
      borderRadius: '6px',
      border: '1px solid #ccc'
    }}
  >
    <option value="">All Status</option>
    <option>Scheduled</option>
    <option>In Progress</option>
    <option>Completed</option>
    <option>Archived</option>
  </select>

  <select   value={filter.priority}    onChange={(e) => setFilter(f => ({ ...f, priority: e.target.value }))}
    style={{
      width: '160px',
      padding: '8px',
      fontSize: '13px',
      borderRadius: '6px',
      border: '1px solid #ccc'
    }}
  >
    <option value="">All Priorities</option>
    <option>Low</option>
    <option>Medium</option>
    <option>High</option>
  </select>

  <select    value={filter.approval}   onChange={(e) => setFilter(f => ({ ...f, approval: e.target.value }))}
    style={{
      width: '160px',
      padding: '8px',
      fontSize: '13px',
      borderRadius: '6px',
      border: '1px solid #ccc'
    }}
  >
    <option value="">All Approvals</option>
    <option>Waiting</option>
    <option>Approved</option>
    <option>Rejected</option>
  </select>
</div>



            <h3 style={{ marginTop: '30px', fontSize: '1.5rem', color: '#333' }}>🗂 Job Cards</h3>

      {filteredJobs.map((job) => (
        <div
          key={job.id}
          style={{
            border: '1px solid #ccc',
            padding: '16px',
            marginBottom: '18px',
            borderRadius: '8px',
            background: getCardBackground(job.status),
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
        <div
  key={job.id}
  style={{
    border: '1px solid #ddd',
    borderRadius: '10px',
    backgroundColor: '#fffef5',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  }}
>
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: '30px',
      rowGap: '10px',
      fontSize: '15px',
      marginBottom: '15px',
    }}
  >
    <div><strong>🛎 Status:</strong> <span style={getBadgeStyle(job.status)}>{job.status}</span></div>
    <div><strong>🎯 Priority:</strong> <span style={getBadgeStyle(job.priority)}>{job.priority}</span></div>
    <div><strong>📄 PR Number:</strong> <span style={{ color: '#444' }}>{job.purchaseRequestNumber || 'N/A'}</span></div>
    <div>
      <strong>📝 Description:</strong><br />
      <span style={{ fontWeight: 'bold', color: '#c0392b', display: 'inline-block' }}>
        {job.description || 'N/A'}
      </span>
    </div>
    <div><strong>🛠 Mechanic:</strong> <span style={{ color: '#444' }}>{job.mechanic || 'N/A'}</span></div>
    <div><strong>👤 Requester:</strong> <span style={{ color: '#007BFF' }}>{job.requester || 'N/A'}</span></div>
    <div><strong>🕓 Created:</strong> <span style={{ color: '#444' }}>{job.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}</span></div>
    <div><strong>✏️ Mileage:</strong> <span style={{ color: '#444' }}>{job.mileage || 'N/A'}</span></div>
    {job.transfer && (
  <div><strong>🔄 Transfer</strong></div>
)}
  </div>

.................................................................................
  {/* Add your approval section + buttons here */}
  <div style={{ marginTop: '10px' }}>
    {/* For example: */}
    <strong>Pre-approval:</strong> {job.adminApprovalStatus}<br />
    <strong>Final Approval:</strong> {job.finalApprovalStatus}<br />
    {/* Add Edit/Delete/Open buttons as you already have */}
  </div>
</div>


  {/* :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: */}

          {job.purchaseFileUrl && (
            <div style={{ marginBottom: '6px' }}>
              📎 <a href={job.purchaseFileUrl} target="_blank" rel="noopener noreferrer">View PR File ({job.purchaseFileName || 'Open'})</a>
            </div>
          )}

          {job.updatedProformaUrl && (
            <div style={{ marginBottom: '6px' }}>
              📄 <a href={job.updatedProformaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#388e3c' }}>View Updated Proforma ({job.updatedProformaFileName || 'Open'})</a>
            </div>
          )}


    

  {/* Delete PR (Admin Only) */}
  {role === 'Admin' && job.purchaseFileUrl && (
    <button
      onClick={() => handleDeletePR(job.id, job.purchaseFileUrl)}
      style={{
        marginTop: '5px',
        marginLeft: '10px',
        backgroundColor: 'transparent',
        color: 'red',
        border: '1px solid red',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer'
      }}
    >
      ❌ Delete PR File
    </button>
  )}

{/* ✅ Verificator input (only if not already saved and job is open) */}
{role === 'verificator' &&
 !job.verificationNote &&
 job.status !== 'Completed' &&
 job.status !== 'In Progress' && (
  <div style={{ marginTop: '10px' }}>
    <textarea
      placeholder="Add verification note (An email will be sent to the Final approval after click on Verified )..."
      rows="2"
      value={verificatorNotes[job.id] || ''}
      onChange={(e) =>
        setVerificatorNotes((prev) => ({ ...prev, [job.id]: e.target.value }))
      }
      style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
    />
    <button
     onClick={async () => {
  const note = verificatorNotes[job.id]?.trim();
  if (!note) {
    alert("Verification note cannot be empty.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to verify.");
    return;
  }

  try {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', job.id), {
  verificationNote: note,
  verifiedBy: user.email,
  verifiedAt: Timestamp.now()
});
    alert("✅ Verification note saved.");
    setVerificatorNotes((prev) => ({ ...prev, [job.id]: '' }));
  } catch (err) {
    console.error("❌ Failed to save verification note:", err);
    alert("Failed to save verification note.");
  }
}}
      style={{
        marginTop: '6px',
        backgroundColor: '#388e3c',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        cursor: 'pointer'
      }}
    >
      ✅ Verified
    </button>
  </div>
)}

{/* ✅ Display verification note only to Admin/Approval */}
{(role === 'Admin' || role === 'Approval' || role === 'verificator') && job.verificationNote && (
  <div style={{ backgroundColor: '#f1f8e9', border: '1px solid #c5e1a5', padding: '10px', borderRadius: '6px', marginTop: '12px' }}>
    <strong>🔍 Verificator Note:</strong><br />
    {job.verificationNote}

    {(job.verifiedBy || job.verifiedAt) && (
      <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '8px' }}>
        ✅ Verified by: {job.verifiedBy || 'N/A'}<br />
        📅 On: {job.verifiedAt?.toDate?.() ? job.verifiedAt.toDate().toLocaleDateString() : 'N/A'}
      </div>
    )}
  </div>
)}


{role === 'Approval' &&
  !job.finalApprovalNote &&  // ✅ Fix: note doesn't exist yet
  !job.finalApprovalLocked &&
  job.status !== 'Completed' &&
  job.status !== 'Rejected'&&
  job.status !== 'In Progress' && (
    <div style={{ marginTop: '10px' }}>
      <textarea
        rows="2"
        placeholder="Add  Note (An email will be sent to the receipient after click on Save note )..."
        value={noteInputs[`final-${job.id}`] || ''}
        onChange={(e) =>
          setNoteInputs((prev) => ({
            ...prev,
            [`final-${job.id}`]: e.target.value
          }))
        }
        style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
      />
      <button
        onClick={() => handleSaveFinalApprovalNote(job.id)}
        style={{
          marginTop: '5px',
          backgroundColor: '#00695c',
          color: 'white',
          padding: '6px 10px',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        💾 Save Note
      </button>
    </div>
)}


{job.finalApprovalNote && (
  <div
    style={{
      backgroundColor: '#e3f2fd',
      border: '1px solid #90caf9',
      padding: '12px 8px',
      borderRadius: '4px',
      marginTop: '16px',
      fontStyle: 'italic',
      fontSize: '1rem'
    }}
  >
    📝 <strong>Note:</strong><br />
    {job.finalApprovalNote}
  </div>
)}


  {/* ✅ APPROVAL INSTRUCTION INPUT (Approval Role Only) */}
  {role === 'Approval' &&
 (!job.approvalNote || !job.approvalNote.trim()) &&
 job.status !== 'Completed' &&
 job.status !== 'Rejected' && 
  job.status !== 'In Progress' &&(
    <div style={{ marginTop: '10px' }}>
      <textarea
        rows="2"
        placeholder="Add approbation instructions (An email will sent to the SCM team right after click on approved)..."
        value={noteInputs[job.id] || ''}
        onChange={(e) =>
          setNoteInputs((prev) => ({ ...prev, [job.id]: e.target.value }))
        }
        style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
      />
      <button
        onClick={() => handleSaveApprovalNote(job.id)}
        style={{
          marginTop: '5px',
          backgroundColor: '#1976d2',
          color: 'white',
          padding: '6px 10px',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        💾 Save the instructions
      </button>
    </div>
)}

  {job.approvalNote && (
    <div
      style={{
        backgroundColor: '#f1f8e9',
        border: '1px solid #c5e1a5',
        padding: '12px 8px',
        borderRadius: '4px',
        marginTop: '16px',
        fontStyle: 'italic',
        fontSize: '1rem'
      }}
    >
      📝 <strong>Approbation Instructions:</strong><br />
      {job.approvalNote}
    </div>
  )}
          {job.status === 'Completed' && job.finishedAt?.toDate && (
      <div style={{ color: '#2e7d32', fontWeight: 'bold' }}>
        ✅ Finished: {job.finishedAt.toDate().toLocaleDateString()}
      </div>
    )}


<div style={{ marginTop: '8px' }}>
  {job.adminApprovalStatus === 'Approved' && job.approvedBy && (
    <>
      <div>✅ Approved by: {job.approvedBy}</div>
      <div>📅 Date: {job.approvedAt?.toDate?.().toLocaleDateString() || 'N/A'}</div>
    </>
  )}

  {job.urgentApproval && (
    <div style={{
      backgroundColor: '#ffe0e0',
      border: '1px solid red',
      padding: '8px',
      borderRadius: '4px',
      marginTop: '8px'
    }}>
      <strong style={{ color: 'red' }}>🚨 Urgent Approval Enabled</strong><br />
      <span>✅ By: {job.approvedBy || 'Unknown'}</span><br />
      <span>📅 Date: {job.approvedAt?.toDate?.().toLocaleDateString() || 'N/A'}</span>
    </div>
  )}

  {!job.urgentApproval && job.adminApprovalStatus === 'Approved' && (
    <div style={{ marginTop: '6px' }}>
      <strong>Final Approval:</strong> {job.finalApprovalStatus}<br />
      {job.finalApprovalStatus === 'Approved' && job.approvedBy && (
        <>
          <span>✅ By: {job.approvedBy}</span><br />
          <span>📅 Date: {job.approvedAt?.toDate?.().toLocaleDateString() || 'N/A'}</span>
        </>
      )}
    </div>
  )}

  <div style={{ marginTop: '10px' }}>
    
  </div>
</div>



{role === 'Admin' && (
  <>
    {/* Locked Pre-approval */}
    <div>
      <label>Pre-approval: </label>
      <select
        value={job.adminApprovalStatus || 'Waiting'}
        onChange={async (e) => {
          const selected = e.target.value;

          // Block pre-approval if there's no PR
          if (!job.purchaseFileUrl && selected === 'Approved') {
            alert('❌ Job created without a Purchase Request. Pre-approval is not allowed.');
            return;
          }

          // Update main job
          await updateApprovalField(job.id, 'adminApprovalStatus', selected);

          // 🔁 Mirror job sync
          if (job.mirrorJobId && job.fromVehicleId) {
            const mirrorRef = doc(db, 'vehicles', job.fromVehicleId, 'jobs', job.mirrorJobId);
            await updateDoc(mirrorRef, { adminApprovalStatus: selected });
          }
        }}
        disabled={job.preApprovalLocked}
      >
        <option value="Waiting">Waiting</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
    </div>

   {/* Admin unlock dropdown */}
<div style={{ marginTop: '10px' }}>
  <label>Edit Approval: </label>
  <select
    onChange={async (e) => {
      const action = e.target.value;
      if (!action) return;

      const updates = {};

      if (action === 'unlockPre') {
        updates.preApprovalLocked = false;
        updates.finalApprovalStatus = 'Waiting'; // ✅ Reset to Waiting
      }

      if (action === 'unlockFinal') {
        updates.finalApprovalLocked = false;
        updates.finalApprovalStatus = 'Waiting'; // ✅ Reset to Waiting
        updates.approvedBy = null;
        updates.approvedAt = null;
      }

      if (action === 'unlockRegular') {
        updates.finalApprovalLocked = false;
        updates.finalApprovalStatus = 'Approved as Regular'; // ✅ Restore Regular Approval
        updates.approvedBy = null;
        updates.approvedAt = null;
      }

      // Update main job
      await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', job.id), updates);

      // 🔁 Mirror sync
      if (job.mirrorJobId && job.fromVehicleId) {
        const mirrorRef = doc(db, 'vehicles', job.fromVehicleId, 'jobs', job.mirrorJobId);
        await updateDoc(mirrorRef, updates);
      }

      e.target.value = ''; // reset dropdown
    }}
  >
    <option value="">-- Edit Approval --</option>
    <option value="unlockPre">Unlock Pre-approval</option>
    <option value="unlockFinal">Unlock Final Approval </option>
  </select>
</div>
  </>
)}



<button
  onClick={() => {
    console.log('📄 Generating report for:', job);
    generateReport(vehicleId, job);
  }}
  style={{
    marginTop: '10px',
    backgroundColor: '#3f51b5',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer'
  }}
>
  📄 Download Report
</button>

{/* ✅ Scm can update Proforma if PR exists and final approval not given */}
{role === 'Scm' &&
 editId === job.id && (
  <div style={{
    marginTop: '12px',
    borderTop: '1px solid #ddd',
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  }}>
    <label style={{ fontWeight: 'bold' }}>Upload Updated Proforma (PDF or image):</label>
    <input
      type="file"
      accept="application/pdf,image/*"
      onChange={(e) => handleEditChange('purchaseFile', e.target.files[0])}
      style={{ fontSize: '0.95rem' }}
    />

    {job.updatedProformaUrl && (
      <div>
        <strong>📎 Updated Proforma:</strong>{' '}
        <a
          href={job.updatedProformaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline', color: '#1976d2' }}
        >
          {job.updatedProformaFileName || 'View File'}
        </a>
      </div>
    )}

    {!job.updatedProformaUrl && (
      <div>
        <button
          onClick={() => handleUpdateProforma(job.id, editForm.purchaseFile)}
          style={{
            backgroundColor: '#388e3c',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            border: 'none',
            marginRight: '10px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          💾 Save Updated Proforma
        </button>
        <button
          onClick={() => setEditId(null)}
          style={{
            backgroundColor: '#e53935',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ❌ Cancel
        </button>
      </div>
    )}
  </div>
)}

{role === 'Scm' &&
 job.purchaseFileUrl &&
 !job.updatedProformaUrl &&
 job.finalApprovalStatus !== 'Approved' &&
 editId !== job.id && (
  <div style={{ marginTop: '12px', textAlign: 'left' }}>
    <button
      onClick={() => handleStartEdit(job)}
      style={{
        backgroundColor: '#ffa000',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      ✏️ Update Proforma
    </button>
  </div>
)}



       {role === 'User' &&
 !job.finishedAt &&
 job.status !== 'Completed' &&
 job.status !== 'Rejected' &&
 !job.purchaseFileUrl && (
  <div style={{ marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
    {editId === job.id ? (
      <>
  <input
    placeholder="PR Number"
    value={editForm.purchaseRequestNumber}
    onChange={(e) => handleEditChange('purchaseRequestNumber', e.target.value)}
  />
  <input
    type="file"
    accept="application/pdf"
    onChange={(e) => handleEditChange('purchaseFile', e.target.files[0])}
  />
  <button onClick={() => handleSaveEdit(job.id)}>💾 Save</button>
  <button onClick={() => setEditId(null)}>❌ Cancel</button>
</>

    ) : 
    
    (
      <button onClick={() => handleStartEdit(job)}>✏️ Update PR</button>
    )}

    {job.allTasksDone && job.status !== 'Completed' && (
      <button
        onClick={() => markJobAsCompletedManually(job.id)}
        style={{
          marginTop: '10px',
          backgroundColor: '#4caf50',
          color: 'white',
          padding: '6px 10px',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        ✅ Mark Job as Complete
      </button>
    )}
  </div>
)}


{role === 'Approval' && (
  <div>
    {job.adminApprovalStatus === 'Approved' ? (
      <>
        <label>Final Approval: </label>
        <select
          value={job.finalApprovalStatus || 'Waiting'}
          onChange={async (e) => {
            const selected = e.target.value;

            // Show confirmation modal only for strict "Approved"
            if (selected === 'Approved' && !job.updatedProformaUrl) {
              setPendingFinalApprovalJob(job.id);
              setShowFinalApprovalConfirm(true);
              return;
            }

            // Lock immediately if "Approved as Regular"
            if (selected === 'Approved as Regular') {
              await updateApprovalField(job.id, 'finalApprovalStatus', selected);
              await updateApprovalField(job.id, 'finalApprovalLocked', true);
              return;
            }

            // Handle other status changes
            await updateApprovalField(job.id, 'finalApprovalStatus', selected);
          }}
          disabled={
            !!job.finalApprovalLocked ||
            job.finalApprovalStatus === 'Approved' ||
            job.finalApprovalStatus === 'Approved as Regular'
          }
        >
          <option value="Waiting">Waiting</option>
          <option value="Approved">Approved</option>
          <option value="Approved as Regular">Approved as Regular</option>
          <option value="Rejected">Rejected</option>
        </select>
      </>
    ) : (
      <i>Waiting for Admin pre-approval</i>
    )}

    {!job.urgentApproval && job.finalApprovalStatus !== 'Approved' && (
      <button
        onClick={() => handleUrgentApproval(job.id)}
        style={{
          marginTop: '10px',
          backgroundColor: 'orange',
          color: 'white',
          padding: '5px 10px',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        🚨 Approve as Urgent
      </button>
    )}
  </div>
)}




{showFinalApprovalConfirm && (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '10px',
      width: '90%',
      maxWidth: '400px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      textAlign: 'center'
    }}>
      <h3 style={{ marginBottom: '10px', color: '#d32f2f' }}>⚠ No uploaded Proforma</h3>
      <p style={{ fontSize: '15px', color: '#444' }}>
        This job does not have Proforma uploaded.<br /><br />
        Are you sure you want to approve it anyway?
      </p>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => {
            updateApprovalField(pendingFinalApprovalJob, 'finalApprovalStatus', 'Approved');
            setShowFinalApprovalConfirm(false);
            setPendingFinalApprovalJob(null);
          }}
          style={{
            backgroundColor: '#388e3c',
            color: 'white',
            padding: '8px 16px',
            marginRight: '10px',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          ✅ Approve Anyway
        </button>

        <button
          onClick={() => {
            setShowFinalApprovalConfirm(false);
            setPendingFinalApprovalJob(null);
          }}
          style={{
            backgroundColor: '#b71c1c',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  </div>
)}



         {editId === job.id && role === 'Admin' && (
  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
    
    <input
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      placeholder="Mechanic"
      value={editForm.mechanic}
      onChange={(e) => handleEditChange('mechanic', e.target.value)}
    />
    
    <input
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      placeholder="Description"
      value={editForm.description}
      onChange={(e) => handleEditChange('description', e.target.value)}
    />
    
    <select
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      value={editForm.priority}
      onChange={(e) => handleEditChange('priority', e.target.value)}
    >
      <option>Low</option>
      <option>Medium</option>
      <option>High</option>
    </select>
    
    <select
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      value={editForm.status}
      onChange={(e) => handleEditChange('status', e.target.value)}
    >
      <option>Scheduled</option>
      <option>In Progress</option>
      <option>Completed</option>
      <option>Archived</option>
    </select>
    
    <input
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      placeholder="PR Number"
      value={editForm.purchaseRequestNumber}
      onChange={(e) => handleEditChange('purchaseRequestNumber', e.target.value)}
    />
    
    <input
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      placeholder="Mileage"
      value={editForm.mileage}
      onChange={(e) => handleEditChange('mileage', e.target.value)}
    />
    
    <input
      type="date"
      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
      value={editForm.createdAt}
      onChange={(e) => handleEditChange('createdAt', e.target.value)}
    />
    
    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <input
        type="checkbox"
        checked={editForm.transfer}
        onChange={(e) => handleEditChange('transfer', e.target.checked)}
      />
      Transfer
    </label>
    
    <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
      <button style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer' }}
        onClick={() => handleSaveEdit(job.id)}
      >
        💾 Save
      </button>
      <button style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#f44336', color: '#fff', border: 'none', cursor: 'pointer' }}
        onClick={() => setEditId(null)}
      >
        ❌ Cancel
      </button>
    </div>

  </div>
)}


        {role === 'Admin' && editId !== job.id && (
          <>
            <button style={{ marginTop: '10px' }} onClick={() => handleStartEdit(job)}>✏️ Edit</button>
            <button
              onClick={() => handleDeleteJob(job.id)}
              style={{ marginTop: '10px', color: 'red' }}
            >
              🗑 Delete
            </button>
          </>
        )}

          <button onClick={() => navigate(`/vehicle/${vehicleId}/job/${job.id}`)} style={{ marginTop: '10px' }}>Open</button>
        </div>
      ))}
    </div>
  );
}