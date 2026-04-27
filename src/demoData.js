const demoServices = [
  {
    id: "service-classic-fade",
    name: "Classic Fade",
    price: 180,
    imageUrl:
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "service-textured-crop",
    name: "Textured Crop",
    price: 220,
    imageUrl:
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "service-beard-shape",
    name: "Beard Shape Up",
    price: 120,
    imageUrl:
      "https://images.unsplash.com/photo-1512690459411-b0fd1c86b8c8?auto=format&fit=crop&w=900&q=80",
  },
];

const demoQueue = [
  {
    id: "queue-1",
    customerId: "customer-demo-1",
    customerName: "Marcus",
    serviceId: "service-classic-fade",
    serviceName: "Classic Fade",
    servicePrice: 180,
    serviceImageUrl: demoServices[0].imageUrl,
    joinedAt: 1,
  },
  {
    id: "queue-2",
    customerId: "customer-demo-2",
    customerName: "Ethan",
    serviceId: "service-textured-crop",
    serviceName: "Textured Crop",
    servicePrice: 220,
    serviceImageUrl: demoServices[1].imageUrl,
    joinedAt: 2,
  },
  {
    id: "queue-3",
    customerId: "customer-demo-3",
    customerName: "Noah",
    serviceId: "service-beard-shape",
    serviceName: "Beard Shape Up",
    servicePrice: 120,
    serviceImageUrl: demoServices[2].imageUrl,
    joinedAt: 3,
  },
];

export const ownerDemoData = {
  shop: {
    id: "shop-demo-001",
    name: "Fade District Studio",
    services: demoServices,
    currentServing: {
      queueEntryId: "queue-1",
      customerId: "customer-demo-1",
      customerName: "Marcus",
      serviceName: "Classic Fade",
      servicePrice: 180,
      serviceImageUrl: demoServices[0].imageUrl,
      startedAt: Date.parse("2026-04-27T14:00:00+08:00"),
      endsAt: Date.parse("2026-04-27T14:35:00+08:00"),
      etaMinutes: 35,
    },
  },
  queue: demoQueue,
  loading: false,
};

export const customerDemoData = {
  shop: ownerDemoData.shop,
  queue: demoQueue,
  loading: false,
  selectedServiceId: "service-textured-crop",
};
