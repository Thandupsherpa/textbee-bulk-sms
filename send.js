require("dotenv").config();

const fs = require("fs");

const API_KEY = process.env.TEXTBEE_API_KEY;
const DEVICE_ID = process.env.TEXTBEE_DEVICE_ID;

const API_URL =
  "https://api.textbee.dev/api/v1/gateway/send-bulk-sms";

const SEND_MODE = process.argv.includes("--send");

// Convert Indian phone numbers to international format
function formatPhone(phone) {
  const number = String(phone).trim().replace(/[\s()-]/g, "");

  if (/^\+91\d{10}$/.test(number)) {
    return number;
  }

  if (/^91\d{10}$/.test(number)) {
    return `+${number}`;
  }

  if (/^\d{10}$/.test(number)) {
    return `+91${number}`;
  }

  throw new Error(`Invalid Indian phone number: ${phone}`);
}

async function main() {
  // Check API credentials
  if (!API_KEY || !DEVICE_ID) {
    throw new Error(
      "Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID in .env"
    );
  }

  // Read JSON file
  const file = fs.readFileSync("./messages.json", "utf8");
  const data = JSON.parse(file);

  if (!Array.isArray(data.messages) || data.messages.length === 0) {
    throw new Error("No messages found in messages.json");
  }

  // Validate and prepare messages
  const messages = data.messages.map((item, index) => {
    if (!item.phone || typeof item.message !== "string" ||
        !item.message.trim()) {
      throw new Error(`Invalid phone or message at entry ${index + 1}`);
    }

    return {
      recipients: [formatPhone(item.phone)],
      message: item.message.trim()
    };
  });

  // Check duplicate phone numbers
  const phoneNumbers = messages.map(
    item => item.recipients[0]
  );

  if (new Set(phoneNumbers).size !== phoneNumbers.length) {
    throw new Error("Duplicate phone numbers found in JSON.");
  }

  // Preview messages
  console.log("\n========== SMS PREVIEW ==========");
  console.log(`Total messages: ${messages.length}`);

  messages.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.recipients[0]}`);
    console.log(`Message: ${item.message}`);
  });

  console.log("\n=================================");

  // Do not send unless --send is provided
  if (!SEND_MODE) {
    console.log("\nPREVIEW ONLY — No SMS have been sent.");
    console.log("After checking the messages, run:");
    console.log("node send.js --send");
    return;
  }

  // Send bulk SMS through TextBee
  console.log("\nSubmitting messages to TextBee...");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deviceId: DEVICE_ID,
      messageTemplate: "SPS Ravangla Fee Reminders",
      messages
    })
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `TextBee returned an unexpected response: ${responseText}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `TextBee API error (${response.status}): ${JSON.stringify(result)}`
    );
  }

  console.log("\n========== TEXTBEE RESPONSE ==========");
  console.log(JSON.stringify(result, null, 2));

  const resultData = result.data || {};

  if (resultData.smsBatchId) {
    console.log("\nBatch ID:", resultData.smsBatchId);
    console.log(
      "You can use this ID to check the delivery status of your messages."
    );
  }

  console.log("\nTextBee has responded successfully.");
  console.log("Remember: API acceptance does not guarantee delivery.");
}

main().catch(error => {
  console.error("\nERROR:", error.message);
  process.exitCode = 1;
});