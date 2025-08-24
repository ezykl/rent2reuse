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
}

const TransactionsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

        const allTransactions = [...sentSnap.docs, ...receivedSnap.docs].map(
          (doc) => ({
            ...(doc.data() as Transaction),
            id: doc.id,
          })
        );

        setTransactions(allTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const getTransactionType = (transaction: Transaction) => {
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
    const isIncoming = item.recipientId === auth.currentUser?.uid;

    return (
      <View className="bg-white p-4 mb-2 rounded-xl border border-gray-100">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isIncoming ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <Image
                source={icons.leftArrow}
                className={`w-5 h-5 ${
                  !isIncoming ? "rotate-90" : "-rotate-90"
                }`}
                tintColor={isIncoming ? "#059669" : "#dc2626"}
              />
            </View>
            <View className="ml-3">
              <Text className="font-pbold text-gray-900">
                {transactionType}
              </Text>
              {item.planDetails && (
                <Text className="text-sm text-gray-500 capitalize  ">
                  {item.planDetails.planType} Plan
                </Text>
              )}
            </View>
          </View>
          <View className="items-end">
            <Text
              className={`font-pbold ${
                isIncoming ? "text-green-600" : "text-red-600"
              }`}
            >
              {isIncoming ? "+" : "-"}
              {item.currency} {item.amount.toFixed(2)}
            </Text>
            <Text className="text-xs text-gray-500">
              {format(item.createdAt?.toDate(), "MMM d, yyyy h:mm a")}
            </Text>
          </View>
        </View>

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
                item.status === "success"
                  ? "bg-green-100"
                  : item.status === "pending"
                  ? "bg-yellow-100"
                  : "bg-red-100"
              }`}
            >
              <Text
                className={`text-xs font-pmedium ${
                  item.status === "success"
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
      </View>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
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
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.transactionId}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default TransactionsScreen;
