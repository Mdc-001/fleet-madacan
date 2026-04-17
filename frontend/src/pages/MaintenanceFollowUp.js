import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import AddMileagePanel from '../components/AddMileagePanel';
import FuelChart from '../components/FuelChart';

export default function MaintenanceFollowUp() {
  const [vehicles, setVehicles] = useState([]);
  const [mileageLogs, setMileageLogs] = useState([]);
  const [filter, setFilter] = useState({ search: '', department: '', area: '', due: '' });
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const vehicleSnap = await getDocs(collection(db, 'vehicles'));
      const vehicleData = vehicleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehicleData);

      const mileageSnap = await getDocs(collection(db, 'mileageTracking'));
      const mileageData = mileageSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          plate: d.plate,
          mileage: d.mileage,
          fuelInput: d.fuelInput || 0,
          dataSource: d.dataSource || '',
          lubricationDone: d.lubricationDone || false,
          lubricationMileage: d.lubricationMileage || null,
          lubricationDate: d.lubricationDate?.toDate?.().toLocaleDateString('en-GB') || null,
          date: d.date?.toDate?.().toLocaleDateString('en-GB') || null,
          nextDueRule: d.nextDueRule || '',   // ✅ include nextDueRule
        };
      });

      setMileageLogs(mileageData);
    };
    fetchData();
  }, []);

  const parse = (d) => {
    if (typeof d !== 'string' || !d.includes('/')) return new Date(0);
    const [day, month, year] = d.split('/');
    if (!day || !month || !year) return new Date(0);
    return new Date(`${year}-${month}-${day}`);
  };

  const sortByDate = (a, b) => {
    return parse(a.date) - parse(b.date);
  };

  const allDates = Array.from(new Set(
    mileageLogs.map(e => e.date).filter(Boolean)
  )).sort((a, b) => parse(b) - parse(a));

  const filterVehicles = vehicles.filter(v => {
    const s = filter.search.toLowerCase();
    const overdue = v.nextLubrificationDate && new Date(v.nextLubrificationDate.toDate()) < new Date();
    return (
      (!filter.department || v.departement === filter.department) &&
      (!filter.area || v.Area === filter.area || v.area === filter.area) &&
      (!filter.due || (filter.due === 'overdue' ? overdue : !overdue)) &&
      (v.plate?.toLowerCase().includes(s) || v.type?.toLowerCase().includes(s))
    );
  });

  return (
    <div style={{ padding: '20px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: '20px', backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        ⬅ Back
      </button>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>🛢 Mileage & Lubrification Tracking</h2>

      <AddMileagePanel onSave={() => window.location.reload()} vehicles={vehicles} />

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          placeholder="Search by plate or model"
          value={filter.search}
          onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ padding: '6px' }}
        />
        <select onChange={(e) => setFilter(f => ({ ...f, department: e.target.value }))}>
          <option value=''>All Departments</option>
          {[...new Set(vehicles.map(v => v.departement))].map(dep => (
            <option key={dep}>{dep}</option>
          ))}
        </select>
        <select onChange={(e) => setFilter(f => ({ ...f, area: e.target.value }))}>
          <option value=''>All Areas</option>
          {[...new Set(vehicles.map(v => v.Area || v.area))].map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select onChange={(e) => setFilter(f => ({ ...f, due: e.target.value }))}>
          <option value=''>All Status</option>
          <option value='overdue'>Overdue</option>
          <option value='notdue'>Not Due</option>
        </select>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '500px' }}>
        <table border="1" cellPadding="8" cellSpacing="0" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0, zIndex: 2 }}>
              <th>Plate</th>
              <th>Model</th>
              <th>Department</th>
              <th>Area/Enduser</th>
              <th>Current Mileage</th>
              <th>Last oil change</th>
              <th>Next Due</th>
              <th>Status</th>
              {allDates.map(date => (
                <th key={date}>{date}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filterVehicles.map(v => {
              const clean = plate => plate?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
              const lastDoneEntry = mileageLogs.find(e => clean(e.plate) === clean(v.plate) && e.lubricationDone);
              const mileageHistory = allDates.map(date => {
                const mileageLog = mileageLogs.find(e => e.plate === v.plate && e.date === date);
                return {
                  date,
                  mileage: mileageLog?.mileage || null,
                  fuel: mileageLog?.fuelInput || null,
                  dataSource: mileageLog?.dataSource || null
                };
              });

              const currentMileage = mileageHistory.find(m => m.mileage !== null)?.mileage;

              let nextDue = null;
              let statusLabel = 'N/A';
              let statusColor = 'black';

              if (lastDoneEntry?.lubricationMileage != null && lastDoneEntry?.nextDueRule?.trim()) {
                const rule = lastDoneEntry.nextDueRule.trim();

                if (!isNaN(Number(rule))) {
                  // Mileage-based rule
                  nextDue = parseFloat(lastDoneEntry.lubricationMileage) + parseFloat(rule);

                  if (currentMileage != null) {
                    const diff = nextDue - currentMileage;
                    if (currentMileage > nextDue) {
                      statusLabel = 'Overdue';
                      statusColor = 'red';
                    } else if (diff <= 300) {
                      statusLabel = 'Almost due';
                      statusColor = 'orange';
                    } else {
                      statusLabel = 'OK';
                      statusColor = 'green';
                    }
                  }
                } else if (/month/i.test(rule)) {
                  // Date-based rule
                  const months = parseInt(rule);
                  const lastDate = lastDoneEntry.lubricationDate
                    ? parse(lastDoneEntry.lubricationDate)
                    : null;

                  if (lastDate && !isNaN(months)) {
                    const dueDate = new Date(lastDate);
                    dueDate.setMonth(dueDate.getMonth() + months);
                    nextDue = dueDate.toLocaleDateString('en-GB');

                    const today = new Date();
                    if (today > dueDate) {
                      statusLabel = 'Overdue';
                      statusColor = 'red';
                    } else {
                      statusLabel = 'OK';
                      statusColor = 'green';
                    }
                  }
                }
              }

              const lastDone = lastDoneEntry?.lubricationDate || 'N/A';

                           return (
                <tr key={v.id} onClick={() => setSelectedVehicle(v)} style={{ cursor: 'pointer' }}>
                  <td>{v.plate}</td>
                  <td>{v.type}</td>
                  <td>{v.departement || 'N/A'}</td>
                  <td>{v.Area || v.area || 'N/A'}</td>
                  <td>{currentMileage || 'N/A'}</td>
                  <td>
                    {lastDoneEntry ? (
                      <>
                        {lastDoneEntry.lubricationDate || 'N/A'}
                        {lastDoneEntry.lubricationMileage != null && (
                          <div style={{ fontSize: '0.85em', color: '#555' }}>
                            {lastDoneEntry.lubricationMileage} km
                          </div>
                        )}
                      </>
                    ) : 'N/A'}
                  </td>
                  <td>
                    {nextDue
                      ? (typeof nextDue === 'number'
                          ? `${nextDue} km`
                          : nextDue)
                      : 'N/A'}
                  </td>
                  <td style={{ color: statusColor, fontWeight: 'bold' }}>{statusLabel}</td>

                  {mileageHistory.map((entry, idx) => {
                    const prevMileage = mileageHistory[idx + 1]?.mileage;
                    const isViolation = entry.mileage != null && prevMileage != null && entry.mileage < prevMileage;
                    let efficiencyText = '';
                    if (
                      entry.mileage != null &&
                      entry.fuel &&
                      mileageHistory[idx + 1]?.mileage != null &&
                      entry.mileage > mileageHistory[idx + 1].mileage
                    ) {
                      const distance = entry.mileage - mileageHistory[idx + 1].mileage;
                      const efficiency = (entry.fuel / distance) * 100;
                      efficiencyText = `${efficiency.toFixed(2)} L/100km`;
                    }

                    return (
                      <td
                        key={entry.date}
                        style={{
                          backgroundColor: isViolation ? '#ffebee' : undefined,
                          color: isViolation ? 'red' : undefined,
                          fontWeight: isViolation ? 'bold' : undefined
                        }}
                      >
                        {entry.mileage || entry.fuel ? (
                          <>
                            {entry.mileage && <div>{entry.mileage}</div>}
                            {entry.fuel !== null && entry.fuel !== 0 && (
                              <div><strong>/</strong> {entry.fuel} L</div>
                            )}
                            {entry.dataSource === 'GPS' && (
                              <div style={{ fontSize: '0.85em', color: '#007bff' }}>📡 GPS</div>
                            )}
                            {efficiencyText && (
                              <div style={{ fontSize: '0.8em' }}>{efficiencyText}</div>
                            )}
                          </>
                        ) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedVehicle && (
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={() => setSelectedVehicle(null)}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            ✖ Close Chart
          </button>

          <FuelChart
            plate={selectedVehicle.plate}
            logs={mileageLogs
              .filter(e => e.plate === selectedVehicle.plate)
              .sort(sortByDate)}
          />
        </div>
      )}
    </div>
  );
}
