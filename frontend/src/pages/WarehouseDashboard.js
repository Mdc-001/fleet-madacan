import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import Header from '../components/Header';

export default function WarehouseDashboard() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [allVehicles, setAllVehicles] = useState([]);
  const [deliveryNames, setDeliveryNames] = useState({});
  const [userRole, setUserRole] = useState('');

  // Fetch user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        setUserRole(tokenResult.claims.role || '');
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all vehicle plates
  useEffect(() => {
    const fetchVehicles = async () => {
      const vehicleSnap = await getDocs(collection(db, 'vehicles'));
      const vehicles = vehicleSnap.docs.map(doc => {
        const data = doc.data();
        return data.plate || 'Unknown';
      });
      setAllVehicles(vehicles);
    };
    fetchVehicles();
  }, []);

  // Fetch completed tasks with images
  useEffect(() => {
    const fetchWarehouseTasks = async () => {
      const vehicleSnap = await getDocs(collection(db, 'vehicles'));
      const result = [];

      for (const vehicleDoc of vehicleSnap.docs) {
        const vehicleId = vehicleDoc.id;
        const vehicleData = vehicleDoc.data();
        const plate = vehicleData.plate || 'Unknown';

        const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleId, 'jobs'));

        for (const jobDoc of jobsSnap.docs) {
          const jobId = jobDoc.id;
          const jobData = jobDoc.data();
          const createdAt = jobData.createdAt?.toDate?.().toLocaleDateString('en-GB') || 'N/A';

          const tasksSnap = await getDocs(collection(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks'));
          for (const taskDoc of tasksSnap.docs) {
            const task = taskDoc.data();
            if (task.completed && task.beforeImage) {
              result.push({
                id: taskDoc.id,
                vehicleId,
                jobId,
                taskRef: doc(db, 'vehicles', vehicleId, 'jobs', jobId, 'tasks', taskDoc.id),
                vehiclePlate: plate,
                jobDate: createdAt,
                name: task.name,
                assignedTo: task.assignedTo || '—',
                beforeImage: task.beforeImage,
                returnedImage: task.returnedPartImage || null,
                arrivalStatus: task.arrivalStatus || 'Waiting for delivery',
                returnedPart: task.returnedPart || null
              });
            }
          }
        }
      }

      setTasks(result);
    };

    fetchWarehouseTasks();
  }, []);

  // Filter tasks by plate + month
  useEffect(() => {
    const filtered = tasks.filter(task => {
      const matchesPlate = searchText
        ? task.vehiclePlate.toLowerCase().includes(searchText.toLowerCase())
        : true;

      const matchesDate = dateFilter
        ? (() => {
            const [day, month, year] = task.jobDate.split('/');
            const taskMonth = `${year}-${month}`;
            return taskMonth === dateFilter;
          })()
        : true;

      return matchesPlate && matchesDate;
    });

    setFilteredTasks(filtered);
  }, [tasks, searchText, dateFilter]);

  const handleStatusChange = async (task, newStatus) => {
    const deliveredBy = deliveryNames[task.id] || '';

    if (userRole !== 'storeroom') return;

    if (newStatus === 'Delivered' && !deliveredBy) {
      alert('Please enter the name of the person who delivered the part.');
      return;
    }

    try {
      await updateDoc(task.taskRef, {
        arrivalStatus: newStatus,
        returnedPart: {
          status: newStatus,
          updatedAt: new Date(),
          updatedBy: auth.currentUser?.email || 'unknown',
          deliveredBy: deliveredBy
        }
      });

      setTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? {
                ...t,
                arrivalStatus: newStatus,
                returnedPart: {
                  status: newStatus,
                  updatedAt: new Date(),
                  updatedBy: auth.currentUser?.email || 'unknown',
                  deliveredBy: deliveredBy
                }
              }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to update arrival status:', err);
    }
  };

  return (
    <div>
      <Header />
      <div style={{ padding: '20px' }}>
        <h2>Warehouse Dashboard</h2>
        <p>Completed tasks with returned parts</p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <input
            list="vehicle-options"
            placeholder="Search or select vehicle"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <datalist id="vehicle-options">
            {allVehicles.map((plate, idx) => (
              <option key={idx} value={plate} />
            ))}
          </datalist>

          <input
            type="month"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        {filteredTasks.length === 0 ? (
          <p>No returned parts found.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {filteredTasks.map((task, idx) => (
              <div
                key={idx}
                style={{
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '16px',
                  width: '300px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                <div><strong>🚗 Vehicle:</strong> {task.vehiclePlate}</div>
                <div><strong>📅 Job Date:</strong> {task.jobDate}</div>
                <div><strong>🛠 Task:</strong> {task.name}</div>
                <div><strong>👨‍🔧 Technician:</strong> {task.assignedTo}</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Before</div>
                    <a href={task.beforeImage} target="_blank" rel="noopener noreferrer">
                      <img
                        src={task.beforeImage}
                        alt="Before"
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px' }}
                      />
                    </a>
                  </div>
                  {task.returnedImage && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Returned</div>
                      <a href={task.returnedImage} target="_blank" rel="noopener noreferrer">
                        <img
                          src={task.returnedImage}
                          alt="Returned"
                          style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '10px' }}>
                  <strong>📦 Delivery Status:</strong>{' '}
                  <select
                    value={task.arrivalStatus}
                    onChange={(e) => handleStatusChange(task, e.target.value)}
                    disabled={task.arrivalStatus === 'Delivered' || userRole !== 'storeroom'}
                    style={{
                      marginTop: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      backgroundColor: userRole !== 'storeroom' ? '#f8f8f8' : '#f0f0f0',
                      color: task.arrivalStatus === 'Delivered' ? 'green' : 'black',
                      fontWeight: task.arrivalStatus === 'Delivered' ? 'bold' : 'normal',
                      cursor: userRole !== 'storeroom' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {task.arrivalStatus === 'Delivered' ? (
                      <option value="Delivered">Delivered</option>
                    ) : (
                      <>
                        <option value="Waiting for delivery">Waiting for delivery</option>
                        <option value="Delivered">Delivered</option>
                      </>
                    )}
                  </select>

                  {task.arrivalStatus !== 'Delivered' && userRole === 'storeroom' && (
                    <div style={{ marginTop: '8px' }}>
                      <label>
                        <span style={{ fontSize: '0.85rem' }}>👤 Name of person delivering:</span>
                        <input
                          type="text"
                          value={deliveryNames[task.id] || ''}
                          onChange={(e) =>
                            setDeliveryNames(prev => ({ ...prev, [task.id]: e.target.value }))
                          }
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            marginTop: '4px',
                            fontSize: '0.85rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc'
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {task.arrivalStatus === 'Delivered' && task.returnedPart && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#555' }}>
                      <div>✅ Marked delivered by: <strong>{task.returnedPart.updatedBy}</strong></div>
                      <div>📆 On: {new Date(task.returnedPart.updatedAt).toLocaleString()}</div>
                      <div>👤 Delivered by: <strong>{task.returnedPart.deliveredBy}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
