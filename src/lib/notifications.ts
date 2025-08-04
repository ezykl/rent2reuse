// lib/notifications.js or data/notifications.js

// Notification type configurations
export const NOTIFICATION_TYPES = {
  RENT_REQUEST: {
    label: "Rental Request",
    icon: "🏠",
    color: "#3B82F6", // blue
    bgColor: "#EFF6FF",
    actionText: "Respond",
  },
  MESSAGE: {
    label: "Message",
    icon: "💬",
    color: "#6B7280", // gray
    bgColor: "#F9FAFB",
    actionText: "Reply",
  },
  PRICE_NEGOTIATION: {
    label: "Price Negotiation",
    icon: "💰",
    color: "#F59E0B", // amber
    bgColor: "#FFFBEB",
    actionText: "Review",
  },
  PICKUP_CONFIRMATION: {
    label: "Pickup",
    icon: "📦",
    color: "#10B981", // emerald
    bgColor: "#ECFDF5",
    actionText: "Confirm",
  },
  PAYMENT_RECEIVED: {
    label: "Payment Received",
    icon: "✅",
    color: "#059669", // emerald
    bgColor: "#D1FAE5",
    actionText: "View",
  },
  PAYMENT_SENT: {
    label: "Payment Sent",
    icon: "💳",
    color: "#8B5CF6", // violet
    bgColor: "#F3E8FF",
    actionText: "Confirm",
  },
  BULK_INQUIRY: {
    label: "Bulk Inquiry",
    icon: "📋",
    color: "#0891B2", // cyan
    bgColor: "#ECFEFF",
    actionText: "Quote",
  },
  DELIVERY_REQUEST: {
    label: "Delivery",
    icon: "🚚",
    color: "#DC2626", // red
    bgColor: "#FEF2F2",
    actionText: "Arrange",
  },
  RENTAL_CONFIRMED: {
    label: "Confirmed",
    icon: "✅",
    color: "#059669", // emerald
    bgColor: "#D1FAE5",
    actionText: "View",
  },
  RETURN_REMINDER: {
    label: "Return Due",
    icon: "⏰",
    color: "#DC2626", // red
    bgColor: "#FEF2F2",
    actionText: "Remind",
  },
};

// Priority levels
export const PRIORITY_LEVELS = {
  urgent: { color: "#DC2626", label: "Urgent" },
  high: { color: "#EA580C", label: "High" },
  normal: { color: "#6B7280", label: "Normal" },
  low: { color: "#9CA3AF", label: "Low" },
};

// Mock notification data
export const notificationMessages = [
  {
    id: "1",
    type: "RENT_REQUEST",
    title: "New Rental Request",
    message:
      "Hey! Is the drill still available? I need it for a project this weekend, so a quick response would be great.",
    senderName: "John Doe",
    itemName: "Power Drill",
    dateReceived: "2025-02-09T10:30:00Z",
    isRead: false,
    priority: "normal",
    actionRequired: true,
  },
  {
    id: "2",
    type: "MESSAGE",
    title: "Message from Renter",
    message:
      "Thanks for the quick response! I appreciate your time. I'll get back to you once I confirm my schedule.",
    senderName: "Jane Smith",
    dateReceived: "2025-02-08T14:15:00Z",
    isRead: true,
    priority: "low",
    actionRequired: false,
  },
  {
    id: "3",
    type: "PRICE_NEGOTIATION",
    title: "Price Negotiation Request",
    message:
      "Can we negotiate the price for the ladder? I'm renting for a month, so hoping for a discount.",
    senderName: "Mark Taylor",
    itemName: "Extension Ladder",
    originalPrice: 50,
    proposedPrice: 40,
    dateReceived: "2025-02-07T09:45:00Z",
    isRead: false,
    priority: "normal",
    actionRequired: true,
  },
  {
    id: "4",
    type: "PICKUP_CONFIRMATION",
    title: "Pickup Scheduled",
    message:
      "I'll pick up the item tomorrow. Thanks! Please let me know if there's a specific time that works for you.",
    senderName: "Emily Davis",
    itemName: "Circular Saw",
    scheduledDate: "2025-02-07T10:00:00Z",
    dateReceived: "2025-02-06T16:20:00Z",
    isRead: true,
    priority: "normal",
    actionRequired: false,
  },
  {
    id: "5",
    type: "PAYMENT_RECEIVED",
    title: "Payment Confirmed",
    message: "Payment of $75 has been received for your power drill rental.",
    senderName: "System",
    itemName: "Power Drill",
    amount: 75,
    paymentMethod: "PayPal",
    dateReceived: "2025-02-05T11:30:00Z",
    isRead: false,
    priority: "high",
    actionRequired: false,
  },
  {
    id: "6",
    type: "BULK_INQUIRY",
    title: "Bulk Rental Inquiry",
    message:
      "Is there any discount for bulk rentals? I might need multiple tools for a week-long project.",
    senderName: "Alice Brown",
    requestedItems: ["Drill", "Saw", "Ladder"],
    duration: "1 week",
    dateReceived: "2025-02-04T13:10:00Z",
    isRead: true,
    priority: "normal",
    actionRequired: true,
  },
  {
    id: "7",
    type: "PAYMENT_SENT",
    title: "Payment Confirmation Needed",
    message:
      "I just sent the payment. Please confirm when you receive it. Also, let me know the pickup details.",
    senderName: "David Wilson",
    itemName: "Angle Grinder",
    amount: 35,
    dateReceived: "2025-02-03T08:45:00Z",
    isRead: false,
    priority: "high",
    actionRequired: true,
  },
  {
    id: "8",
    type: "DELIVERY_REQUEST",
    title: "Delivery Request",
    message:
      "Can you deliver this to my address? I don't have a way to pick it up myself and would really appreciate the help.",
    senderName: "Sophia White",
    itemName: "Tile Cutter",
    deliveryAddress: "123 Main St, City",
    dateReceived: "2025-02-02T15:30:00Z",
    isRead: false,
    priority: "normal",
    actionRequired: true,
  },
  {
    id: "9",
    type: "RENTAL_CONFIRMED",
    title: "Rental Confirmed",
    message:
      "Looking forward to using this for my project. I'll make sure to return it in perfect condition!",
    senderName: "Ethan Martinez",
    itemName: "Jigsaw",
    rentalPeriod: "3 days",
    dateReceived: "2025-02-01T12:00:00Z",
    isRead: true,
    priority: "low",
    actionRequired: false,
  },
  {
    id: "10",
    type: "RETURN_REMINDER",
    title: "Return Reminder",
    message:
      "Your rental period ends tomorrow. Please return the item on time to avoid late fees.",
    senderName: "System",
    itemName: "Circular Saw",
    dueDate: "2025-02-02T18:00:00Z",
    lateFeePenalty: 10,
    dateReceived: "2025-02-01T10:00:00Z",
    isRead: false,
    priority: "urgent",
    actionRequired: true,
  },
];
