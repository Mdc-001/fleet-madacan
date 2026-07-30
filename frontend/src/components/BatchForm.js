import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';

export default function BatchForm({ onSave }) {
  const [billingBatchId, setBillingBatchId] = useState('');
  const [services, setServices] = useState([{ plate: '', repairDate: '', serviceProvider: '' }]);
  const [vehiclePlates, setVehiclePlates] = useState([]);

  useEffect(() => {
    const fetchPlates = async () => {
      const snap = await getDocs(collection(db, 'vehicles'));
      const plates = snap.docs.map(doc => doc.data().plate).filter(Boolean);
      setVehiclePlates(plates);
    };
    fetchPlates();
  }, []);

  const handleServiceChange = (index, field, value) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };

  const addService = () => {
    setServices([...services, { plate: '', repairDate: '', serviceProvider: '' }]);
  };

  const handleSaveBatch = async () => {
    if (!billingBatchId.trim()) return alert('Billing Batch ID is required.');
    try {
      for (const service of services) {
        if (!service.plate.trim() || !service.repairDate) {
          alert('Each service must have Plate and Repair Date.');
          return;
        }
        await addDoc(collection(db, 'tireServiceTracking'), {
          plate: service.plate.trim(),
          repairDate: Timestamp.fromDate(new Date(service.repairDate)),
          serviceProvider: service.serviceProvider,
          status: 'pending',
          billingBatchId,
          scmApproval: 'pending',
          closedDate: null,
          timestamp: Timestamp.now(),
        });
      }
      alert('✅ Batch saved successfully');
      setBillingBatchId('');
      setServices([{ plate: '', repairDate: '', serviceProvider: '' }]);
      onSave?.();
    } catch (err) {
      console.error('❌ Error saving batch:', err);
      alert('Failed to save batch');
    }
  };

  return (
    <div style={{ backgroundColor: '#fffbe8', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
      <h4>📦 Batch Tire Service Requests</h4>
      <input
        placeholder="Billing Batch ID"
        value={billingBatchId}
        onChange={(e) => setBillingBatchId(e.target.value)}
        style={{ marginBottom: '12px' }}
      />

      {services.map((service, index) => (
        <div key={index} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '8px' }}>
          <input
            list="plate-options"
            placeholder="Plate number"
            value={service.plate}
            onChange={(e) => handleServiceChange(index, 'plate', e.target.value)}
          />
          <datalist id="plate-options">
            {vehiclePlates.map(plate => <option key={plate} value={plate} />)}
          </datalist>

          <input
            type="date"
            value={service.repairDate}
            onChange={(e) => handleServiceChange(index, 'repairDate', e.target.value)}
          />
          <input
            placeholder="Service Provider"
            value={service.serviceProvider}
            onChange={(e) => handleServiceChange(index, 'serviceProvider', e.target.value)}
          />
        </div>
      ))}

      <button onClick={addService} style={{ backgroundColor: '#2196f3', color: 'white', padding: '6px 12px' }}>
        ➕ Add Another Service
      </button>

      <button onClick={handleSaveBatch} style={{ backgroundColor: '#4caf50', color: 'white', padding: '6px 12px', marginLeft: '8px' }}>
        💾 Save Batch
      </button>
    </div>
  );
}
