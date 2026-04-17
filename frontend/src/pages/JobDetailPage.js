// --- JobDetailPage.js (With Image Compression + Upload Progress Bars) ---

import imageCompression from 'browser-image-compression';
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  getDocs,
  collection,
  setDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

const storage = getStorage();

const getBadgeStyle = (value, type) => {
  const map = {
    priority: { Low: '#2196f3', Medium: '#f9a825', High: '#d32f2f' },
    arrivalStatus: { 'Waiting for delivery': 'gray', 'Ready for pickup': 'orange', 'Delivered': 'green' }
  };
  return {
    backgroundColor: map[type][value] || 'gray',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '12px',
    marginLeft: '6px',
    fontSize: '0.75rem'
  };
};

import { deleteDoc } from 'firebase/firestore';


const getApprovalBadgeStyle = (status) => {
  if (status === 'Approved') return { backgroundColor: 'green', color: 'white', borderRadius: '4px', padding: '2px 6px' };
  if (status === 'Rejected') return { backgroundColor: 'red', color: 'white', borderRadius: '4px', padding: '2px 6px' };
  return { backgroundColor: 'gray', color: 'white', borderRadius: '4px', padding: '2px 6px' };
};

const TaskCard = ({ task, role, isEditable, updateTask, handleToggleComplete, handleUploadImage, removeImage, uploadingTaskId, uploadProgress, handleDeleteTask }) => {
  const [showReturnedInput, setShowReturnedInput] = useState(false);
  const renderImageUploader = (label, type, image, alt) => (
    <>
      <label>{label}</label>
      <input type="file" accept="image/*" onChange={(e) => handleUploadImage(task.id, type, e.target.files[0])} disabled={role === 'Approval'} /><br />
      {uploadingTaskId === `${task.id}-${type}` && (
        <div style={{ marginTop: '4px' }}>
          <progress max="100" value={uploadProgress} style={{ width: '100%' }} />
        </div>
      )}
      {image && (
        <div>
          <a href={image} target="_blank" rel="noopener noreferrer">
            <img src={image} alt={alt} loading="lazy" style={{ width: '5cm', height: '3cm', objectFit: 'cover', borderRadius: '4px', marginTop: '6px', cursor: 'pointer' }} />
          </a>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>{alt}</div>
          {role === 'Admin' && (
            <button onClick={() => removeImage(task.id, type, image)}>🗑 Remove</button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div key={task.id} style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '15px', borderRadius: '8px', background: task.completed ? '#f0f0f0' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '1.1rem' }}>{task.name}</strong>
        <span style={getBadgeStyle(task.priority, 'priority')}>{task.priority}</span>
      </div>
      <p>{task.description}</p>
      
      <p>📅 {task.startDate} ➡ {task.endDate}</p>
      <p>⏱ Est: {task.estimatedTime}h / Act: {task.actualTime}h</p>
      <textarea
        value={task.notes || ''}
        onChange={(e) => updateTask(task.id, 'notes', e.target.value)}
        disabled={!isEditable || (task.completed && role !== 'Admin')}
        style={{ width: '100%', minHeight: '60px', marginTop: '8px' }}
        placeholder="Notes..."
      />

      {(role !== 'Approval') && (
        <div style={{ marginTop: '10px' }}>
          <button onClick={() => handleToggleComplete(task.id)} disabled={task.completed && role !== 'Admin'}>
            {task.completed ? '↩ Reopen' : '✅ Mark as Done'}
          </button>
        </div>
      )}

      {(role === 'Admin' || role === 'User' || role === 'Approval') && (
        <div style={{ marginTop: '10px' }}>
          {renderImageUploader('📷 Before Image:', 'beforeImage', task.beforeImage, 'Before')}
          {renderImageUploader('📷 After Image:', 'afterImage', task.afterImage, 'After')}

          {(role === 'Admin' || role === 'User') && (
            <div style={{ marginTop: '10px' }}>
              {!showReturnedInput && !task.returnedPartImage && (
                <button onClick={() => setShowReturnedInput(true)}>➕ Add Returned Working Part</button>
              )}
              {(showReturnedInput || task.returnedPartImage) && (
                <>
                  {renderImageUploader('🔁 Returned Working Part:', 'returnedPartImage', task.returnedPartImage, 'Returned Part')}
                  {!task.returnedPartImage && (
                    <div style={{ marginTop: '8px' }}>
                      <button onClick={() => setShowReturnedInput(false)}>❌ Cancel</button>
                    
                    </div>
                    
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
       {role === 'Admin' && (
  <button
    onClick={() => handleDeleteTask(task.id)}
    style={{ marginTop: '8px', backgroundColor: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}
  >
    🗑 Delete Task
  </button>
)}

    </div>
  );
};



export default function JobDetailPage() {
  const { vehicleId, jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ name: '', description: '', startDate: '', endDate: '', estimatedTime: '', actualTime: '', priority: 'Medium', assignedTo: ''});
  const [role, setRole] = useState(null);
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdTokenResult();
        setRole(token.claims.role);
      } else {
        navigate('/login');
      }
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (job) {
      setTaskForm(prev => ({
        ...prev,
        assignedTo: job.mechanic || ''
      }));
    }
  }, [job]);

  useEffect(() => {
    let unsubJob = () => {};
    let unsubTasks = () => {};
    let unsubAuth = () => {};

    unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const jobRef = doc(db, 'vehicles', vehicleId, 'jobs', jobId);
        unsubJob = onSnapshot(jobRef, (docSnap) => {
          if (docSnap.exists()) setJob({ id: docSnap.id, ...docSnap.data() });
        });

        const tasksRef = collection(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks');
        unsubTasks = onSnapshot(tasksRef, (snap) => {
          setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      } else {
        setJob(null);
        setTasks([]);
        navigate('/login');
      }
    });

    return () => {
      unsubJob();
      unsubTasks();
      unsubAuth();
    };
  }, [vehicleId, jobId, navigate]);

  const handleDeleteTask = async (taskId) => {
  if (!window.confirm("Are you sure you want to delete this task?")) return;
  try {
    await deleteDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks', taskId));
    console.log(`✅ Deleted task: ${taskId}`);
  } catch (err) {
    console.error(`❌ Failed to delete task: ${taskId}`, err);
    alert('Failed to delete the task.');
  }
};
  const handleTaskFormChange = (field, value) => {
    setTaskForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTask = async () => {
    if (!taskForm.name) return;
    const newTask = { ...taskForm, completed: false, beforeImage: '', afterImage: '', notes: '' };
    const taskId = Date.now().toString();
    await setDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks', taskId), newTask);
    setTaskForm({ name: '', description: '', startDate: '', endDate: '', estimatedTime: '', actualTime: '', priority: 'Medium', assignedTo: '', arrivalStatus: 'Not Arrived' });
  };

  const updateTask = async (taskId, field, value) => {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks', String(taskId)), { [field]: value });
  };

  const updateApprovalStatus = async (status) => {
    await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), { approvalStatus: status });
  };

 const handleToggleComplete = async (taskId) => {
  const task = tasks.find(t => t.id === taskId);
  if (!task || (task.completed && role !== 'Admin') || role === 'Approval') return;

  // Restrict task completion if job has a PR and approvals are not done
  if (job.purchaseFileUrl) {
    if (job.adminApprovalStatus !== 'Approved') {
      alert('⛔ Task cannot be marked as done. Waiting for Pre-Approval.');
      return;
    }
    if (job.finalApprovalStatus !== 'Approved') {
      alert('⛔ Task cannot be marked as done. Waiting for Final Approval.');
      return;
    }
  }

  // Proceed with completion toggle
  await updateTask(taskId, 'completed', !task.completed);
  const taskSnap = await getDocs(collection(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks'));
  const allDone = taskSnap.docs.map(doc => doc.data()).every(t => t.completed === true);
  await updateDoc(doc(db, 'vehicles', vehicleId, 'jobs', jobId), { status: allDone ? 'Completed' : 'In Progress' });
};


  const handleUploadImage = async (taskId, type, file) => {
    if (!file || role === 'Approval') return;

    try {
      setUploadingTaskId(`${taskId}-${type}`);
      setUploadProgress(0);

      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      });

      const path = `task-images/${jobId}/${taskId}_${type}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          alert('Upload failed');
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateTask(taskId, type, url);
          setUploadingTaskId(null);
          setUploadProgress(0);
        }
      );
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Image upload failed. See console for details.');
      setUploadingTaskId(null);
    }
  };

  const removeImage = async (taskId, type, imageUrl) => {
    if (role !== 'Admin') return;
    if (!window.confirm(`Are you sure you want to remove this ${type === 'beforeImage' ? 'Before' : type === 'afterImage' ? 'After' : 'Returned'} image?`)) return;
    await deleteObject(ref(storage, imageUrl));
    await updateTask(taskId, type, '');
  };

  const isEditable = role === 'Admin' || (role === 'User' && job?.status !== 'Completed');

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.arrivalStatus !== b.arrivalStatus) return a.arrivalStatus === 'Arrived' ? 1 : -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks]);

  if (!job) return <div style={{ padding: '20px' }}>Loading job...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => navigate(-1)}>⬅ Back</button>
      <h2>Job Detail</h2>

      <div style={{ marginBottom: '20px' }}>
        <strong>Requester:</strong> {job.requester} <br />
        <strong>Technician:</strong> {job.mechanic} <br />
        <strong>Status:</strong> {job.status} | <strong>Priority:</strong> {job.priority} <br />
      </div>

      {(role === 'Admin' || role === 'Approval') && (
        <div style={{ marginBottom: '20px' }}>
          <label>Update Approval Status: </label>
          <select value={job.approvalStatus || 'Waiting'} onChange={(e) => updateApprovalStatus(e.target.value)}>
            <option value="Waiting">Waiting</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      )}

      {isEditable && (
        <div>
          <h3>Add Task</h3>
          <div style={{ marginBottom: '20px' }}>
            <input placeholder="Task Name" value={taskForm.name} onChange={(e) => handleTaskFormChange('name', e.target.value)} />
            <input placeholder="Description" value={taskForm.description} onChange={(e) => handleTaskFormChange('description', e.target.value)} />
            <input type="date" value={taskForm.startDate} onChange={(e) => handleTaskFormChange('startDate', e.target.value)} />
            <input type="date" value={taskForm.endDate} onChange={(e) => handleTaskFormChange('endDate', e.target.value)} />
            <input placeholder="Estimated Time (hrs)" type="number" value={taskForm.estimatedTime} onChange={(e) => handleTaskFormChange('estimatedTime', e.target.value)} />
            <input placeholder="Actual Time (hrs)" type="number" value={taskForm.actualTime} onChange={(e) => handleTaskFormChange('actualTime', e.target.value)} />
            <select value={taskForm.priority} onChange={(e) => handleTaskFormChange('priority', e.target.value)}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
            <button onClick={handleAddTask}>Add Task</button>
          </div>
        </div>
      )}

      <h3>🛠 Tasks</h3>
      {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              role={role}
              isEditable={isEditable}
              updateTask={updateTask}
              handleToggleComplete={handleToggleComplete}
              handleUploadImage={handleUploadImage}
              removeImage={removeImage}
              uploadingTaskId={uploadingTaskId}
              uploadProgress={uploadProgress}
              handleDeleteTask={handleDeleteTask} // ✅ ensure this is passed down
            />

      ))}
      
    </div>
  );
}
