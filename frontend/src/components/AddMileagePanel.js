import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'firebase/firestore';

export default function AddMileagePanel({ onSave }) {
  const [form, setForm] = useState({
    plate: '',
    mileage: '',
    date: '',
    fuelInput: '',
    dataSource: '',
    lubricationDate: '',
    lubricationDone: false,
    lubricationMileage: '',
    nextDueRule: '',
  });

  const [vehiclePlates, setVehiclePlates] = useState([]);

  useEffect(() => {
    const fetchPlates = async () => {
      const snap = await getDocs(collection(db, 'vehicles'));
      const plates = snap.docs.map(doc => doc.data().plate).filter(Boolean);
      setVehiclePlates(plates);
    };
    fetchPlates();
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const closeOpenJobsForVehicle = async (plate, refuelDate) => {
    const vehicleSnap = await getDocs(query(collection(db, 'vehicles'), where('plate', '==', plate)));
    const vehicleDoc = vehicleSnap.docs[0];
    if (!vehicleDoc) return;

    const vehicleId = vehicleDoc.id;
    const jobsSnap = await getDocs(collection(db, `vehicles/${vehicleId}/jobs`));

    const openJobs = jobsSnap.docs.filter(doc => {
      const job = doc.data();
      return !job.completed && !job.closedDate;
    });

    for (const jobDoc of openJobs) {
      await updateDoc(doc(db, `vehicles/${vehicleId}/jobs/${jobDoc.id}`), {
        closedDate: Timestamp.fromDate(new Date(refuelDate)),
        completed: true
      });
    }
  };

  const handleSave = async () => {
    const isMainSet = form.mileage && form.date;
    const isLubeSet = form.lubricationDate && form.lubricationMileage;

    if (!form.plate) return alert('Plate number is required.');
    if (isMainSet && !form.dataSource) return alert('Please select the data source (GPS or Station).');
    if (!isMainSet && !isLubeSet) return alert('Please enter either mileage + date OR lubrication date + mileage.');
    if (form.lubricationDone && !form.nextDueRule.trim()) return alert('Please enter Next Due if Lubrication is marked as done.');

    try {
      await addDoc(collection(db, 'mileageTracking'), {
        plate: form.plate.trim(),
        mileage: form.mileage ? parseFloat(form.mileage) : null,
        date: form.date ? Timestamp.fromDate(new Date(form.date)) : null,
        fuelInput: form.fuelInput ? parseFloat(form.fuelInput) : 0,
        dataSource: form.dataSource || '',
        lubricationDate: form.lubricationDate ? Timestamp.fromDate(new Date(form.lubricationDate)) : null,
        lubricationDone: form.lubricationDone || false,
        lubricationMileage: form.lubricationMileage ? parseFloat(form.lubricationMileage) : null,
        nextDueRule: form.nextDueRule || '',
        timestamp: Timestamp.now(),
      });

      // ✅ New Feature: Close open jobs on refuelling
      if (form.date) {
        await closeOpenJobsForVehicle(form.plate.trim(), form.date);
      }

      alert('✅ Entry saved');
      setForm({
        plate: '',
        mileage: '',
        date: '',
        fuelInput: '',
        dataSource: '',
        lubricationDate: '',
        lubricationDone: false,
        lubricationMileage: '',
        nextDueRule: '',
      });
      onSave?.();
    } catch (err) {
      console.error('❌ Error saving mileage:', err);
      alert('Failed to save');
    }
  };

  return (
    <div style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
      <h4 style={{ marginBottom: '12px' }}>➕ Add Mileage & Lubrication</h4>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        {/* Mileage Section */}
        <div style={{
          flex: '1',
          border: '1px solid #ccc',
          padding: '10px',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <h5 style={{ marginBottom: '8px' }}>📋 <strong>Mileage Information</strong></h5>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <input list="plate-options" placeholder="Plate number" value={form.plate} onChange={(e) => handleChange('plate', e.target.value)} />
            <datalist id="plate-options">
              {vehiclePlates.map(plate => <option key={plate} value={plate} />)}
            </datalist>

            <input placeholder="Current mileage" type="number" value={form.mileage} onChange={(e) => handleChange('mileage', e.target.value)} />
            <input type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} />
            <input placeholder="Fuel input (L)" type="number" value={form.fuelInput} onChange={(e) => handleChange('fuelInput', e.target.value)} />
            <select value={form.dataSource} onChange={(e) => handleChange('dataSource', e.target.value)}>
              <option value="" disabled>Select data source</option>
              <option value="GPS">GPS</option>
              <option value="Manual">Station</option>
            </select>
          </div>
        </div>

        {/* Lubrication Section */}
        <div style={{
          flex: '1',
          border: '1px solid #e0b000',
          background: '#fffce8',
          padding: '10px',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <h5 style={{ marginBottom: '8px' }}>🛢 <strong>Lubrication Info</strong></h5>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <input type="date" value={form.lubricationDate} onChange={(e) => handleChange('lubricationDate', e.target.value)} />
            <input placeholder="Mileage at last lubrication" type="number" value={form.lubricationMileage} onChange={(e) => handleChange('lubricationMileage', e.target.value)} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" checked={form.lubricationDone} onChange={(e) => handleChange('lubricationDone', e.target.checked)} />
              Lubrication Done
            </label>

            <input
                list="next-due-options"
                placeholder="Next Due (e.g., 5000, 1 Month)"
                value={form.nextDueRule}
                onChange={(e) => handleChange('nextDueRule', e.target.value)}
              />
              <datalist id="next-due-options">
                <option value="2500" />   {/* ✅ New option */}
                <option value="5000" />
                <option value="1 Month" />
                <option value="2 Months" />
                <option value="3 Months" />
              </datalist>

          </div>
        </div>

        {/* Save Button */}
        <div style={{ alignSelf: 'center' }}>
          <button
            onClick={handleSave}
            style={{ backgroundColor: '#555', color: 'white', padding: '6px 12px', height: '36px' }}
          >
            💾 Save
          </button>
        </div>
      </div>
    </div>
  );
}
