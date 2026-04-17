// src/pages/SyncJobs.js
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function SyncJobs() {
  const [status, setStatus] = useState('Waiting...');
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    const sync = async () => {
      setStatus('Checking role...');
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) return setStatus('Not logged in');

        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.data()?.role !== 'Admin') return setStatus('Access denied');

        setStatus('Loading vehicles...');
        const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
        let totalSynced = 0;

        for (const vehicleDoc of vehiclesSnap.docs) {
          const vehicleId = vehicleDoc.id;
          const jobsSnap = await getDocs(collection(db, 'vehicles', vehicleId, 'jobs'));

          for (const jobDoc of jobsSnap.docs) {
            const job = jobDoc.data();

            // Check if it already exists in flat /jobs
            const existsQuery = await getDocs(collection(db, 'jobs'));
            const alreadyExists = existsQuery.docs.some(d => d.id === jobDoc.id);
            if (alreadyExists) continue;

            await addDoc(collection(db, 'jobs'), {
              ...job,
              vehicleId,
              vehicleJobId: jobDoc.id
            });
            totalSynced++;
          }
        }

        setSynced(totalSynced);
        setStatus(`✅ Done: Synced ${totalSynced} jobs.`);
      });

      return () => unsub();
    };

    sync();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>🔄 Sync Jobs to Flat Collection</h2>
      <p>Status: {status}</p>
      <p>Total Synced: {synced}</p>
    </div>
  );
}
