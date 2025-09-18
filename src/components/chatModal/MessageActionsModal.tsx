import { icons } from "@/constant";
import Message from "@/types/message";
import { Modal, TouchableOpacity, Image, Text, View } from "react-native";

const MessageActionsModal = ({
  visible,
  onClose,
  onEdit,
  onSave,
  onDelete,
  message,
  currentUserId,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave?: () => void;
  onDelete: () => void;
  message?: Message | null;
  currentUserId?: string;
}) => {
  const isImageMessage = message?.type === "image";
  const isTextMessage = message?.type === "message" || !message?.type;
  const isCurrentUserMessage = message?.senderId === currentUserId;
  const isEditableMessage =
    isTextMessage && !message?.isDeleted && isCurrentUserMessage;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/10 justify-end"
      >
        <View className="bg-white rounded-t-3xl p-4">
          {/* Show Edit option only for text messages sent by current user that aren't deleted */}
          {isEditableMessage && (
            <TouchableOpacity
              onPress={onEdit}
              className="flex-row items-center p-4"
            >
              <Image
                source={icons.edit}
                className="w-6 h-6 mr-3"
                tintColor="#3b82f6"
              />
              <Text className="text-blue-500 text-base">Edit Message</Text>
            </TouchableOpacity>
          )}

          {/* Show Save option for all image messages that aren't deleted */}
          {isImageMessage && onSave && !message?.isDeleted && (
            <TouchableOpacity
              onPress={onSave}
              className="flex-row items-center p-4"
            >
              <Image
                source={icons.download}
                className="w-6 h-6 mr-3"
                tintColor="#10B981"
              />
              <Text className="text-green-500 text-base">Save Image</Text>
            </TouchableOpacity>
          )}

          {/* Delete option - show only for messages sent by current user */}
          {isCurrentUserMessage && (
            <TouchableOpacity
              onPress={onDelete}
              className="flex-row items-center p-4"
            >
              <Image
                source={icons.trash}
                className="w-6 h-6 mr-3"
                tintColor="#EF4444"
              />
              <Text className="text-red-500 text-base">
                Delete {isImageMessage ? "Image" : "Message"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default MessageActionsModal;
