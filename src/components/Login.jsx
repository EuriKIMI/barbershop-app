import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, signOut } from "firebase/auth";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, provider } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState("");
  const [error, setError] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [setupRole, setSetupRole] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopId, setShopId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resetSetup = () => {
    setPendingUser(null);
    setSetupRole("");
    setShopName("");
    setShopId("");
  };

  const startGoogleSignIn = async (selectedRole) => {
    setLoadingRole(selectedRole);
    setError("");
    setSuccessMessage("");

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const existingRole = userSnap.data().role;
        navigate(existingRole === "owner" ? "/owner" : "/customer");
        return;
      }

      setPendingUser(user);
      setSetupRole(selectedRole);
    } catch (authError) {
      console.error("Login failed", authError);
      setError("Google sign-in did not finish. Check your Firebase auth settings and try again.");
    } finally {
      setLoadingRole("");
    }
  };

  const finishOwnerSetup = async (event) => {
    event.preventDefault();

    if (!pendingUser) {
      setError("Please sign in with Google first.");
      return;
    }

    const trimmedShopName = shopName.trim();
    if (!trimmedShopName) {
      setError("Enter your barbershop name before continuing.");
      return;
    }

    try {
      setError("");
      const shopRef = await addDoc(collection(db, "barbershops"), {
        name: trimmedShopName,
        ownerId: pendingUser.uid,
        createdAt: Date.now(),
        services: [],
        currentServing: null,
      });

      await setDoc(doc(db, "users", pendingUser.uid), {
        name: pendingUser.displayName,
        email: pendingUser.email,
        role: "owner",
        shopId: shopRef.id,
      });

      setSuccessMessage(`Shop created. Your shop ID is ${shopRef.id}.`);
      navigate("/owner");
    } catch (setupError) {
      console.error("Owner setup failed", setupError);
      setError("We could not create your shop just yet. Please try again.");
    }
  };

  const finishCustomerSetup = async (event) => {
    event.preventDefault();

    if (!pendingUser) {
      setError("Please sign in with Google first.");
      return;
    }

    const trimmedShopId = shopId.trim();
    if (!trimmedShopId) {
      setError("Enter a valid shop ID before continuing.");
      return;
    }

    try {
      setError("");
      const shopRef = doc(db, "barbershops", trimmedShopId);
      const shopSnap = await getDoc(shopRef);

      if (!shopSnap.exists()) {
        setError("That shop ID does not exist yet. Ask the owner for a valid shop ID and try again.");
        return;
      }

      await setDoc(doc(db, "users", pendingUser.uid), {
        name: pendingUser.displayName,
        email: pendingUser.email,
        role: "customer",
        shopId: trimmedShopId,
      });

      navigate("/customer");
    } catch (setupError) {
      console.error("Customer setup failed", setupError);
      setError("We could not connect you to that shop. Please try again.");
    }
  };

  const cancelSetup = async () => {
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error("Setup sign-out failed", signOutError);
    } finally {
      resetSetup();
      setError("");
    }
  };

  const isOwnerSetup = setupRole === "owner" && pendingUser;
  const isCustomerSetup = setupRole === "customer" && pendingUser;

  return (
    <div className="screen-shell">
      <div className="hero-layout">
        <section className="panel hero-panel hero-copy">
          <p className="eyebrow">BarberShop Queue</p>
          <h1 className="display-title">A smoother queue for walk-ins, trims, and busy weekends.</h1>
          <p className="hero-text muted">
            Keep the shop moving with a simple live line. Owners manage the queue in real time, and customers can
            check their place without hovering around the chair.
          </p>

          <div className="feature-strip">
            <div className="feature-card">
              <span className="feature-number">01</span>
              <strong>Create a shop</strong>
              <p className="muted">Owners sign in once, set up their shop, and share a shop ID.</p>
            </div>
            <div className="feature-card">
              <span className="feature-number">02</span>
              <strong>Join the line</strong>
              <p className="muted">Customers enter the shop ID, pick a cut, and hop into the queue.</p>
            </div>
            <div className="feature-card">
              <span className="feature-number">03</span>
              <strong>Track it live</strong>
              <p className="muted">Everyone sees updates, active cuts, and finish estimates instantly.</p>
            </div>
          </div>
        </section>

        <section className="panel auth-panel">
          {!pendingUser ? (
            <>
              <p className="eyebrow">Choose Your Role</p>
              <h2 className="section-title">Sign in and start using the app.</h2>
              <p className="muted">Pick how you are using BarberShop today. You will sign in with Google on the next step.</p>

              <div className="role-grid">
                <button
                  type="button"
                  className="role-card role-card-owner"
                  onClick={() => startGoogleSignIn("owner")}
                  disabled={Boolean(loadingRole)}
                >
                  <span className="role-kicker">For barbershop owners</span>
                  <strong>Manage your live queue</strong>
                  <p>Set up your shop, share the shop ID, and mark customers as done from any device.</p>
                  <span className="role-cta">{loadingRole === "owner" ? "Signing in..." : "Continue as Owner"}</span>
                </button>

                <button
                  type="button"
                  className="role-card role-card-customer"
                  onClick={() => startGoogleSignIn("customer")}
                  disabled={Boolean(loadingRole)}
                >
                  <span className="role-kicker">For customers</span>
                  <strong>Check your place in line</strong>
                  <p>Enter a shop ID, join the queue, and see your position update in real time.</p>
                  <span className="role-cta">{loadingRole === "customer" ? "Signing in..." : "Continue as Customer"}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="setup-card">
              <p className="eyebrow">{isOwnerSetup ? "Owner Setup" : "Customer Setup"}</p>
              <h2 className="section-title">{isOwnerSetup ? "Create your shop" : "Join a barbershop"}</h2>
              <p className="muted">
                Signed in as <strong>{pendingUser.displayName || pendingUser.email}</strong>
              </p>

              {isOwnerSetup ? (
                <form className="stack-form field-gap" onSubmit={finishOwnerSetup}>
                  <label className="field">
                    <span className="stat-label">Barbershop name</span>
                    <input
                      className="text-input"
                      type="text"
                      value={shopName}
                      onChange={(event) => setShopName(event.target.value)}
                      placeholder="Fresh Fade Studio"
                    />
                  </label>
                  <div className="inline-actions">
                    <button type="submit" className="primary-button">
                      Create Shop
                    </button>
                    <button type="button" className="ghost-button" onClick={cancelSetup}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {isCustomerSetup ? (
                <form className="stack-form field-gap" onSubmit={finishCustomerSetup}>
                  <label className="field">
                    <span className="stat-label">Shop ID</span>
                    <input
                      className="text-input"
                      type="text"
                      value={shopId}
                      onChange={(event) => setShopId(event.target.value)}
                      placeholder="Paste the shop ID here"
                    />
                  </label>
                  <div className="inline-actions">
                    <button type="submit" className="primary-button">
                      Join Shop
                    </button>
                    <button type="button" className="ghost-button" onClick={cancelSetup}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          )}

          {successMessage ? <p className="info-text">{successMessage}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
