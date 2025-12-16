import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { icons } from "@/constant";
import { format } from "date-fns";

interface Transaction {
  id?: string;
  amount: number;
  createdAt: any;
  currency: string;
  paymentMethod: string;
  paypalOrderId?: string;
  paypalTransactionId?: string;
  planDetails?: {
    duration: string;
    listLimit: number;
    planType: string;
    rentLimit: number;
  };
  planId?: string;
  status: string;
  subscriptionId?: string;
  transactionId: string;
  userId: string;
  recipientId?: string;
  type?: string;
  paymentType?: string;
  itemName?: string;
  itemId?: string;
  chatId?: string;
  paymentDetails?: {
    description: string;
    totalPrice: number;
    downpaymentPercentage: number;
  };
}

const TransactionsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<
    "all" | "rental" | "subscription"
  >("all");

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!auth.currentUser) return;

      try {
        const transactionsRef = collection(db, "transactions");
        // Query where user is either the sender or recipient
        const userTransactionsQuery = query(
          transactionsRef,
          where("userId", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc")
        );

        const receivedTransactionsQuery = query(
          transactionsRef,
          where("recipientId", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc")
        );

        const [sentSnap, receivedSnap] = await Promise.all([
          getDocs(userTransactionsQuery),
          getDocs(receivedTransactionsQuery),
        ]);

        const allTransactions = [...sentSnap.docs, ...receivedSnap.docs]
          .map((doc) => ({
            ...(doc.data() as Transaction),
            id: doc.id,
          }))
          .sort(
            (a, b) =>
              (b.createdAt?.toDate?.() || new Date(b.createdAt)).getTime() -
              (a.createdAt?.toDate?.() || new Date(a.createdAt)).getTime()
          );

        setTransactions(allTransactions);
      } catch (error) {
        console.log("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const getFilteredTransactions = () => {
    if (filterType === "all") return transactions;
    if (filterType === "rental") {
      return transactions.filter((t) => t.type === "rental_payment");
    }
    if (filterType === "subscription") {
      return transactions.filter((t) => !t.type || t.type !== "rental_payment");
    }
    return transactions;
  };

  const getTransactionType = (transaction: Transaction) => {
    // ✅ NEW: Check for rental payments
    if (transaction.type === "rental_payment") {
      if (transaction.recipientId === auth.currentUser?.uid) {
        return `Payment Received - ${
          transaction.paymentType === "initial" ? "Initial" : "Final"
        }`;
      } else {
        return `Payment Sent - ${
          transaction.paymentType === "initial" ? "Initial" : "Final"
        }`;
      }
    }

    // Existing plan subscription logic
    if (transaction.planDetails) {
      return "Subscription Payment";
    }

    if (transaction.recipientId) {
      return transaction.recipientId === auth.currentUser?.uid
        ? "Payment Received"
        : "Payment Sent";
    }

    return "Unknown Transaction";
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const transactionType = getTransactionType(item);
    const isIncoming =
      item.type === "rental_payment"
        ? item.recipientId === auth.currentUser?.uid
        : item.recipientId === auth.currentUser?.uid;

    return (
      <TouchableOpacity
        className="bg-white p-4 mb-2 rounded-xl border border-gray-100"
        onPress={() => {
          // Navigate to receipt or details
          if (item.type === "rental_payment") {
            // Show receipt modal
            console.log("Show receipt for:", item.transactionId);
          }
        }}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                item.type === "rental_payment"
                  ? isIncoming
                    ? "bg-green-100"
                    : "bg-blue-100"
                  : isIncoming
                  ? "bg-green-100"
                  : "bg-red-100"
              }`}
            >
              <Image
                source={
                  item.type === "rental_payment"
                    ? icons.receipt
                    : icons.leftArrow
                }
                className={`w-5 h-5 ${
                  item.type !== "rental_payment"
                    ? isIncoming
                      ? ""
                      : "rotate-90"
                    : ""
                }`}
                tintColor={
                  item.type === "rental_payment"
                    ? isIncoming
                      ? "#10B981"
                      : "#2196F3"
                    : isIncoming
                    ? "#059669"
                    : "#dc2626"
                }
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-pbold text-gray-900">
                {transactionType}
              </Text>
              {/* ✅ NEW: Show item name for rental payments */}
              {item.type === "rental_payment" && item.itemName && (
                <Text className="text-sm text-gray-500">{item.itemName}</Text>
              )}
              {item.planDetails && (
                <Text className="text-sm text-gray-500 capitalize">
                  {item.planDetails.planType} Plan
                </Text>
              )}
            </View>
          </View>
          <View className="items-end">
            <Text
              className={`font-pbold ${
                item.type === "rental_payment"
                  ? isIncoming
                    ? "text-green-600"
                    : "text-blue-600"
                  : isIncoming
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {isIncoming ? "+" : "-"}
              {item.currency} {item.amount.toFixed(2)}
            </Text>
            <Text className="text-xs text-gray-500">
              {format(
                item.createdAt?.toDate?.() || new Date(item.createdAt),
                "MMM d, yyyy h:mm a"
              )}
            </Text>
          </View>
        </View>

        {/* ✅ NEW: Show payment type badge for rental payments */}
        {item.type === "rental_payment" && (
          <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
            <View>
              <Text className="text-xs text-gray-500">Payment Type</Text>
              <Text className="text-sm font-pmedium text-gray-700 capitalize">
                {item.paymentType} Payment
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-500">Status</Text>
              <View
                className={`px-2 py-1 rounded-full ${
                  item.status === "completed"
                    ? "bg-green-100"
                    : item.status === "pending"
                    ? "bg-yellow-100"
                    : "bg-red-100"
                }`}
              >
                <Text
                  className={`text-xs font-pmedium ${
                    item.status === "completed"
                      ? "text-green-700"
                      : item.status === "pending"
                      ? "text-yellow-700"
                      : "text-red-700"
                  }`}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Existing transaction details */}
        {!item.type ||
          (item.type !== "rental_payment" && (
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
              <View>
                <Text className="text-xs text-gray-500">Transaction ID</Text>
                <Text className="text-sm font-pmedium text-gray-700">
                  {item.transactionId.slice(0, 15)}...
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-gray-500">Status</Text>
                <View
                  className={`px-2 py-1 rounded-full ${
                    item.status === "completed" || item.status === "success"
                      ? "bg-green-100"
                      : item.status === "pending"
                      ? "bg-yellow-100"
                      : "bg-red-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-pmedium ${
                      item.status === "completed" || item.status === "success"
                        ? "text-green-700"
                        : item.status === "pending"
                        ? "text-yellow-700"
                        : "text-red-700"
                    }`}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between p-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Image
              source={icons.leftArrow}
              className="w-8 h-8"
              tintColor="#374151"
            />
          </TouchableOpacity>
          <Text className="ml-4 text-xl font-pbold text-gray-900">
            Transactions
          </Text>
          <View className="w-8" />
        </View>

        {/* Filter Tabs */}
        <View className="flex-row px-4 pb-3 gap-2">
          {[
            { label: "All", value: "all" },
            { label: "Rental Payments", value: "rental" },
            { label: "Subscriptions", value: "subscription" },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.value}
              onPress={() => setFilterType(filter.value as typeof filterType)}
              className={`px-4 py-2 rounded-full ${
                filterType === filter.value ? "bg-primary" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-pmedium ${
                  filterType === filter.value ? "text-white" : "text-gray-700"
                }`}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4BD07F" />
          <Text className="mt-2 text-gray-600">Loading transactions...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View className="flex-1 justify-center items-center p-4">
          <Image
            source={icons.receipt}
            className="w-16 h-16 mb-4"
            tintColor="#9CA3AF"
          />
          <Text className="text-lg font-pbold text-gray-900 mb-2">
            No Transactions Yet
          </Text>
          <Text className="text-gray-500 text-center">
            Your transaction history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredTransactions()}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id || item.transactionId}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-4">
              <Image
                source={icons.receipt}
                className="w-16 h-16 mb-4"
                tintColor="#9CA3AF"
              />
              <Text className="text-lg font-pbold text-gray-900 mb-2">
                No Transactions
              </Text>
              <Text className="text-gray-500 text-center">
                No {filterType !== "all" ? filterType : ""} transactions found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TransactionsScreen;
