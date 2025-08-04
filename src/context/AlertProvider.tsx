import { AlertNotificationRoot } from "react-native-alert-notification";

export const AlertProvider = ({ children }) => {
  return (
    <AlertNotificationRoot theme="light">{children}</AlertNotificationRoot>
  );
};
