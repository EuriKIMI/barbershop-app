import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export default function CustomerDashboard({ user, profile }) {
  const [shop, setShop] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");

  useEffect(() => {
    if (!profile?.shopId) {
      return undefined;
    }

    const shopUnsubscribe = onSnapshot(
      doc(db, "barbershops", profile.shopId),
      (shopSnap) => {
        setShop(shopSnap.exists() ? { id: shopSnap.id, ...shopSnap.data() } : null);
      },
      (error) => {
        console.error("Failed to load shop", error);
        setMessage("We could not load your shop details.");
      }
    );

    const queueQuery = query(
      collection(db, "queues"),
      where("shopId", "==", profile.shopId),
      orderBy("joinedAt", "asc")
    );

    const unsubscribe = onSnapshot(
      queueQuery,
      (snapshot) => {
        setQueue(
          snapshot.docs.map((entryDoc) => ({
            id: entryDoc.id,
            ...entryDoc.data(),
          }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to watch queue", error);
        setMessage("We could not load the live queue right now.");
        setLoading(false);
      }
    );

    return () => {
      shopUnsubscribe();
      unsubscribe();
    };
  }, [profile?.shopId]);

  const currentEntry = queue.find((entry) => entry.customerId === user.uid);
  const position = currentEntry ? queue.findIndex((entry) => entry.id === currentEntry.id) + 1 : null;
  const services = shop?.services || [];
  const currentServing = shop?.currentServing || null;
  const activeServiceId =
    selectedServiceId && services.some((service) => service.id === selectedServiceId)
      ? selectedServiceId
      : services[0]?.id || "";
  const selectedService = services.find((service) => service.id === activeServiceId) || null;

  if (!profile?.shopId) {
    return (
      <div className="screen-shell">
        <div className="panel status-panel">
          <p className="eyebrow">Customer Dashboard</p>
          <h1>No shop connected</h1>
          <p className="muted">This account is missing a shop ID, so the queue cannot load yet.</p>
        </div>
      </div>
    );
  }

  const joinQueue = async () => {
    if (currentEntry) {
      setMessage("You are already in the queue.");
      return;
    }

    if (services.length > 0 && !selectedService) {
      setMessage("Pick a cut first so the owner can see what service you want.");
      return;
    }

    try {
      setMessage("");
      await addDoc(collection(db, "queues"), {
        customerId: user.uid,
        customerName: user.displayName || user.email || "Customer",
        shopId: profile.shopId,
        serviceId: selectedService?.id || "",
        serviceName: selectedService?.name || "Walk-in",
        servicePrice: selectedService?.price ?? null,
        serviceImageUrl: selectedService?.imageUrl || "",
        joinedAt: Date.now(),
      });
      setMessage("You joined the queue.");
    } catch (error) {
      console.error("Failed to join queue", error);
      setMessage("Joining the queue failed. Please try again.");
    }
  };

  const leaveQueue = async () => {
    if (!currentEntry) {
      return;
    }

    try {
      setMessage("");
      await deleteDoc(doc(db, "queues", currentEntry.id));
      setMessage("You left the queue.");
    } catch (error) {
      console.error("Failed to leave queue", error);
      setMessage("We could not remove you from the queue.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div className="screen-shell">
      <div className="dashboard-shell">
        <section className="panel dashboard-hero">
          <div className="dashboard-topbar">
            <div>
              <p className="eyebrow">Customer Dashboard</p>
              <h1 className="display-title">{shop?.name || "Your barbershop"}</h1>
            </div>
            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>

          <div className="hero-meta-grid">
            <div className="hero-meta-card">
              <span className="stat-label">Shop ID</span>
              <strong>{profile?.shopId}</strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Signed in as</span>
              <strong>{profile?.name || user?.displayName || "Customer"}</strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Queue size</span>
              <strong>{queue.length}</strong>
            </div>
          </div>

          <div className="hero-meta-grid hero-meta-grid-wide">
            <div className="hero-meta-card">
              <span className="stat-label">Currently serving</span>
              <strong>{currentServing?.customerName || "Waiting to start"}</strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Estimated finish</span>
              <strong>
                {currentServing?.endsAt
                  ? new Date(currentServing.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  : "Not set yet"}
              </strong>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="primary-button" onClick={joinQueue} disabled={loading || Boolean(currentEntry)}>
              {currentEntry ? "Already in Queue" : "Join Queue"}
            </button>
            <button type="button" className="secondary-button" onClick={leaveQueue} disabled={!currentEntry}>
              Leave Queue
            </button>
          </div>

          {message ? <p className="info-text">{message}</p> : null}
        </section>

        <div className="dashboard-grid">
          <section className="panel status-panel-large">
            <p className="eyebrow">Your Status</p>
            {loading ? (
              <p className="muted">Loading the queue...</p>
            ) : currentEntry ? (
              <>
                <h2 className="queue-position">#{position}</h2>
                <p className="muted">
                  {position === 1 ? "You are next in line." : `${position - 1} customer(s) ahead of you.`}
                </p>
              </>
            ) : (
              <p className="muted">You are not in line yet. Join the queue when you are ready.</p>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Cuts And Prices</p>
            {services.length > 0 ? (
              <label className="field field-gap">
                <span className="stat-label">Choose your cut before joining</span>
                <select
                  className="text-input"
                  value={activeServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                  disabled={Boolean(currentEntry)}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - PHP {Number(service.price).toFixed(0)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="queue-list">
              {services.length === 0 ? (
                <p className="muted">The owner has not added services yet.</p>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="service-card">
                    {service.imageUrl ? (
                      <img className="service-image" src={service.imageUrl} alt={`${service.name} reference`} />
                    ) : (
                      <div className="service-image service-image-placeholder">No image</div>
                    )}
                    <div className="service-card-body">
                      <strong>{service.name}</strong>
                      <p className="muted">Available at the shop today</p>
                      <p className="muted">PHP {Number(service.price).toFixed(0)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Live Queue</p>
            <div className="queue-list">
              {queue.length === 0 ? (
                <p className="muted">The queue is empty right now.</p>
              ) : (
                queue.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`queue-item ${entry.customerId === user.uid ? "queue-item-active" : ""}`}
                  >
                    <div>
                      <strong>{entry.customerName}</strong>
                      <p className="muted">
                        Position {index + 1}
                        {entry.serviceName ? ` · ${entry.serviceName}` : ""}
                      </p>
                    </div>
                    {entry.customerId === user.uid ? (
                      <span className="pill">You</span>
                    ) : (
                      <span className="queue-rank">#{index + 1}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
