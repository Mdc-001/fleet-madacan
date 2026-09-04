import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const token = await currentUser.getIdTokenResult(true);
          const claimRole = token.claims.role?.toLowerCase();
          setRole(claimRole || null);
        } catch (err) {
          console.error("Error fetching user claims:", err);
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

  return React.cloneElement(children, { role });
};

export default ProtectedRoute;
