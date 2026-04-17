// src/pages/HomePage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function HomePage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate('/login');

      const snap = await db.collection('users').doc(user.uid).get();
      setRole(snap.data()?.role || null);
    });
    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vehicles'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(data);
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🚗 Vehicle List</h2>
      {vehicles.length === 0 ? (
        <p>No vehicles available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {vehicles.map(vehicle => (
            <div
              key={vehicle.id}
              onClick={() => navigate(`/vehicle/${vehicle.id}`)}
              style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '12px', cursor: 'pointer', background: '#f9f9f9' }}
            >
              <strong>{vehicle.plate}</strong><br />
              {vehicle.model || 'Unknown Model'}<br />
              {vehicle.year && <span>Year: {vehicle.year}</span>}<br />
              <span style={{ color: '#666', fontSize: '0.85em' }}>Click to view job cards</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
