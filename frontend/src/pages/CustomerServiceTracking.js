import React, { useState } from 'react';
import TireServiceCard from '../components/TireServiceCard';
import AssuranceServiceCard from '../components/AssuranceServiceCard';


export default function CustomerServiceTracking({ role }) {
  const [serviceType, setServiceType] = useState('tire'); // tire, assurance, etc.

  const pageStyle = {
    backgroundColor: '#f5f7fa',
    minHeight: '100vh',
    padding: '40px',
    fontFamily: 'Segoe UI, sans-serif',
  };

  const headerStyle = {
    backgroundColor: '#0077cc',
    color: 'white',
    padding: '20px 30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    marginBottom: '30px',
  };

  const toggleButton = (activeColor, isActive) => ({
    borderRadius: '20px',
    padding: '10px 18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginRight: '12px',
    border: 'none',
    backgroundColor: isActive ? activeColor : '#e0e0e0',
    color: isActive ? 'white' : '#333',
    transition: 'background-color 0.2s ease',
  });

  return (
    <div style={pageStyle}>
      {/* Page header */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '28px' }}>👥 Customer Service Tracking</h2>
        <p style={{ margin: '8px 0 0', fontSize: '16px' }}>
          Select a service type to manage requests.
        </p>
      </div>

      {/* Service type toggle */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setServiceType('tire')}
          style={toggleButton('#0077cc', serviceType === 'tire')}
        >
          🛞 Tire Service
        </button>
        <button
          onClick={() => setServiceType('assurance')}
          style={toggleButton('#ff9800', serviceType === 'assurance')}
        >
          📑 Assurance Service
        </button>
        {/* Add more service types later */}
      </div>

      {/* Render the selected service card */}
      {serviceType === 'tire' && <TireServiceCard role={role} />}
      {serviceType === 'assurance' && <AssuranceServiceCard role={role} />}
    </div>
  );
}
