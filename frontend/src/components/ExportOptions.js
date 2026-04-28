import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './ExportOptions.css';

export default function ExportOptions({ vehicles = [], onClose }) {
  const [exportType, setExportType] = useState('vehicleInfo');
  const [selectedVehicle, setSelectedVehicle] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [useAllDates, setUseAllDates] = useState(true);

  const [vehicleFields, setVehicleFields] = useState({
    plate: true,
    type: true,
    vin: true,
    notes: true,
    Area: true,
    department: true,
    enduser: true,
    recipientEmail: true
  });

  const toggleField = (field) => {
    setVehicleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const selectAllFields = () => {
    const allTrue = {};
    Object.keys(vehicleFields).forEach(f => (allTrue[f] = true));
    setVehicleFields(allTrue);
  };

  const clearAllFields = () => {
    const allFalse = {};
    Object.keys(vehicleFields).forEach(f => (allFalse[f] = false));
    setVehicleFields(allFalse);
  };

  const formatDate = (input) => {
    try {
      const date =
        input?.toDate?.() instanceof Date ? input.toDate() :
        input instanceof Date ? input :
        typeof input === 'string' ? new Date(input) :
        null;
      return date && !isNaN(date) ? date.toISOString().split('T')[0] : '';
    } catch {
      return '';
    }
  };

  const handleExport = () => {
    console.log('✅ Export triggered');

    const filteredVehicles = selectedVehicle === 'ALL'
      ? vehicles
      : vehicles.filter(v => v.id === selectedVehicle);

    if (exportType === 'vehicleInfo') {
      const exportData = vehicles.map(vehicle => {
        const row = {};
        Object.entries(vehicleFields).forEach(([field, include]) => {
          if (include) {
            const value = vehicle[field];
            row[field.charAt(0).toUpperCase() + field.slice(1)] = Array.isArray(value)
              ? value.join(', ')
              : value || '';
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehicles');
      XLSX.writeFile(workbook, 'vehicles.xlsx');
      onClose();
      return;
    }

    if (exportType === 'vehicleJobs') {
      let allJobs = [];

      filteredVehicles.forEach(vehicle => {
        const jobs = Array.isArray(vehicle.jobs) ? vehicle.jobs : [];
        jobs.forEach(job => {
          allJobs.push({ ...job, vehiclePlate: vehicle.plate });
        });
      });

      if (!useAllDates && (startDate || endDate)) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        allJobs = allJobs.filter(job => {
          const raw = job.createdAt?.toDate?.() || job.createdAt || null;
          const created = new Date(raw);
          if (isNaN(created)) return false;
          const afterStart = start ? created >= start : true;
          const beforeEnd = end ? created <= end : true;
          return afterStart && beforeEnd;
        });
      }

      if (selectedMechanic) {
        allJobs = allJobs.filter(job => job.mechanic === selectedMechanic);
      }

      const exportJobs = allJobs.map(job => ({
        Vehicle: job.vehiclePlate || '',
        JobID: job.id || '',
        Description: job.description || '',
        Status: job.status || '',
        Mechanic: job.mechanic || '',
        Mileage: job.mileage || '',
        '🎯 Priority': job.priority || '',
        '👤 Requester': job.requester || '',
        '🕓 Created': formatDate(job.createdAt),
        'PR Number': job.purchaseRequestNumber || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportJobs);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');
      XLSX.writeFile(workbook, 'jobs_report.xlsx');
      onClose();
      return;
    }

    if (exportType === 'jobsNotValidated') {
  let invalidJobs = [];

  filteredVehicles.forEach(vehicle => {
    const jobs = Array.isArray(vehicle.jobs) ? vehicle.jobs : [];
    jobs.forEach(job => {
      const isNotApproved = job.finalApprovalStatus !== 'Approved';
      const isNotCompleted = job.status !== 'Completed';
      if (isNotApproved && isNotCompleted) {
        invalidJobs.push({ ...job, vehiclePlate: vehicle.plate });
      }
    });
  });

      const exportJobs = invalidJobs.map(job => ({
        Vehicle: job.vehiclePlate || '',
        JobID: job.id || '',
        Description: job.description || '',
        Status: job.status || '',
        FinalApproval: job.finalApprovalStatus || '',
        Requester: job.requester || '',
        Created: formatDate(job.createdAt)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportJobs);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs Not Validated');
      XLSX.writeFile(workbook, 'jobs_not_validated.xlsx');
      onClose();
      return;
    }

    if (exportType === 'jobsWithoutProforma') {
  let jobsWithoutProforma = [];

  filteredVehicles.forEach(vehicle => {
    const jobs = Array.isArray(vehicle.jobs) ? vehicle.jobs : [];
    jobs.forEach(job => {
      const hasNoProforma = !job.purchaseFile && !job.proformaFile;
      if (hasNoProforma) {
        jobsWithoutProforma.push({ ...job, vehiclePlate: vehicle.plate });
      }
    });
  });

  // Apply date filtering if not using all dates
  if (!useAllDates && (startDate || endDate)) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    jobsWithoutProforma = jobsWithoutProforma.filter(job => {
      const raw = job.createdAt?.toDate?.() || job.createdAt || null;
      const created = new Date(raw);
      if (isNaN(created)) return false;
      const afterStart = start ? created >= start : true;
      const beforeEnd = end ? created <= end : true;
      return afterStart && beforeEnd;
    });
  }

  const exportJobs = jobsWithoutProforma.map(job => ({
    Vehicle: job.vehiclePlate || '',
    JobID: job.id || '',
    Description: job.description || '',
    Status: job.status || '',
    Mechanic: job.mechanic || '',
    Mileage: job.mileage || '',
    Priority: job.priority || '',
    Requester: job.requester || '',
    Created: formatDate(job.createdAt),
    'PR Number': job.purchaseRequestNumber || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportJobs);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs Without Proforma');
  XLSX.writeFile(workbook, 'jobs_without_proforma.xlsx');
  onClose();
  return;
}





if (exportType === 'fuelReport') {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const fuelData = filteredVehicles.map(vehicle => {
    let fuelEntries = Array.isArray(vehicle.fuelEntries) ? vehicle.fuelEntries : [];

    // Match plate
    fuelEntries = fuelEntries.filter(entry => entry.plate === vehicle.plate);

    // Filter by date range using entry.date
    if (!useAllDates && (start || end)) {
      fuelEntries = fuelEntries.filter(entry => {
        const raw = entry.date?.toDate?.() || entry.date || null;
        const entryDate = new Date(raw);
        if (isNaN(entryDate)) return false;
        const afterStart = start ? entryDate >= start : true;
        const beforeEnd = end ? entryDate <= end : true;
        return afterStart && beforeEnd;
      });
    }

    const totalLiters = fuelEntries.reduce((sum, entry) => {
      const liters = parseFloat(entry.fuelInput);
      return sum + (isNaN(liters) ? 0 : liters);
    }, 0);

    const totalCost = fuelEntries.reduce((sum, entry) => {
      const cost = parseFloat(entry.totalCost);
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);

    const averageCost = totalLiters ? (totalCost / totalLiters).toFixed(2) : '0.00';

    return {
      Vehicle: vehicle.plate || '',
      'Total Liters': totalLiters.toFixed(2),
      'Total Cost': totalCost.toFixed(2),
      'Avg Cost/L': averageCost,
      'Fuel Entries': fuelEntries.length
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(fuelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fuel Report');
  XLSX.writeFile(workbook, 'fuel_report.xlsx');
  onClose();
  return;
}


  };

  const vehicleOptions = [
    { id: 'ALL', label: '📦 All Vehicles' },
    ...vehicles.map(v => ({
      id: v.id,
      label: `${v.plate} (${v.type})`
    }))
  ];

  const mechanicOptions = [
    ...new Set(vehicles.flatMap(v => v.jobs?.map(j => j.mechanic).filter(Boolean)))
  ];

  return (
    <div className="export-modal">
      <div className="export-box">
        <h2>📥 Export Options</h2>

        {/* Export Type Selection */}
        <div className="export-section">
          <label>
            <input
              type="radio"
              value="vehicleInfo"
              checked={exportType === 'vehicleInfo'}
              onChange={() => setExportType('vehicleInfo')}
            />
            Download vehicle Informations
          </label>

          <label>
            <input
              type="radio"
              value="vehicleJobs"
              checked={exportType === 'vehicleJobs'}
              onChange={() => setExportType('vehicleJobs')}
            />
            Download Jobs report
          </label>

          <label>
            <input
              type="radio"
              value="jobsNotValidated"
              checked={exportType === 'jobsNotValidated'}
              onChange={() => setExportType('jobsNotValidated')}
            />
            Jobs not validated
          </label>

          <label>
  <input
    type="radio"
    value="jobsWithoutProforma"
    checked={exportType === 'jobsWithoutProforma'}
    onChange={(e) => setExportType(e.target.value)}
  />
  Jobs Without Proforma
</label>


          <label>
            <input
              type="radio"
              value="fuelReport"
              checked={exportType === 'fuelReport'}
              onChange={() => setExportType('fuelReport')}
            />
            Fuel report
          </label>
        </div>

        {/* Vehicle Info Field Selector */}
        {exportType === 'vehicleInfo' && (
          <div className="nested-options">
            <label style={{ fontWeight: 'bold' }}>Select Fields to Export:</label>
            <div style={{ marginBottom: '8px' }}>
              <button onClick={selectAllFields} style={{ marginRight: '8px' }}>Select All</button>
              <button onClick={clearAllFields}>Clear All</button>
            </div>
            {Object.keys(vehicleFields).map((field) => (
              <label key={field} style={{ display: 'block', marginBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={vehicleFields[field]}
                  onChange={() => toggleField(field)}
                />
                {field.charAt(0).toUpperCase() + field.slice(1)}

                           </label>
            ))}
          </div>
        )}

        {/* Filters for Job Export */}

        
       {(exportType === 'vehicleJobs' || exportType === 'jobsNotValidated' || exportType === 'fuelReport') && (
  <div className="nested-options">
    {/* Vehicle selector... */}

    <label style={{ fontWeight: 'bold', marginTop: '12px' }}>
      <input
        type="checkbox"
        checked={useAllDates}
        onChange={() => setUseAllDates(!useAllDates)}
        style={{ marginRight: '6px' }}
      />
      Use all dates
    </label>

    {!useAllDates && (
      <>
        <label style={{ fontWeight: 'bold', marginTop: '12px' }}>Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="date-input"
        />

        <label style={{ fontWeight: 'bold', marginTop: '12px' }}>End Date:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="date-input"
        />
      </>
    )}

    {/* Mechanic filter only for vehicleJobs */}
    {exportType === 'vehicleJobs' && (
      <>
        <label style={{ fontWeight: 'bold', marginTop: '12px' }}>Choose Mechanic:</label>
        <select
          value={selectedMechanic}
          onChange={(e) => setSelectedMechanic(e.target.value)}
        >
          <option value="">All Mechanics</option>
          {mechanicOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </>
    )}
  </div>
)}

        {/* Action Buttons */}
        <div className="export-actions">
          <button onClick={onClose} className="cancel-btn">❌ Cancel</button>
          <button onClick={handleExport} className="export-btn">✅ Export</button>
        </div>
      </div>
    </div>
  );
}
