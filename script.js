
/* ==========================================
   L'ORÉAL AI BEAUTY ASSISTANT
   Project 8 - Chatbot with LevelUps
========================================== */

// Cloudflare Worker endpoint.
// The OpenAI API key is stored securely in Cloudflare.
const WORKER_URL =
  "https://loreal-beauty-chatbot.fperezrugama.workers.dev/";

/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// LevelUp 1: Store conversation history.
// This allows the assistant to remember earlier messages.
const conversationHistory = [];

// Limit the number of messages sent to the API.
// This matches the limit configured in our Worker.
const MAX_HISTORY = 20;

// Prevent multiple requests from being sent at once.
let isLoading = false;

// Keep the stored conversation within the Worker's message limit.
function trimConversationHistory() {
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory.splice(
      0,
      conversationHistory.length - MAX_HISTORY
    );
  }
}

/* ==========================================
   DISPLAY CHAT MESSAGES
========================================== */

// Create a message bubble for the user or assistant.
function addMessage(message, sender) {
  const messageElement = document.createElement("div");

  messageElement.classList.add("msg", sender);

  // Use textContent so messages are displayed safely.
  if (sender === "user") {
    const messageLabel = document.createElement("span");
    messageLabel.classList.add("msg-label");
    messageLabel.textContent = "Your question";

    const messageText = document.createElement("span");
    messageText.textContent = message;

    messageElement.append(messageLabel, messageText);
  } else {
    renderAssistantMessage(messageElement, message);
  }

  chatWindow.appendChild(messageElement);

  // Automatically scroll to the newest message.
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageElement;
}

// Add simple Markdown formatting without inserting unsafe HTML.
function addFormattedText(parent, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = document.createElement("strong");
      boldText.textContent = part.slice(2, -2);
      parent.appendChild(boldText);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  });
}

// Turn simple Markdown-style lines into safe paragraph and list elements.
function renderAssistantMessage(container, message) {
  const lines = message.split(/\r?\n/);
  let currentParagraph = null;
  let currentList = null;

  function finishBlocks() {
    currentParagraph = null;
    currentList = null;
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const numberedItem = trimmedLine.match(/^\d+\.\s+(.+)/);
    const bulletItem = trimmedLine.match(/^[-*]\s+(.+)/);

    if (!trimmedLine) {
      finishBlocks();
      return;
    }

    if (numberedItem || bulletItem) {
      const listType = numberedItem ? "ol" : "ul";
      if (!currentList || currentList.tagName.toLowerCase() !== listType) {
        currentList = document.createElement(listType);
        container.appendChild(currentList);
        currentParagraph = null;
      }

      const listItem = document.createElement("li");
      addFormattedText(
        listItem,
        (numberedItem || bulletItem)[1]
      );
      currentList.appendChild(listItem);
      return;
    }

    if (!currentParagraph) {
      currentParagraph = document.createElement("p");
      container.appendChild(currentParagraph);
      currentList = null;
    } else {
      currentParagraph.appendChild(document.createElement("br"));
    }

    addFormattedText(currentParagraph, trimmedLine);
  });
}

/* ==========================================
   INITIAL WELCOME MESSAGE
========================================== */

addMessage(
  "👋 Bonjour! Welcome to L'Oréal Beauty Assistant. " +
  "I'm here to help you discover beauty products, " +
  "skincare routines, makeup, haircare, and fragrances. " +
  "How can I help you today?",
  "ai"
);

/* ==========================================
   SEND MESSAGE TO OPENAI VIA CLOUDFLARE
========================================== */

async function sendMessage(message) {
  if (isLoading) {
    return;
  }

  isLoading = true;
  sendBtn.disabled = true;
  userInput.disabled = true;
  chatWindow.setAttribute("aria-busy", "true");

  // Show the user's message in a chat bubble.
  addMessage(message, "user");

  // Build the request with the current message and previous messages.
  const userMessage = {
    role: "user",
    content: message,
  };
  const messagesForRequest = [...conversationHistory, userMessage];

  // Limit only this request so failed requests do not remove saved history.
  if (messagesForRequest.length > MAX_HISTORY) {
    messagesForRequest.splice(
      0,
      messagesForRequest.length - MAX_HISTORY
    );
  }

  // Show a temporary loading message.
  const loadingMessage = addMessage(
    "L'Oréal Assistant is thinking...",
    "ai"
  );
  loadingMessage.classList.add("loading-message");

  try {
    // Send the conversation to our Cloudflare Worker.
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messagesForRequest,
      }),
    });

    // Read the JSON response.
    const data = await response.json();

    // Check whether the request succeeded.
    if (!response.ok) {
      throw new Error(
        data.error || "Unable to connect to the assistant."
      );
    }

    // Extract the AI response.
    const aiReply = data.choices?.[0]?.message?.content;

    if (!aiReply) {
      throw new Error("The assistant returned an empty response.");
    }

    // Replace the loading message with the formatted AI response.
    loadingMessage.replaceChildren();
    renderAssistantMessage(loadingMessage, aiReply);

    // Save both successful messages in their original order.
    conversationHistory.push(userMessage);
    conversationHistory.push({
      role: "assistant",
      content: aiReply,
    });

    // Keep history within the Worker limit.
    trimConversationHistory();
  } catch (error) {
    console.error("Chatbot error:", error);

    // Display a friendly error message.
    loadingMessage.textContent =
      "Sorry, I'm having trouble connecting right now. " +
      "Please try again in a moment.";
  } finally {
    // Re-enable the input and send button.
    isLoading = false;
    sendBtn.disabled = false;
    userInput.disabled = false;
    chatWindow.setAttribute("aria-busy", "false");

    // Return focus to the input field.
    userInput.focus();

    // Scroll to the latest response.
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

/* ==========================================
   HANDLE FORM SUBMISSION
========================================== */

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Read the message and remove extra spaces.
  const message = userInput.value.trim();

  // Do not send empty messages or duplicate requests.
  if (!message || isLoading) {
    return;
  }

  // Clear the input field.
  userInput.value = "";

  // Send the message to the assistant.
  await sendMessage(message);
});

