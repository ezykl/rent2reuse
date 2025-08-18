import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { icons, images } from "@/constant";
import SettingItem from "../components/SettingItem";

const Setting = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);

  return (
    <SafeAreaView className="bg-white h-full px-4 pt-8">
      {/* HEADER */}
      <View className="flex-row items-center justify-between my-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={icons.leftArrow}
            className="h-[28px] w-[28px]"
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text className="text-center font-psemibold text-2xl flex-1">
          Settings
        </Text>

        <View className="w-[28px]" />
      </View>

      {/* Setting Items */}
      <SettingItem
        icon={icons.about}
        title="About Us"
        onPress={() => setShowAbout(true)}
      />

      <SettingItem
        icon={icons.terms}
        title="Terms & Conditions"
        onPress={() => setShowTerms(true)}
      />

      <SettingItem
        icon={icons.privacy}
        title="Privacy Policy"
        onPress={() => setShowPrivacyPolicy(true)}
      />

      <SettingItem
        icon={icons.faq}
        title="FAQ"
        onPress={() => setShowFAQ(true)}
      />

      {/* Terms Modal */}
      <Modal
        visible={showTerms}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowTerms(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="bg-white border-b border-gray-200 px-4 py-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowTerms(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <Image
                  source={icons.leftArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>
              <Text className="flex-1 text-center text-lg font-semibold text-gray-900 mr-10">
                Terms & Conditions
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 p-4" scrollEventThrottle={16}>
            <Image
              source={images.logo}
              className="w-full h-[32px] mb-4"
              resizeMode="contain"
            />

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
              Users must ensure all account information is accurate. Misuse of
              the platform, such as posting inappropriate content or failing to
              adhere to rental agreements, is strictly prohibited. Users are
              solely responsible for safeguarding their account credentials.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              2. Rental Listings
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              All rental listings must provide accurate and detailed information
              about the item, including its condition, rental price, and
              availability. Renters are encouraged to upload clear photos and
              provide honest descriptions.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              3. Booking and Payment
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              By booking a rental, you agree to pay the specified rental fee and
              any applicable taxes or charges. Payments are processed through
              secure channels, and you will receive a confirmation receipt via
              email.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              4. Cancellations and Refunds
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Cancellation policies vary by listing and are specified on the
              rental page. Refunds, if applicable, will be processed according
              to the stated policy.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              5. User Conduct
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Users are expected to communicate respectfully and promptly. Any
              form of harassment, discrimination, or illegal activity is
              strictly prohibited and may result in account suspension or
              termination.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              6. Dispute Resolution
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              In the event of a dispute between users, Rent2Reuse encourages
              direct communication to resolve the issue. If a resolution cannot
              be reached, users may contact Rent2Reuse support for assistance.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              7. Limitation of Liability
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Rent2Reuse is not liable for any indirect, incidental, or
              consequential damages arising from the use or inability to use the
              platform. Our liability is limited to the maximum extent permitted
              by law.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              8. Governing Law
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              These terms and conditions are governed by the laws of the
              jurisdiction in which Rent2Reuse operates. Any legal disputes
              shall be resolved in the competent courts of that jurisdiction.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              9. Changes to Terms
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Rent2Reuse reserves the right to modify these terms and conditions
              at any time. Users will be notified of significant changes via
              email or through a notice on the platform. Continued use of the
              platform after changes are made constitutes acceptance of the
              revised terms.
            </Text>

            <Text className="font-semibold text-xl text-gray-900 mb-2">
              10. Updates to Terms
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-8">
              <Text className="italic">Rent2Reuse</Text> reserves the right to
              update these terms and conditions. Continued use of the platform
              after changes are made constitutes acceptance of the revised
              terms.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Privacy Policy WebView Modal */}
      <Modal
        visible={showPrivacyPolicy}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="bg-white border-b border-gray-200 px-4 py-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowPrivacyPolicy(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <Image
                  source={icons.leftArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>
              <Text className="flex-1 text-center text-lg font-semibold text-gray-900 mr-10">
                Privacy Policy
              </Text>
            </View>
          </View>

          <WebView
            source={{
              uri: "https://www.termsfeed.com/live/a1c3071f-d444-4233-9814-bd2af4128949",
            }}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute inset-0 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#4BD07F" />
                <Text className="text-gray-600 mt-2">Loading...</Text>
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn("WebView error:", nativeEvent);
            }}
            className="flex-1"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>

      {/* About Us Modal */}
      <Modal
        visible={showAbout}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAbout(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="bg-white border-b border-gray-200 px-4 py-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowAbout(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <Image
                  source={icons.leftArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>
              <Text className="flex-1 text-center text-lg font-semibold text-gray-900 mr-10">
                About Us
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 p-4" scrollEventThrottle={16}>
            <Image
              source={images.logo}
              className="w-full h-[32px] mb-4"
              resizeMode="contain"
            />

            <Text className="font-pmedium text-2xl text-gray-900 mb-4">
              Welcome to Rent2Reuse
            </Text>

            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-6">
              Rent2Reuse is a pioneering platform designed to transform how we
              think about and use everyday items. Our mission is to promote
              sustainability and resource efficiency through a vibrant sharing
              economy.
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mb-3">
              Our Vision
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-6">
              We envision a world where sharing resources becomes the norm,
              reducing waste and creating a more sustainable future for
              generations to come.
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mb-3">
              What We Offer
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-6">
              • Secure and user-friendly rental platform{"\n"}• Verified user
              profiles and ratings{"\n"}• Transparent pricing and policies{"\n"}
              • Protected payment systems{"\n"}• Community-driven marketplace
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mb-3">
              Why Choose Rent2Reuse?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-6">
              • Save money on items you only need temporarily{"\n"}• Earn from
              items you don't use frequently{"\n"}• Reduce environmental impact
              {"\n"}• Join a community of conscious consumers{"\n"}• Access
              quality items without ownership burden
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mb-3">
              Contact Us
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-8">
              Have questions or suggestions? We'd love to hear from you!{"\n"}
              Email: support@rent2reuse.com{"\n"}
              Follow us on social media @rent2reuse
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={showFAQ}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowFAQ(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="bg-white border-b border-gray-200 px-4 py-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowFAQ(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <Image
                  source={icons.leftArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>
              <Text className="flex-1 text-center text-lg font-semibold text-gray-900 mr-10">
                Frequently Asked Questions
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 p-4" scrollEventThrottle={16}>
            <Image
              source={images.logo}
              className="w-full h-[32px] mb-4"
              resizeMode="contain"
            />

            <Text className="font-pmedium text-xl text-gray-900 mb-4">
              General Questions
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              How do I create an account?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Simply click the "Sign Up" button and follow the registration
              process. You'll need to verify your email and complete your
              profile before renting or listing items.
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              Is my information secure?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Yes! We use industry-standard encryption and security measures to
              protect your personal and payment information.
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mt-6 mb-4">
              Renting Items
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              How do I rent an item?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Browse available items, select your rental dates, and submit a
              request. The owner will review and approve your request, after
              which you can proceed with payment.
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              What about damage or loss?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              We recommend documenting item condition before and after rental.
              Any disputes will be handled through our resolution center.
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mt-6 mb-4">
              Listing Items
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              How do I list my items?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-4">
              Click "List Item", add photos and details, set your rental price
              and availability. Make sure to provide accurate descriptions and
              clear photos.
            </Text>

            <Text className="font-pmedium text-xl text-gray-900 mt-6 mb-4">
              Support
            </Text>

            <Text className="font-pmedium text-lg text-gray-900 mb-2">
              How do I contact support?
            </Text>
            <Text className="font-pregular text-lg text-gray-700 leading-7 mb-8">
              You can reach our support team through:{"\n"}• In-app help center
              {"\n"}• Email: support@rent2reuse.com{"\n"}• Chat support
              (available 9AM-6PM)
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default Setting;
