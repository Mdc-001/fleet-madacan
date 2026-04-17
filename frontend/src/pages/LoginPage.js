// src/pages/LoginPage.js
import './LoginPage.css';
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
// Import logo (adjust path if placed differently)
import logo from '../assets/logo.png';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User data not found.');
      }

      const userData = userSnap.data();
      const role = userData.role;

      if (role === 'Admin') navigate('/admin');
else if (role === 'User') navigate('/user');
else if (role === 'Approval') navigate('/approval');
else if (role === 'verificator') navigate('/verificator-dashboard');
else if (role === 'storeroom') navigate('/warehouse-dashboard');
else if (role === 'Scm') {
  navigate('/scm'); // ✅ your dedicated dashboard
} 
else throw new Error('Unknown role: ' + role);



    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="login-container">
      <img src={logo} alt="Madacan Logo" className="login-logo" />
      <h2>MADACAN FLEET</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        /><br />
        <button type="submit">Login</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default LoginPage;
