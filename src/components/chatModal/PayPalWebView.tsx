import React from "react";
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import WebView from "react-native-webview";
import { PAYPAL_CLIENT_ID } from "@/utils/paypalHelper";

interface PayPalWebViewProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  recipientEmail: string;
  description: string;
  onPaymentSuccess: (transactionId: string, amount: string) => void;
  onPaymentError: (error: any) => void;
  onPaymentCancel: () => void;
}

const PayPalWebView: React.FC<PayPalWebViewProps> = ({
  visible,
  onClose,
  amount,
  recipientEmail,
  description,
  onPaymentSuccess,
  onPaymentError,
  onPaymentCancel,
}) => {
  const usdAmount = (amount / 56.5).toFixed(2); // Convert PHP to USD

  const paypalHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PayPal Payment</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 400px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .payment-info {
                text-align: center;
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            .amount {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
            }
            .description {
                color: #666;
                font-size: 14px;
            }
            .recipient {
                color: #007bff;
                font-size: 12px;
                margin-top: 5px;
            }
            #paypal-button-container {
                margin-top: 20px;
            }
            .loading {
                text-align: center;
                color: #666;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="payment-info">
                <div class="amount">$${usdAmount} USD</div>
                <div class="description">${description}</div>
                <div class="recipient">To: ${recipientEmail}</div>
            </div>
            
            <div id="paypal-button-container"></div>
            
            <div class="loading" id="loading">
                Loading PayPal...
            </div>
        </div>

        <script src="https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&disable-funding=credit,card"></script>
        <script>
            document.getElementById('loading').style.display = 'none';
            
            paypal.Buttons({
                style: {
                    layout: 'vertical',
                    color: 'blue',
                    shape: 'rect',
                    label: 'paypal'
                },
                createOrder: function(data, actions) {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: '${usdAmount}',
                                currency_code: 'USD'
                            },
                            payee: {
                                email_address: '${recipientEmail}'
                            },
                            description: '${description}',
                            custom_id: 'RENT2REUSE_${Date.now()}'
                        }]
                    });
                },
                onApprove: function(data, actions) {
                    return actions.order.capture().then(function(details) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'PAYMENT_SUCCESS',
                            transactionId: details.id,
                            payerEmail: details.payer.email_address,
                            amount: details.purchase_units[0].amount.value,
                            status: details.status
                        }));
                    });
                },
                onError: function(err) {
                    console.log('PayPal error:', err);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'PAYMENT_ERROR',
                        error: err.toString()
                    }));
                },
                onCancel: function(data) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'PAYMENT_CANCELLED',
                        orderId: data.orderID
                    }));
                }
            }).render('#paypal-button-container');
        </script>
    </body>
    </html>
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <View className="flex-row justify-between items-center p-4 bg-white border-b border-gray-200">
          <Text className="font-psemibold text-lg">Complete Payment</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-500 font-pmedium">Cancel</Text>
          </TouchableOpacity>
        </View>

        <WebView
          source={{ html: paypalHTML }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);

              switch (data.type) {
                case "PAYMENT_SUCCESS":
                  onPaymentSuccess(data.transactionId, data.amount);
                  break;
                case "PAYMENT_ERROR":
                  onPaymentError(data.error);
                  break;
                case "PAYMENT_CANCELLED":
                  onPaymentCancel();
                  break;
                default:
                  console.log("Unknown message type:", data.type);
              }
            } catch (error) {
              console.log("Error parsing WebView message:", error);
              onPaymentError("Failed to process payment response");
            }
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default PayPalWebView;
