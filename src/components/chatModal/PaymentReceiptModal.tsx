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
              {/* Receipt Header */}
              <View className="items-center mb-6 pb-4 border-b border-gray-200">
                <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mb-3">
                  <Text className="text-2xl">✓</Text>
                </View>
                <Text className="text-2xl font-pbold text-gray-900 mb-2">
                  Payment Confirmed
                </Text>
                <Text className="text-sm text-gray-600">
                  {receiptData.confirmedAt
                    ? format(
                        receiptData.confirmedAt?.toDate?.() ||
                          new Date(receiptData.confirmedAt),
                        "MMM d, yyyy h:mm a"
                      )
                    : ""}
                </Text>
              </View>

              {/* Amount */}
              <View className="items-center mb-6 pb-4 border-b border-gray-200">
                <Text className="text-sm text-gray-600 mb-1">
                  Payment Amount
                </Text>
                <Text className="text-4xl font-pbold text-gray-900">
                  ₱
                  {receiptData.amount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  {receiptData.paymentType === "initial"
                    ? "Initial Payment"
                    : "Final Payment"}
                </Text>
              </View>

              {/* Payment Details */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <Text className="text-sm font-pbold text-gray-900 mb-3">
                  Transaction Details
                </Text>

                {/* From/To */}
                <View className="mb-3">
                  <Text className="text-xs text-gray-600 mb-1">From</Text>
                  <View className="bg-blue-50 p-3 rounded-lg">
                    <Text className="font-pmedium text-gray-900">
                      {receiptData.senderName}
                    </Text>
                  </View>
                </View>

                <View className="items-center my-2">
                  <Image
                    source={icons.arrowDown}
                    className="w-4 h-4"
                    tintColor="#9CA3AF"
                  />
                </View>

                <View className="mb-3">
                  <Text className="text-xs text-gray-600 mb-1">To</Text>
                  <View className="bg-green-50 p-3 rounded-lg">
                    <Text className="font-pmedium text-gray-900">
                      {receiptData.recipientName}
                    </Text>
                  </View>
                </View>

                {/* Item */}
                <View>
                  <Text className="text-xs text-gray-600 mb-1">For Item</Text>
                  <View className="bg-gray-50 p-3 rounded-lg">
                    <Text className="font-pmedium text-gray-900">
                      {receiptData.itemName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              <View className="mb-6 pb-4 border-b border-gray-200">
                <Text className="text-sm font-pbold text-gray-900 mb-2">
                  Description
                </Text>
                <Text className="text-sm text-gray-700 leading-5">
                  {receiptData.paymentDetails.description}
                </Text>
              </View>

              {/* Transaction IDs */}
              <View className="bg-gray-50 p-4 rounded-lg">
                <View className="mb-3">
                  <Text className="text-xs text-gray-600 mb-1">
                    Transaction ID
                  </Text>
                  <Text className="text-xs font-mono text-gray-900 break-all">
                    {receiptData.transactionId}
                  </Text>
                </View>

                {receiptData.paypalTransactionId && (
                  <View>
                    <Text className="text-xs text-gray-600 mb-1">
                      PayPal Transaction ID
                    </Text>
                    <Text className="text-xs font-mono text-gray-900 break-all">
                      {receiptData.paypalTransactionId}
                    </Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View className="items-center mt-6 pt-4 border-t border-gray-200">
                <Text className="text-xs text-gray-600">
                  This receipt is a proof of payment
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Keep this for your records
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
              <Text className="text-green-600 font-psemibold">Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="flex-1 bg-blue-500 py-3 rounded-xl"
            >
              <Text className="text-white font-psemibold text-center">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PaymentReceiptModal;
