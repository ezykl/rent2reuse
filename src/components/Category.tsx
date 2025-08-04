import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { icons } from "@/constant";

const categories = [
  { id: 1, name: "Power Tools & Hand Tools", icon: icons.cDrill },
  { id: 2, name: "Construction & Workshop Equipment", icon: icons.cDecor },
  { id: 3, name: "Audio & Visual Equipment", icon: icons.cMusic },
  { id: 4, name: "Electronics & Computing", icon: icons.cGaming },
  { id: 5, name: "Gardening Tools", icon: icons.cGarden },
  { id: 6, name: "Camping & Outdoor Gear", icon: icons.cTent },
  { id: 7, name: "Measuring & Detection Tools", icon: icons.cTape },
  { id: 8, name: "Cleaning Equipment", icon: icons.cVacuum },
  { id: 9, name: "Lifting & Moving Tools", icon: icons.cHook },
  { id: 10, name: "Lighting & Photography", icon: icons.cCamera },
  { id: 11, name: "Automotive Tools", icon: icons.cPolishier },
  { id: 12, name: "Event & Entertainment", icon: icons.cTheater },
  { id: 13, name: "Safety Equipment", icon: icons.cSafety },
  { id: 14, name: "Specialty Tools", icon: icons.cToy },
  { id: 15, name: "Other", icon: icons.cMore },
];

const Category = () => {
  return (
    <View className="mt-6">
      <Text className="text-2xl text-secondary-400 font-psemibold mb-4">
        Categories
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {categories.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="w-[80px] h-[80px] border-[1px] border-primary gap-2 rounded-lg justify-center items-center"
              onPress={() => {
                router.push({
                  pathname: "/search",
                  params: { category: item.name },
                });
              }}
            >
              <Image
                source={item.icon}
                className="h-[24px] w-[24px]"
                style={{ tintColor: "#4BD07F" }}
                resizeMode="contain"
              />
              <Text
                className="text-xs text-center text-secondary-500 px-1 font-pmedium text-secondary-400"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default Category;
