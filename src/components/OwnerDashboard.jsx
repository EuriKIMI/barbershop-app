import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

function createServiceWindow(minutes) {
  const startedAt = Date.now();

  return {
    startedAt,
    endsAt: startedAt + minutes * 60 * 1000,
  };
}

function createServiceId() {
  return `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OwnerDashboard({ user, profile, demoData = null }) {
  const [shop, setShop] = useState(demoData?.shop || null);
  const [queue, setQueue] = useState(demoData?.queue || []);
  const [loading, setLoading] = useState(demoData?.loading ?? true);
  const [message, setMessage] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceImageUrl, setServiceImageUrl] = useState("");
  const [editingServiceId, setEditingServiceId] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("30");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    if (demoData || !profile?.shopId) {
      return undefined;
    }

    const shopUnsubscribe = onSnapshot(
      doc(db, "barbershops", profile.shopId),
      (shopSnap) => {
        setShop(shopSnap.exists() ? { id: shopSnap.id, ...shopSnap.data() } : null);
      },
      (error) => {
        console.error("Failed to load owner shop", error);
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
        console.error("Failed to watch owner queue", error);
        setMessage("We could not load the queue right now.");
        setLoading(false);
      }
    );

    return () => {
      shopUnsubscribe();
      unsubscribe();
    };
  }, [demoData, profile?.shopId]);

  const services = shop?.services || [];
  const currentServing = shop?.currentServing || null;

  const resetServiceForm = () => {
    setServiceName("");
    setServicePrice("");
    setServiceImageUrl("");
    setEditingServiceId("");
  };

  const saveServices = async (nextServices, successText) => {
    await updateDoc(doc(db, "barbershops", profile.shopId), {
      services: nextServices,
    });
    setMessage(successText);
  };

  const copyShopId = async () => {
    if (demoData) {
      setCopyMessage("Preview mode.");
      return;
    }

    try {
      await navigator.clipboard.writeText(profile.shopId);
      setCopyMessage("Copied.");
    } catch (error) {
      console.error("Failed to copy shop id", error);
      setCopyMessage("Copy failed.");
    }
  };

  const completeHaircut = async (queueId) => {
    if (demoData) {
      setMessage("Queue actions are disabled in preview mode.");
      return;
    }

    try {
      setMessage("");
      await deleteDoc(doc(db, "queues", queueId));

      if (currentServing?.queueEntryId === queueId) {
        await updateDoc(doc(db, "barbershops", profile.shopId), {
          currentServing: null,
        });
      }

      setMessage("Customer removed from the queue.");
    } catch (error) {
      console.error("Failed to remove queue entry", error);
      setMessage("We could not update the queue.");
    }
  };

  const clearQueue = async () => {
    if (demoData) {
      setMessage("Queue actions are disabled in preview mode.");
      return;
    }

    try {
      setMessage("");
      await Promise.all(queue.map((entry) => deleteDoc(doc(db, "queues", entry.id))));
      await updateDoc(doc(db, "barbershops", profile.shopId), {
        currentServing: null,
      });
      setMessage("Queue cleared.");
    } catch (error) {
      console.error("Failed to clear queue", error);
      setMessage("Clearing the queue failed.");
    }
  };

  const addOrUpdateService = async (event) => {
    event.preventDefault();

    if (demoData) {
      setMessage("Service editing is disabled in preview mode.");
      return;
    }

    const trimmedName = serviceName.trim();
    const parsedPrice = Number(servicePrice);
    const trimmedImageUrl = serviceImageUrl.trim();

    if (!trimmedName || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setMessage("Enter a valid cut name and price before saving.");
      return;
    }

    try {
      setMessage("");
      const nextService = {
        id: editingServiceId || createServiceId(),
        name: trimmedName,
        price: parsedPrice,
        imageUrl: trimmedImageUrl,
      };

      const nextServices = editingServiceId
        ? services.map((service) => (service.id === editingServiceId ? nextService : service))
        : [...services, nextService];

      await saveServices(nextServices, editingServiceId ? "Service updated." : "Service saved.");
      resetServiceForm();
    } catch (error) {
      console.error("Failed to save service", error);
      setMessage("We could not save that service.");
    }
  };

  const startEditingService = (service) => {
    if (demoData) {
      setMessage("Service editing is disabled in preview mode.");
      return;
    }

    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServicePrice(String(service.price));
    setServiceImageUrl(service.imageUrl || "");
  };

  const removeService = async (serviceId) => {
    if (demoData) {
      setMessage("Service editing is disabled in preview mode.");
      return;
    }

    try {
      setMessage("");
      await saveServices(
        services.filter((service) => service.id !== serviceId),
        "Service removed."
      );

      if (editingServiceId === serviceId) {
        resetServiceForm();
      }
    } catch (error) {
      console.error("Failed to remove service", error);
      setMessage("We could not remove that service.");
    }
  };

  const startServingCustomer = async (entry) => {
    if (demoData) {
      setMessage("Queue actions are disabled in preview mode.");
      return;
    }

    const parsedMinutes = Number(etaMinutes);

    if (Number.isNaN(parsedMinutes) || parsedMinutes <= 0) {
      setMessage("Set a valid estimated finish time in minutes first.");
      return;
    }

    try {
      setMessage("");
      const { startedAt, endsAt } = createServiceWindow(parsedMinutes);
      await updateDoc(doc(db, "barbershops", profile.shopId), {
        currentServing: {
          queueEntryId: entry.id,
          customerId: entry.customerId,
          customerName: entry.customerName,
          serviceName: entry.serviceName || "Walk-in",
          servicePrice: entry.servicePrice ?? null,
          serviceImageUrl: entry.serviceImageUrl || "",
          endsAt,
          etaMinutes: parsedMinutes,
          startedAt,
        },
      });
      setMessage(`Now serving ${entry.customerName}.`);
    } catch (error) {
      console.error("Failed to update current service", error);
      setMessage("We could not set the estimated finish time.");
    }
  };

  const clearCurrentServing = async () => {
    if (demoData) {
      setMessage("Queue actions are disabled in preview mode.");
      return;
    }

    try {
      setMessage("");
      await updateDoc(doc(db, "barbershops", profile.shopId), {
        currentServing: null,
      });
      setMessage("Current service cleared.");
    } catch (error) {
      console.error("Failed to clear current service", error);
      setMessage("We could not clear the current service.");
    }
  };

  const handleSignOut = async () => {
    if (demoData) {
      setMessage("Preview mode keeps this screen open for screenshots.");
      return;
    }

    await signOut(auth);
  };

  if (!profile?.shopId) {
    return (
      <div className="screen-shell">
        <div className="panel status-panel">
          <p className="eyebrow">Owner Dashboard</p>
          <h1>No shop connected</h1>
          <p className="muted">This owner account is missing its shop ID, so the dashboard cannot load yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-shell">
      <div className="dashboard-shell">
        <section className="panel dashboard-hero">
          <div className="dashboard-topbar">
            <div>
              <p className="eyebrow">Owner Dashboard</p>
              <h1 className="display-title">{shop?.name || "Your barbershop"}</h1>
            </div>
            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>

          <p className="muted">Keep this page open during the day and manage the line as customers join.</p>

          <div className="hero-meta-grid">
            <div className="hero-meta-card">
              <span className="stat-label">Share this shop ID</span>
              <strong>{profile?.shopId}</strong>
              <div className="inline-actions field-gap">
                <button type="button" className="ghost-button small-button" onClick={copyShopId}>
                  Copy Shop ID
                </button>
                {copyMessage ? <span className="mini-note">{copyMessage}</span> : null}
              </div>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Waiting now</span>
              <strong>{queue.length}</strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Next up</span>
              <strong>{queue[0]?.customerName || "No one yet"}</strong>
            </div>
          </div>

          <div className="hero-meta-grid">
            <div className="hero-meta-card">
              <span className="stat-label">Currently serving</span>
              <strong>{currentServing?.customerName || "No active customer"}</strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Estimated finish</span>
              <strong>
                {currentServing?.endsAt
                  ? new Date(currentServing.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  : "Not set"}
              </strong>
            </div>
            <div className="hero-meta-card">
              <span className="stat-label">Current service</span>
              <strong>{currentServing?.serviceName || "Not selected"}</strong>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="secondary-button" onClick={clearQueue} disabled={queue.length === 0}>
              Clear Queue
            </button>
            <button type="button" className="ghost-button" onClick={clearCurrentServing} disabled={!currentServing}>
              Clear Current Cut
            </button>
          </div>

          {message ? <p className="info-text">{message}</p> : null}
        </section>

        <div className="dashboard-grid">
          <section className="panel">
            <p className="eyebrow">Cuts And Pricing</p>
            <form className="stack-form" onSubmit={addOrUpdateService}>
              <div className="form-row">
                <label className="field">
                  <span className="stat-label">Cut name</span>
                  <input
                    className="text-input"
                    type="text"
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    placeholder="Classic taper"
                  />
                </label>
                <label className="field">
                  <span className="stat-label">Price</span>
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={servicePrice}
                    onChange={(event) => setServicePrice(event.target.value)}
                    placeholder="150"
                  />
                </label>
              </div>

              <label className="field">
                <span className="stat-label">Reference image URL</span>
                <input
                  className="text-input"
                  type="url"
                  value={serviceImageUrl}
                  onChange={(event) => setServiceImageUrl(event.target.value)}
                  placeholder="https://example.com/fade-reference.jpg"
                />
              </label>

              <div className="inline-actions">
                <button type="submit" className="primary-button">
                  {editingServiceId ? "Update Cut" : "Save Cut"}
                </button>
                {editingServiceId ? (
                  <button type="button" className="ghost-button" onClick={resetServiceForm}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="queue-list">
              {services.length === 0 ? (
                <p className="muted">No cuts added yet. Add a few so customers can see your pricing.</p>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="service-card">
                    {service.imageUrl ? (
                      <img className="service-image" src={service.imageUrl} alt={`${service.name} reference`} />
                    ) : (
                      <div className="service-image service-image-placeholder">No image</div>
                    )}
                    <div className="service-card-body">
                      <div>
                        <strong>{service.name}</strong>
                        <p className="muted">PHP {Number(service.price).toFixed(2)}</p>
                      </div>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => startEditingService(service)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button small-button"
                          onClick={() => removeService(service.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel status-panel-large">
            <p className="eyebrow">Current Cut Timing</p>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Signed in as</span>
                <strong>{profile?.name || user?.displayName || "Owner"}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Queue state</span>
                <strong>{queue.length === 0 ? "Open and quiet" : "Active queue"}</strong>
              </div>
            </div>

            <label className="field field-gap">
              <span className="stat-label">Estimated finish time for current customer</span>
              <input
                className="text-input"
                type="number"
                min="1"
                step="1"
                value={etaMinutes}
                onChange={(event) => setEtaMinutes(event.target.value)}
                placeholder="30"
              />
            </label>
            <p className="muted">Choose a customer from the live queue and we will show the finish time to everyone.</p>
          </section>

          <section className="panel">
            <p className="eyebrow">Live Queue</p>
            {loading ? (
              <p className="muted">Loading queue...</p>
            ) : queue.length === 0 ? (
              <p className="muted">No customers are waiting right now.</p>
            ) : (
              <div className="queue-list">
                {queue.map((entry, index) => (
                  <div key={entry.id} className="queue-item queue-item-spread">
                    <div className="queue-person">
                      <span className="queue-rank">#{index + 1}</span>
                      <div>
                        <strong>{entry.customerName}</strong>
                        <p className="muted">
                          {entry.serviceName
                            ? `${entry.serviceName}${entry.servicePrice != null ? ` · PHP ${Number(entry.servicePrice).toFixed(0)}` : ""}`
                            : "Walk-in"}
                        </p>
                        <p className="muted">
                          {currentServing?.queueEntryId === entry.id ? "Currently in the chair" : "Ready for the next available chair"}
                        </p>
                      </div>
                    </div>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => startServingCustomer(entry)}
                      >
                        Start Cut
                      </button>
                      <button
                        type="button"
                        className="primary-button small-button"
                        onClick={() => completeHaircut(entry.id)}
                      >
                        Mark Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
