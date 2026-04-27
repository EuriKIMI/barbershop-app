import { useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Login from "./components/Login";
import CustomerDashboard from "./components/CustomerDashboard";
import OwnerDashboard from "./components/OwnerDashboard";
import { auth, db } from "./firebase";
import "./App.css";

function FullScreenMessage({ title, message }) {
  return (
    <div className="screen-shell">
      <div className="panel status-panel">
        <p className="eyebrow">BarberShop</p>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ allowedRole, loading, user, profile, children }) {
  if (loading) {
    return <FullScreenMessage title="Loading your shop" message="Checking your account details..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!profile) {
    return (
      <FullScreenMessage
        title="Profile not ready"
        message="We could not find your profile yet. Sign out and sign in again to finish setup."
      />
    );
  }

  if (profile.role !== allowedRole) {
    return <Navigate to={profile.role === "owner" ? "/owner" : "/customer"} replace />;
  }

  return children;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", nextUser.uid);
        const userSnap = await getDoc(userRef);
        setProfile(userSnap.exists() ? userSnap.data() : null);
      } catch (error) {
        console.error("Failed to load user profile", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <FullScreenMessage title="Opening BarberShop" message="Connecting to your account..." />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            user && profile ? (
              <Navigate to={profile.role === "owner" ? "/owner" : "/customer"} replace />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRole="customer" loading={loading} user={user} profile={profile}>
              <CustomerDashboard user={user} profile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner"
          element={
            <ProtectedRoute allowedRole="owner" loading={loading} user={user} profile={profile}>
              <OwnerDashboard user={user} profile={profile} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
