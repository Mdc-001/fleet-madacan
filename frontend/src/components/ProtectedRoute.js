import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const snap = await getDoc(doc(db, "users", currentUser.uid));
          // Normalize role to lowercase
          const firestoreRole = snap.data()?.role?.toLowerCase();
          setRole(firestoreRole || null);
        } catch (err) {
          console.error("Error fetching user role:", err);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!normalizedAllowedRoles.includes(role)) {
    return <div>Access denied</div>;
  }

  // Pass role down to children
  return React.cloneElement(children, { role });
};

export default ProtectedRoute;
