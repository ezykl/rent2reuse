import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width: screenWidth } = Dimensions.get("window");

interface AnnouncementItem {
  id: string;
  isActive: boolean;
  title: string;
  message: string;
  imageUrl: string | null;
}

interface AnnouncementModalProps {
  announcement: AnnouncementItem | null;
  visible: boolean;
  onClose: () => void;
}

const AnnouncementModal = ({
  announcement,
  visible,
  onClose,
}: AnnouncementModalProps) => {
  if (!announcement) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Image Section */}
          {announcement.imageUrl && (
            <Image
              source={{ uri: announcement.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{announcement.title}</Text>
            <Text style={styles.message}>{announcement.message}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: Math.min(screenWidth - 40, 350),
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  image: {
    width: "95%",
    height: 200,
    borderRadius: 16,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#666",
    lineHeight: 24,
  },
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1a1a1a",
    lineHeight: 26,
  },
  message: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
});

export default AnnouncementModal;
