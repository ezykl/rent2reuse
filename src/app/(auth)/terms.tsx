import React, { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { images } from "@/constant";

const Terms = () => {
  const router = useRouter();

  return (
    <View className="flex-1 p-4 bg-white mt-3">
      {/* Terms Content */}
      <ScrollView
        className="flex-1 mb-4"
        scrollEventThrottle={16} 
      >
        <Image
          source={images.logo}
          className="w-full h-[32px] mb-4"
          resizeMode="contain"
        />
        {/* Welcome Section */}
        <View className="mb-6">
          <Text className="font-pmedium text-xl text-gray-700 leading-7">
            Welcome to Rent2Reuse!
          </Text>
        </View>

        <Text className="font-pregular text-lg text-gray-700 leading-7">
          By using our platform, you agree to the following terms and
          conditions. Please read them carefully before using our services.
          {"\n\n"}
        </Text>

        {/* Numbered Sections */}
        <Text className="font-semibold text-xl text-gray-900 mb-2">
          1. User Responsibilities
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          Users must ensure all account information is accurate. Misuse of the
          platform, such as posting inappropriate content or failing to adhere
          to rental agreements, is strictly prohibited. Users are solely
          responsible for safeguarding their account credentials.
        </Text>

        {/* Numbered Section 2 */}
        <Text className="font-semibold text-xl text-gray-900 mb-2">
          2. Rental Agreements
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          Renters and lessors must communicate and finalize rental terms using
          the provided tools on the platform.{" "}
          <Text className="italic">Rent2Reuse</Text> is not responsible for any
          breaches of agreements or disputes arising from transactions between
          users.
        </Text>

        {/* Numbered Section 3 */}
        <Text className="font-semibold text-xl text-gray-900 mb-2">
          3. Subscription Services
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          Subscription plans provide enhanced features. By subscribing, you
          agree to periodic charges as outlined in your selected plan.{" "}
          <Text className="italic">Rent2Reuse</Text> reserves the right to
          modify subscription features or pricing with prior notice.
        </Text>

        {/* Numbered Section 4 */}
        <Text className="font-semibold text-xl text-gray-900 mb-2">
          4. Limitation of Liability
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          <Text className="italic">Rent2Reuse</Text> is not liable for damages,
          disputes, or losses resulting from interactions between users. Users
          are encouraged to communicate effectively and act responsibly during
          transactions.
        </Text>

        {/* Additional Sections */}
        <Text className="font-semibold text-xl text-gray-900 mb-2">
          5. Termination of Service
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          <Text className="italic">Rent2Reuse</Text> reserves the right to
          suspend or terminate accounts that violate our terms of service or
          engage in fraudulent or harmful activities on the platform.
        </Text>

        <Text className="font-semibold text-xl text-gray-900 mb-2">
          6. Privacy
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          Your data is protected per our privacy policy. However, users are
          responsible for maintaining the confidentiality of their account
          information. The platform does not sell or share user data without
          consent.
        </Text>

        <Text className="font-semibold text-xl text-gray-900 mb-2">
          7. Payments and Transactions
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          All payments processed through{" "}
          <Text className="italic">Rent2Reuse</Text> are handled securely.{" "}
          <Text className="italic">Rent2Reuse</Text> is not liable for payment
          gateway failures or unauthorized transactions caused by user
          negligence.
        </Text>

        <Text className="font-semibold text-xl text-gray-900 mb-2">
          8. Reviews and Feedback
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          Users can provide feedback and reviews after a transaction.{" "}
          <Text className="italic">Rent2Reuse</Text> reserves the right to
          remove inappropriate or false reviews.
        </Text>

        <Text className="font-semibold text-xl text-gray-900 mb-2">
          9. Dispute Resolution
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
          In the event of a dispute, users are encouraged to resolve issues
          amicably. <Text className="italic">Rent2Reuse</Text> may mediate
          disputes but does not guarantee resolution.
        </Text>

        <Text className="font-semibold text-xl text-gray-900 mb-2">
          10. Updates to Terms
        </Text>
        <Text className="font-pregular text-lg text-gray-700 leading-7">
          <Text className="italic">Rent2Reuse</Text> reserves the right to
          update these terms and conditions. Continued use of the platform after
          changes are made constitutes acceptance of the revised terms.
        </Text>
      </ScrollView>
    </View>
  );
};

export default Terms;
