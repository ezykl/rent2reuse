import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

interface AgreementData {
  chatId: string;
  isOwner: boolean;
  itemDetails?: {
    name?: string;
    totalPrice?: number;
    downpaymentPercentage?: number;
    startDate?: any;
    endDate?: any;
    image?: string;
    description?: string;
    pickupTime?: number;
    itemLocation?: string | { address?: string };
  };
}

const AgreementForm = () => {
  const { data } = useLocalSearchParams();

  const [agreementData, setAgreementData] = useState<AgreementData | null>(
    null
  );
  const [chatData, setChatData] = useState<any>(null);
  const [recipientName, setRecipientName] = useState<{
    firstname: string;
    lastname: string;
  }>({ firstname: "", lastname: "" });
  const [currentUserName, setCurrentUserName] = useState<{
    firstname: string;
    lastname: string;
  }>({ firstname: "", lastname: "" });
  const [loading, setLoading] = useState(true);
  const [sendingAgreement, setSendingAgreement] = useState(false);

  useEffect(() => {
    const initializeAgreement = async () => {
      try {
        if (!data) {
          Alert.alert("Error", "No agreement data provided");
          router.back();
          return;
        }

        const parsedData = JSON.parse(String(data)) as AgreementData;
        setAgreementData(parsedData);

        const chatRef = doc(db, "chat", parsedData.chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
          throw new Error("Chat not found");
        }

        const chatDataFromDb = chatSnap.data();
        setChatData(chatDataFromDb);

        const recipientId =
          auth.currentUser?.uid === chatDataFromDb.ownerId
            ? chatDataFromDb.requesterId
            : chatDataFromDb.ownerId;

        const recipientRef = doc(db, "users", recipientId);
        const recipientSnap = await getDoc(recipientRef);

        if (recipientSnap.exists()) {
          const recipientData = recipientSnap.data();
          setRecipientName({
            firstname: recipientData.firstname || "",
            lastname: recipientData.lastname || "",
          });
        }

        if (auth.currentUser) {
          const currentUserRef = doc(db, "users", auth.currentUser.uid);
          const currentUserSnap = await getDoc(currentUserRef);

          if (currentUserSnap.exists()) {
            const currentUserData = currentUserSnap.data();
            setCurrentUserName({
              firstname: currentUserData.firstname || "",
              lastname: currentUserData.lastname || "",
            });
          }
        }

        setLoading(false);
      } catch (error) {
        console.log("Error initializing agreement:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to load agreement",
        });
        router.back();
      }
    };

    initializeAgreement();
  }, [data]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "N/A";
    const date = dateValue.toDate?.() || new Date(dateValue);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return "9:00 AM";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`;
  };

  const calculateRentalDays = () => {
    if (
      !agreementData?.itemDetails?.startDate ||
      !agreementData?.itemDetails?.endDate
    ) {
      return 0;
    }
    const startDate =
      agreementData.itemDetails.startDate.toDate?.() ||
      new Date(agreementData.itemDetails.startDate);
    const endDate =
      agreementData.itemDetails.endDate.toDate?.() ||
      new Date(agreementData.itemDetails.endDate);
    return Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const calculateDownpayment = () => {
    if (
      !agreementData?.itemDetails?.totalPrice ||
      !agreementData?.itemDetails?.downpaymentPercentage
    ) {
      return 0;
    }
    return (
      (agreementData.itemDetails.totalPrice *
        agreementData.itemDetails.downpaymentPercentage) /
      100
    );
  };

  const calculateRemainingPayment = () => {
    const totalPrice = agreementData?.itemDetails?.totalPrice || 0;
    const downpayment = calculateDownpayment();
    return totalPrice - downpayment;
  };

  const handleAgreedToTerms = async () => {
    if (!agreementData || !auth.currentUser) return;

    try {
      setSendingAgreement(true);

      const chatRef = doc(db, "chat", agreementData.chatId);
      const currentUserId = auth.currentUser.uid;
      const isOwner = agreementData.isOwner;

      const updateData = isOwner
        ? {
            ownerAgreed: true,
            ownerAgreedAt: serverTimestamp(),
          }
        : {
            renterAgreed: true,
            renterAgreedAt: serverTimestamp(),
          };

      await updateDoc(chatRef, updateData);

      const messagesRef = collection(
        db,
        "chat",
        agreementData.chatId,
        "messages"
      );

      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: `${isOwner ? "Owner" : "Renter"} agreed to rental terms`,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Agreement accepted. Waiting for other party to agree.",
      });

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.log("Error accepting agreement:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to accept agreement",
      });
    } finally {
      setSendingAgreement(false);
    }
  };

  const handleShareAgreement = async () => {
    try {
      const agreementText = generateAgreementText();
      await Share.share({
        message: agreementText,
        title: "Rental Agreement",
      });
    } catch (error) {
      console.log("Error sharing agreement:", error);
    }
  };

  const generateAgreementText = () => {
    const totalPrice = agreementData?.itemDetails?.totalPrice || 0;
    const downpayment = calculateDownpayment();
    const remaining = calculateRemainingPayment();
    const rentalDays = calculateRentalDays();
    const downpaymentPercentage =
      agreementData?.itemDetails?.downpaymentPercentage || 0;

    const locationDisplay =
      typeof agreementData?.itemDetails?.itemLocation === "string"
        ? agreementData.itemDetails.itemLocation
        : (agreementData?.itemDetails?.itemLocation as any)?.address ||
          "To be arranged";

    return `RENT2REUSE - RENTAL AGREEMENT

Item: ${agreementData?.itemDetails?.name || "N/A"}
Owner: ${currentUserName.firstname} ${currentUserName.lastname}
Renter: ${recipientName.firstname} ${recipientName.lastname}

RENTAL PERIOD:
Start Date: ${formatDate(agreementData?.itemDetails?.startDate)}
End Date: ${formatDate(agreementData?.itemDetails?.endDate)}
Duration: ${rentalDays} days

PICKUP:
Date: ${formatDate(agreementData?.itemDetails?.startDate)}
Time: ${formatTime(agreementData?.itemDetails?.pickupTime ?? 0)}
Location: ${locationDisplay}

PAYMENT TERMS:
Total Rental Price: ₱${totalPrice.toLocaleString()}
Down Payment (${downpaymentPercentage}%): ₱${downpayment.toLocaleString()}
Remaining Balance: ₱${remaining.toLocaleString()}

TERMS & CONDITIONS:
1. Renter acknowledges receipt of the item in good condition
2. Renter agrees to maintain the item in the same condition
3. Any damage beyond normal wear and tear is renter's liability
4. Item must be returned by end date
5. Renter is responsible for loss or theft of the item

Date: ${new Date().toLocaleDateString()}`;
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#5C6EF6" />
          <Text className="text-gray-600 font-pmedium mt-3">
            Loading agreement...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalPrice = agreementData?.itemDetails?.totalPrice || 0;
  const downpayment = calculateDownpayment();
  const remaining = calculateRemainingPayment();
  const rentalDays = calculateRentalDays();
  const downpaymentPercentage =
    agreementData?.itemDetails?.downpaymentPercentage || 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Simple Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={icons.leftArrow} className="w-6 h-6" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-pbold ml-3">Rental Agreement</Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Item Info */}
          <View className="mb-6">
            <Text className="text-2xl font-pbold text-gray-900 mb-2">
              {agreementData?.itemDetails?.name || "Item"}
            </Text>
            <Text className="text-sm text-gray-600 font-pmedium">
              {agreementData?.itemDetails?.description || "No description"}
            </Text>
          </View>

          {/* Parties */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              PARTIES
            </Text>
            <View className="mb-3">
              <Text className="text-xs text-gray-600 mb-1 font-pmedium">
                Owner
              </Text>
              <Text className="text-sm font-psemibold text-gray-900">
                {currentUserName.firstname} {currentUserName.lastname}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-gray-600 mb-1 font-pmedium">
                Renter
              </Text>
              <Text className="text-sm font-psemibold text-gray-900">
                {recipientName.firstname} {recipientName.lastname}
              </Text>
            </View>
          </View>

          {/* Rental Dates */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              RENTAL DATES
            </Text>
            <View className="mb-3 flex-row justify-between">
              <Text className="text-sm text-gray-600 font-pmedium">Start</Text>
              <Text className="font-pbold text-gray-900">
                {formatDate(agreementData?.itemDetails?.startDate)}
              </Text>
            </View>
            <View className="mb-3 flex-row justify-between">
              <Text className="text-sm text-gray-600 font-pmedium">End</Text>
              <Text className="font-pbold text-gray-900">
                {formatDate(agreementData?.itemDetails?.endDate)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-600 font-pmedium">
                Duration
              </Text>
              <Text className="font-pbold text-gray-900">
                {rentalDays} days
              </Text>
            </View>
          </View>

          {/* Pickup Info */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              PICKUP
            </Text>
            <View className="mb-3 flex-row justify-between">
              <Text className="text-sm text-gray-600 font-pmedium">Time</Text>
              <Text className="font-pbold text-gray-900">
                {formatTime(agreementData?.itemDetails?.pickupTime ?? 0)}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-gray-600 font-pmedium mb-1">
                Location
              </Text>
              <Text className="font-pbold text-gray-900">
                {typeof agreementData?.itemDetails?.itemLocation === "string"
                  ? agreementData.itemDetails.itemLocation
                  : (agreementData?.itemDetails?.itemLocation as any)
                      ?.address || "To be arranged"}
              </Text>
            </View>
          </View>

          {/* Payment */}
          <View className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              PAYMENT
            </Text>
            <View className="mb-2 flex-row justify-between">
              <Text className="text-sm text-gray-600 font-pmedium">
                Total Price
              </Text>
              <Text className="font-pbold text-gray-900">
                ₱{totalPrice.toLocaleString()}
              </Text>
            </View>
            {downpaymentPercentage > 0 && (
              <>
                <View className="mb-2 flex-row justify-between">
                  <Text className="text-sm text-gray-600 font-pmedium">
                    Down Payment ({downpaymentPercentage}%)
                  </Text>
                  <Text className="font-pbold text-yellow-700">
                    ₱{downpayment.toLocaleString()}
                  </Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-yellow-200">
                  <Text className="text-sm text-gray-600 font-pmedium">
                    Remaining
                  </Text>
                  <Text className="font-pbold text-yellow-700">
                    ₱{remaining.toLocaleString()}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Terms */}
          <View className="mb-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              TERMS & CONDITIONS
            </Text>
            <Text className="text-xs text-gray-700 leading-5">
              1. Renter acknowledges receipt of the item in good condition{"\n"}
              2. Renter agrees to maintain the item in the same condition{"\n"}
              3. Any damage beyond normal wear and tear is renter's liability
              {"\n"}
              4. Item must be returned by end date{"\n"}
              5. Renter is responsible for loss or theft of the item
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="border-t border-gray-200 p-4 bg-white gap-2">
        <TouchableOpacity
          onPress={handleShareAgreement}
          className="bg-gray-100 rounded-lg py-3 flex-row items-center justify-center"
        >
          <Image
            source={icons.share}
            className="w-5 h-5 mr-2"
            tintColor="#6B7280"
          />
          <Text className="font-psemibold text-gray-700">Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAgreedToTerms}
          disabled={sendingAgreement}
          className={`rounded-lg py-3 flex-row items-center justify-center ${
            sendingAgreement ? "bg-gray-300" : "bg-primary"
          }`}
        >
          {sendingAgreement ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text className="font-psemibold text-white ml-2">
                Processing...
              </Text>
            </>
          ) : (
            <>
              <Image
                source={icons.check}
                className="w-5 h-5 mr-2"
                tintColor="#fff"
              />
              <Text className="font-psemibold text-white">
                I Agree to Terms
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AgreementForm;
