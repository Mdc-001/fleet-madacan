import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleDownloadReport } from './handleDownloadReport';

export const generateReport = async (vehicleId, job) => {
  try {
    console.log('🔍 VEHICLE ID:', vehicleId);

    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);

    if (!vehicleSnap.exists()) {
      console.error('❌ Vehicle not found in Firestore.');
      return;
    }

    const vehicle = vehicleSnap.data();
    console.log('✅ Vehicle loaded:', vehicle);

    await handleDownloadReport(job, vehicle);
  } catch (error) {
    console.error('Error generating report:', error);
  }
};


