import React, { useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { format } from "date-fns";
import { icons } from "@/constant";
import * as FileSystem from "expo-file-system";
import { captureRef } from "react-native-view-shot";

interface PaymentReceiptModalProps {
  visible: boolean;
  receiptData: {
    transactionId: string;
    amount: number;
    currency: string;
    paymentType: "initial" | "full";
    status: string;
    createdAt: any;
    confirmedAt: any;
    senderName: string;
    recipientName: string;
    itemName: string;
    paymentDetails: {
      description: string;
      totalPrice: number;
      downpaymentPercentage: number;
    };
    paypalTransactionId?: string;
    // ✅ Add VAT fields
    vatAmount?: number;
    subtotal?: number;
  } | null;
  onClose: () => void;
}

const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  visible,
  receiptData,
  onClose,
}) => {
  const receiptRef = useRef<View>(null);

  if (!receiptData) return null;

  // ✅ Calculate VAT if not provided
  const getVATAmount = () => {
    if (receiptData.vatAmount) {
      return receiptData.vatAmount;
    }
    // Fallback: calculate from amount (assume 12% VAT was included)
    return (receiptData.amount / 1.12) * 0.12;
  };

  const getSubtotal = () => {
    if (receiptData.subtotal) {
      return receiptData.subtotal;
    }
    // Fallback: calculate from amount
    return receiptData.amount / 1.12;
  };

  const vatAmount = getVATAmount();
  const subtotal = getSubtotal();

  const saveReceipt = async () => {
    try {
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
      });

      // Save to downloads
      const filename = `receipt-${receiptData.transactionId}.png`;
      const downloadPath = `${FileSystem.documentDirectory}receipts/`;

      await FileSystem.makeDirectoryAsync(downloadPath, {
        intermediates: true,
      });

      await FileSystem.copyAsync({
        from: uri,
        to: `${downloadPath}${filename}`,
      });

      Alert.alert("Success", "Receipt saved to downloads!");
    } catch (error) {
      console.log("Error saving receipt:", error);
      Alert.alert("Error", "Failed to save receipt");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-black/50 justify-end">
        {/* Receipt Container */}
        <View className="bg-white rounded-t-3xl max-h-[90%] shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200">
            <Text className="text-xl font-pbold text-gray-900">
              Payment Receipt
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Image
                source={icons.close}
                className="w-5 h-5"
                tintColor="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Receipt Content */}
            <View
              ref={receiptRef}
              className="bg-white p-6 mx-4 my-4 rounded-2xl border border-gray-200"
            >
              {/* Transaction ID */}
              <View className="items-center mb-6 pb-4 border-b border-gray-200">
                <Text className="text-sm font-pregular text-gray-500 mb-1">
                  Transaction ID
                </Text>
                <Text className="text-lg font-psemibold text-gray-900">
                  {receiptData.transactionId}
                </Text>
              </View>

              {/* Parties Involved */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <View className="flex-row justify-between mb-3">
                  <View>
                    <Text className="text-xs font-pregular text-gray-500 mb-1">
                      From
                    </Text>
                    <Text className="text-sm font-psemibold text-gray-900">
                      {receiptData.senderName}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs font-pregular text-gray-500 mb-1">
                      To
                    </Text>
                    <Text className="text-sm font-psemibold text-gray-900">
                      {receiptData.recipientName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Item Details */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <Text className="text-xs font-pregular text-gray-500 mb-2">
                  Item
                </Text>
                <Text className="text-sm font-psemibold text-gray-900 mb-1">
                  {receiptData.itemName}
                </Text>
                <Text className="text-xs font-pregular text-gray-600">
                  {receiptData.paymentDetails.description}
                </Text>
              </View>

              {/* Payment Amount Breakdown */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <Text className="text-sm font-psemibold text-gray-900 mb-3">
                  Payment Summary
                </Text>

                {/* Subtotal */}
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm font-pregular text-gray-600">
                    Subtotal
                  </Text>
                  <Text className="text-sm font-pmedium text-gray-900">
                    ₱{subtotal.toFixed(2)}
                  </Text>
                </View>

                {/* VAT */}
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm font-pregular text-gray-600">
                    VAT (12%)
                  </Text>
                  <Text className="text-sm font-pmedium text-green-600">
                    + ₱{vatAmount.toFixed(2)}
                  </Text>
                </View>

                {/* Total Amount */}
                <View className="flex-row justify-between bg-gray-50 p-3 rounded-lg">
                  <Text className="text-sm font-psemibold text-gray-900">
                    Total Amount
                  </Text>
                  <Text className="text-sm font-pbold text-gray-900">
                    ₱{receiptData.amount.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Payment Type */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <Text className="text-xs font-pregular text-gray-500 mb-2">
                  Payment Type
                </Text>
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      receiptData.paymentType === "initial"
                        ? "bg-orange-500"
                        : "bg-green-500"
                    }`}
                  />
                  <Text className="text-sm font-pmedium text-gray-900">
                    {receiptData.paymentType === "initial"
                      ? "Down Payment"
                      : "Full Payment"}
                  </Text>
                </View>
              </View>

              {/* Status */}
              <View className="mb-6">
                <Text className="text-xs font-pregular text-gray-500 mb-2">
                  Status
                </Text>
                <View
                  className={`px-3 py-2 rounded-lg ${
                    receiptData.status === "completed"
                      ? "bg-green-50"
                      : "bg-yellow-50"
                  }`}
                >
                  <Text
                    className={`text-sm font-psemibold ${
                      receiptData.status === "completed"
                        ? "text-green-700"
                        : "text-yellow-700"
                    }`}
                  >
                    {receiptData.status.charAt(0).toUpperCase() +
                      receiptData.status.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Timestamps */}
              <View className="items-center pt-4 border-t border-gray-200">
                <Text className="text-xs font-pregular text-gray-500 mb-1">
                  Date & Time
                </Text>
                <Text className="text-sm font-pmedium text-gray-900">
                  {receiptData.createdAt?.toDate
                    ? receiptData.createdAt
                        .toDate()
                        .toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                    : new Date(receiptData.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row gap-3 p-6 border-t border-gray-200">
            <TouchableOpacity
              onPress={saveReceipt}
              className="flex-1 bg-green-50 py-3 rounded-xl flex-row items-center justify-center"
            >
              <Image
                source={icons.download}
                className="w-5 h-5 mr-2"
                tintColor="#10B981"
              />
              <Text className="text-green-700 font-psemibold">Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="flex-1 bg-blue-500 py-3 rounded-xl"
            >
              <Text className="text-white font-psemibold text-center">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PaymentReceiptModal;
