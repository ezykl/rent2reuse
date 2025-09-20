import { PAYPAL_BASE_URL } from "@env";

// PayPal Configuration - Move these to your environment variables
export const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID || "YOUR_SANDBOX_CLIENT_ID";
export const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET || "YOUR_SANDBOX_CLIENT_SECRET";

// Exchange rate management for PHP to USD conversion
let currentRate = 56.5; // Default fallback rate

async function fetchExchangeRate() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=PHP"
    );
    const data = await res.json();

    if (data?.rates?.PHP) {
      currentRate = data.rates.PHP;
      console.log("Fetched exchange rate:", currentRate);
    } else {
      console.log("API response invalid, keeping fallback:", data);
    }
  } catch (err) {
    console.log("Error fetching rate, using fallback:", err);
  }
}

// Initialize exchange rate and refresh every 30 minutes
fetchExchangeRate();
setInterval(fetchExchangeRate, 30 * 60 * 1000);

// Currency conversion utilities
export const DatabaseHelper = {
  generateTransactionId: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `CHAT_TXN_${timestamp}_${random}`;
  },

  // Convert PHP to USD for PayPal
  convertToUsd: (phpAmount: number): string => {
    return (parseFloat(phpAmount.toString()) / currentRate).toFixed(2);
  },

  // Convert USD to PHP for display
  convertToPhp: (usdAmount: string | number): string => {
    return (parseFloat(usdAmount.toString()) * currentRate).toFixed(2);
  },
};

/**
 * Get PayPal access token for API authentication
 */
export const getPayPalAccessToken = async (
  clientId: string,
  clientSecret: string
): Promise<string> => {
  try {
    const auth = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();

    if (response.ok) {
      return data.access_token;
    } else {
      throw new Error(data.error_description || "Failed to get access token");
    }
  } catch (error) {
    console.error("Error getting PayPal access token:", error);
    throw error;
  }
};

/**
 * Create a PayPal payment order
 */
export const createPayPalOrder = async (
  accessToken: string,
  phpAmount: number, // Amount in PHP
  currency = "USD",
  orderDetails?: {
    description?: string;
    customId?: string;
    invoiceId?: string;
  }
): Promise<any> => {
  try {
    // Convert PHP to USD for PayPal
    const usdAmount = DatabaseHelper.convertToUsd(phpAmount);

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD", // PayPal processes in USD
            value: usdAmount,
          },
          description: orderDetails?.description || "Chat Payment",
          custom_id: orderDetails?.customId,
          invoice_id: orderDetails?.invoiceId,
        },
      ],
      application_context: {
        return_url:
          "https://www.paypal.com/checkoutnow/error?paymentId=success",
        cancel_url: "https://www.paypal.com/checkoutnow/error?paymentId=cancel",
        user_action: "PAY_NOW",
        brand_name: "Rent2Reuse",
        landing_page: "BILLING",
        shipping_preference: "NO_SHIPPING",
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`, // Idempotency key
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.error("PayPal order creation failed:", data);
      throw new Error(data.message || "Failed to create PayPal order");
    }
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    throw error;
  }
};

/**
 * Capture/complete a PayPal payment after user approval
 */
export const capturePayPalOrder = async (
  accessToken: string,
  orderId: string
): Promise<any> => {
  try {
    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `${Date.now()}-${Math.random()
            .toString(36)
            .substring(7)}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.error("PayPal capture failed:", data);
      throw new Error(data.message || "Failed to capture PayPal payment");
    }
  } catch (error) {
    console.error("Error capturing PayPal payment:", error);
    throw error;
  }
};

/**
 * Get payment details from PayPal (for verification)
 */
export const getPayPalOrderDetails = async (
  accessToken: string,
  orderId: string
): Promise<any> => {
  try {
    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || "Failed to get order details");
    }
  } catch (error) {
    console.error("Error getting PayPal order details:", error);
    throw error;
  }
};

/**
 * Validate PayPal webhook signature (for production security)
 */
export const validatePayPalWebhook = async (
  webhookId: string,
  headers: Record<string, string>,
  body: string
): Promise<boolean> => {
  try {
    // This would be used if you implement PayPal webhooks for additional security
    // Implementation depends on your backend setup
    console.log("Webhook validation not implemented in client");
    return true;
  } catch (error) {
    console.error("Error validating PayPal webhook:", error);
    return false;
  }
};

// Types for better TypeScript support
export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description: string;
  }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status:
    | "COMPLETED"
    | "DECLINED"
    | "PARTIALLY_REFUNDED"
    | "PENDING"
    | "REFUNDED";
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
        final_capture: boolean;
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
}

// Error handling utilities
export const handlePayPalError = (error: any): string => {
  if (error?.details) {
    return error.details.map((detail: any) => detail.description).join(", ");
  }

  if (error?.message) {
    return error.message;
  }

  return "An unknown PayPal error occurred";
};

// Payment status utilities
export const getPaymentStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    pending: "#F59E0B",
    paid: "#10B981",
    failed: "#EF4444",
    cancelled: "#6B7280",
    refunded: "#8B5CF6",
  };

  return statusColors[status.toLowerCase()] || "#6B7280";
};

export const getPaymentStatusText = (status: string): string => {
  const statusTexts: Record<string, string> = {
    pending: "Pending Payment",
    paid: "Payment Completed",
    failed: "Payment Failed",
    cancelled: "Payment Cancelled",
    refunded: "Payment Refunded",
  };

  return statusTexts[status.toLowerCase()] || "Unknown Status";
};
