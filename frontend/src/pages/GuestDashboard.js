// src/pages/GuestDashboard.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function GuestDashboard() {
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customerServiceTracking'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(list);
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <Header />
      <h2>Guest Dashboard – Customer Service Tracking</h2>
      <p>You can view and create service requests here.</p>

      {/* 🚀 Navigation buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/maintenance-follow-up')}
          style={{
            backgroundColor: '#757575',
            color: 'white',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          🛢 Mileage & Lubrification Tracking
        </button>

        <button
          onClick={() => navigate('/customer-service')}
          style={{
            backgroundColor: '#0077cc',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          🛞 Customer Service Tracking
        </button>
      </div>

      {/* 📋 List of requests */}
      <ul>
        {requests.map(req => (
          <li key={req.id}>
            <strong>{req.title || 'Untitled Request'}</strong> – {req.status || 'No status'}
          </li>
        ))}
      </ul>
    </div>
  );
}
