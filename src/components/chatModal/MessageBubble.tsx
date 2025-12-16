import React from "react";
import { View, Text, Image } from "react-native";
import { format } from "date-fns";
import { icons } from "@/constant";

interface MessageBubbleProps {
  text: string;
  isCurrentUser: boolean;
  isDeleted: boolean;
  isEdited: boolean;
  read: boolean;
  createdAt: any;
  isSelected: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  isCurrentUser,
  isDeleted,
  isEdited,
  read,
  createdAt,
  isSelected,
}) => {
  return (
    <View
      className={`flex-1 flex-col ${
        isCurrentUser ? "items-end" : "items-start"
      }`}
      style={{
        // ✅ IMPORTANT: Don't set maxWidth on wrapper, let content determine width
        marginRight: isCurrentUser ? 0 : "auto",
        marginLeft: isCurrentUser ? "auto" : 0,
      }}
    >
      {/* ✅ MESSAGE BUBBLE CONTAINER */}
      <View
        className={`justify-center rounded-2xl px-4 py-3 ${
          isCurrentUser
            ? "bg-primary rounded-tr-none"
            : "bg-white rounded-tl-none border border-gray-200"
        } ${isSelected ? "border-2 border-primary opacity-75" : ""}`}
        style={{
          // ✅ KEY FIX: Use maxWidth to limit width but allow shorter messages to shrink
          maxWidth: "80%",
          minWidth: isDeleted ? "auto" : undefined, // Allow deleted messages to be smaller
        }}
      >
        {isDeleted ? (
          <Text
            className={`text-base italic ${
              isCurrentUser ? "text-white/70" : "text-gray-500"
            }`}
          >
            [Message deleted]
          </Text>
        ) : (
          <>
            <Text
              className={`${
                isCurrentUser ? "text-white" : "text-gray-800"
              } text-base leading-6`}
              allowFontScaling={true}
              selectable={true}
              numberOfLines={0} // ✅ Allow unlimited lines, will wrap naturally
            >
              {text}
            </Text>
          </>
        )}

        {/* ✅ EDITED INDICATOR */}
        {isEdited && !isDeleted && (
          <Text
            className={`text-xs mt-1 ${
              isCurrentUser ? "text-white/60" : "text-gray-500"
            }`}
          >
            (edited)
          </Text>
        )}
      </View>

      {/* ✅ TIMESTAMP AND READ STATUS */}
      <View
        className={`flex-row items-center mt-1 px-1 ${
          isCurrentUser ? "justify-end" : "justify-start"
        }`}
      >
        {isCurrentUser && (
          <>
            {read ? (
              <Image
                source={icons.doubleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#4285F4"
              />
            ) : (
              <Image
                source={icons.singleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#9CA3AF"
              />
            )}
          </>
        )}
        <Text className="text-xs text-gray-400">
          {createdAt ? format(createdAt.toDate(), "h:mm a") : ""}
        </Text>
      </View>
    </View>
  );
};

export default MessageBubble;
