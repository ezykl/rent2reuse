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
 * Send money directly to PayPal email (Payouts API)
 * This is more suitable for your use case than invoicing
 */
export const sendPayPalMoney = async (
  accessToken: string,
  recipientEmail: string,
  phpAmount: number,
  orderDetails?: {
    note?: string;
    senderItemId?: string;
    emailSubject?: string;
  }
): Promise<any> => {
  try {
    // Convert PHP to USD for PayPal
    const usdAmount = DatabaseHelper.convertToUsd(phpAmount);
    const transactionId = DatabaseHelper.generateTransactionId();

    const payoutData = {
      sender_batch_header: {
        sender_batch_id: transactionId,
        email_subject: orderDetails?.emailSubject || "Payment from Rent2Reuse",
        email_message: orderDetails?.note || "You have received a payment",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: usdAmount,
            currency: "USD",
          },
          receiver: recipientEmail,
          note: orderDetails?.note || "Payment from Rent2Reuse chat",
          sender_item_id: orderDetails?.senderItemId || transactionId,
        },
      ],
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payoutData),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.error("PayPal payout failed:", data);
      throw new Error(data.message || "Failed to send PayPal money");
    }
  } catch (error) {
    console.error("Error sending PayPal money:", error);
    throw error;
  }
};

/**
 * Create PayPal invoice (Alternative approach)
 * This creates an invoice that gets emailed to the recipient
 */
export const createPayPalInvoice = async (
  accessToken: string,
  recipientEmail: string,
  phpAmount: number,
  invoiceDetails?: {
    itemName?: string;
    itemDescription?: string;
    customId?: string;
    note?: string;
  }
): Promise<any> => {
  try {
    const usdAmount = DatabaseHelper.convertToUsd(phpAmount);
    const invoiceId = `INV_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    const invoiceData = {
      detail: {
        invoice_number: invoiceId,
        reference: invoiceDetails?.customId,
        invoice_date: new Date().toISOString().split("T")[0],
        currency_code: "USD",
        note: invoiceDetails?.note || "Payment request from Rent2Reuse",
      },
      invoicer: {
        name: {
          given_name: "Rent2Reuse",
          surname: "Platform",
        },
        email_address: "noreply@rent2reuse.com", // Your platform email
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: "Customer",
              surname: "",
            },
            email_address: recipientEmail,
          },
        },
      ],
      items: [
        {
          name: invoiceDetails?.itemName || "Rental Payment",
          description:
            invoiceDetails?.itemDescription || "Payment for rental service",
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: usdAmount,
          },
        },
      ],
      configuration: {
        partial_payment: {
          allow_partial_payment: false,
        },
        allow_tip: false,
        tax_calculated_after_discount: true,
        tax_inclusive: false,
      },
      amount: {
        breakdown: {
          item_total: {
            currency_code: "USD",
            value: usdAmount,
          },
        },
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": invoiceId,
      },
      body: JSON.stringify(invoiceData),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.error("PayPal invoice creation failed:", data);
      throw new Error(data.message || "Failed to create PayPal invoice");
    }
  } catch (error) {
    console.error("Error creating PayPal invoice:", error);
    throw error;
  }
};

/**
 * Send PayPal invoice to recipient
 */
export const sendPayPalInvoice = async (
  accessToken: string,
  invoiceId: string,
  emailSubject?: string,
  personalMessage?: string
): Promise<any> => {
  try {
    const sendData = {
      send_to_recipient: true,
      send_to_invoicer: false,
      subject: emailSubject || "Payment Request from Rent2Reuse",
      note: personalMessage || "Please complete this payment when convenient.",
    };

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(sendData),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json();
      console.error("PayPal invoice send failed:", data);
      throw new Error(data.message || "Failed to send PayPal invoice");
    }
  } catch (error) {
    console.error("Error sending PayPal invoice:", error);
    throw error;
  }
};

/**
 * Get invoice status
 */
export const getPayPalInvoiceStatus = async (
  accessToken: string,
  invoiceId: string
): Promise<any> => {
  try {
    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}`,
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
      throw new Error(data.message || "Failed to get invoice status");
    }
  } catch (error) {
    console.error("Error getting PayPal invoice status:", error);
    throw error;
  }
};

// Updated types
export interface PayPalPayoutResponse {
  batch_header: {
    payout_batch_id: string;
    batch_status: "PENDING" | "PROCESSING" | "SUCCESS" | "CANCELED";
    sender_batch_header: {
      sender_batch_id: string;
      email_subject: string;
    };
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalInvoiceResponse {
  id: string;
  status:
    | "DRAFT"
    | "SENT"
    | "SCHEDULED"
    | "PAID"
    | "MARKED_AS_PAID"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_PAID"
    | "PAYMENT_PENDING";
  detail: {
    invoice_number: string;
    reference: string;
    invoice_date: string;
    currency_code: string;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

// Keep existing functions for backward compatibility
export const createPayPalOrder = async (
  accessToken: string,
  phpAmount: number,
  currency = "USD",
  orderDetails?: {
    description?: string;
    customId?: string;
    invoiceId?: string;
  }
): Promise<any> => {
  // ... (existing implementation)
};

export const capturePayPalOrder = async (
  accessToken: string,
  orderId: string
): Promise<any> => {
  // ... (existing implementation)
};
