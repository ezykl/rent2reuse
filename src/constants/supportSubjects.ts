export const SUPPORT_SUBJECTS = [
  {
    id: "payment",
    label: "Payment Issues",
    priority: "High",
    description: "Issues with payments, subscriptions, or billing",
  },
  {
    id: "account",
    label: "Account Problems",
    priority: "High",
    description: "Account access, verification, or security concerns",
  },
  {
    id: "rental",
    label: "Rental Disputes",
    priority: "High",
    description: "Issues with ongoing rentals or disputes with renters/owners",
  },
  {
    id: "app_bug",
    label: "App Technical Issues",
    priority: "Medium",
    description: "Problems with app functionality or technical errors",
  },
  {
    id: "listing",
    label: "Listing Problems",
    priority: "Medium",
    description: "Issues with creating or managing listings",
  },
  {
    id: "suggestion",
    label: "Feature Suggestion",
    priority: "Low",
    description: "Suggestions for new features or improvements",
  },
  {
    id: "feedback",
    label: "General Feedback",
    priority: "Low",
    description: "General feedback about the app or service",
  },
] as const;
