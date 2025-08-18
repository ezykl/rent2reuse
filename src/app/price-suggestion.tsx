import { useState } from "react";
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";

export default function PriceSuggestion() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [itemCondition, setItemCondition] = useState("");

  const getPriceSuggestion = async () => {
    // Validate inputs
    if (!itemName.trim() || !itemCondition.trim()) {
      Alert.alert("Error", "Please fill in both item name and condition");
      return;
    }

    setLoading(true);
    setResult(null); // Clear previous results

    try {
      const response = await fetch("http://192.168.100.20:11500/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-r1:latest", // your model name
          prompt: `You are a rental pricing assistant.
          Item Name: ${itemName.trim()}
          Item Condition: ${itemCondition.trim()}
          
          Return the result strictly in JSON with the following structure:
          {
            "price_per_day": "<suggested price in PHP>",
            "template": {
              "fields": ["field1", "field2", "field3"]
            }
          }`,
          stream: false, // disable streaming for easier parsing
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // The response is in { response: "..."} format
      const parsed = JSON.parse(data.response);
      setResult(parsed);
    } catch (error) {
      console.error("Error fetching suggestion:", error);
      Alert.alert("Error", "Failed to get price suggestion. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="bg-white pt-10"
      contentContainerStyle={{ flexGrow: 1, padding: 20 }}
    >
      <View className="flex-1 justify-start">
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 30,
            color: "#333",
          }}
        >
          🏷️ Rental Price Suggestion
        </Text>

        {/* Input Fields */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              marginBottom: 8,
              color: "#555",
            }}
          >
            Item Name
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              backgroundColor: "#f9f9f9",
            }}
            placeholder="e.g., Laptop, Camera, Power Tool"
            value={itemName}
            onChangeText={setItemName}
            editable={!loading}
          />
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              marginBottom: 8,
              color: "#555",
            }}
          >
            Item Condition
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              backgroundColor: "#f9f9f9",
              minHeight: 80,
            }}
            placeholder="e.g., Brand new, Used - good condition, Some wear but functional"
            value={itemCondition}
            onChangeText={setItemCondition}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </View>

        {/* Get Suggestion Button */}
        <View style={{ marginBottom: 20 }}>
          <Button
            title={loading ? "Getting Suggestion..." : "Get Price Suggestion"}
            onPress={getPriceSuggestion}
            disabled={loading}
          />
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 10, color: "#666" }}>
              Analyzing your item...
            </Text>
          </View>
        )}

        {/* Results Display */}
        {result && (
          <View
            style={{
              backgroundColor: "#f0f8ff",
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: "#e0e0e0",
              marginTop: 10,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                marginBottom: 15,
                textAlign: "center",
                color: "#333",
              }}
            >
              📊 Pricing Results
            </Text>

            {/* Price Display */}
            <View
              style={{
                backgroundColor: "#e8f5e8",
                borderRadius: 8,
                padding: 15,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "#c8e6c9",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#2e7d32",
                  textAlign: "center",
                }}
              >
                💰 Suggested Price: {result.price_per_day}
              </Text>
            </View>

            {/* Item Details */}
            <View
              style={{
                backgroundColor: "#fff3e0",
                borderRadius: 8,
                padding: 15,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: "#ffcc02",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 8,
                  color: "#f57c00",
                }}
              >
                📝 Item Details:
              </Text>
              <Text style={{ fontSize: 14, color: "#333", marginBottom: 4 }}>
                • Name: {itemName}
              </Text>
              <Text style={{ fontSize: 14, color: "#333" }}>
                • Condition: {itemCondition}
              </Text>
            </View>

            {/* Template Fields */}
            {result.template && result.template.fields && (
              <View
                style={{
                  backgroundColor: "#fce4ec",
                  borderRadius: 8,
                  padding: 15,
                  borderWidth: 1,
                  borderColor: "#f8bbd9",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 10,
                    color: "#c2185b",
                  }}
                >
                  📋 Suggested Template Fields:
                </Text>
                {result.template.fields.map((field: string, index: number) => (
                  <Text
                    key={index}
                    style={{
                      fontSize: 14,
                      color: "#333",
                      marginBottom: 4,
                      paddingLeft: 10,
                    }}
                  >
                    • {field}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
