// user.js
const apiUrl = 'https://5x5cwti8og.execute-api.us-east-1.amazonaws.com';


let fullChatHistory = [];

// Global variable to store the last matched product (context).
let lastProduct = null;

// Function to append a message (string or DOM element) to the chat window.
function addMessage(message) {
  const chatWindow = document.getElementById('chatWindow');
  const div = document.createElement('div');
  if (typeof message === 'string') {
    div.textContent = message;
  } else {
    div.appendChild(message);
  }
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (typeof message === 'string') {
    fullChatHistory.push(message);
  }
}

// Helper function to decide if a query is intended to request an image.
function isImageRequest(queryStr) {
  const lower = queryStr.toLowerCase();
  return lower.includes("image") || lower.includes("photo") || lower.includes("show");
}

// Send a message and handle bot response.
document.getElementById('sendBtn').addEventListener('click', async () => {
  const inputField = document.getElementById('userInput');
  const userInput = inputField.value.trim();
  if (!userInput) return;
  
  const lowerInput = userInput.toLowerCase();
  addMessage(`🦸User: ${userInput}`);
  inputField.value = '';

  // Check if the input is an image request and if we already have context.
  if (isImageRequest(lowerInput) && lastProduct && lastProduct.imageKey) {
    try {
      // Request the signed URL using the imageKey.
      const imgRes = await fetch(`${apiUrl}/user/image?key=${encodeURIComponent(lastProduct.imageKey)}`);
      const imgData = await imgRes.json();
      if (imgData.imageUrl) {
        const img = document.createElement('img');
        img.src = imgData.imageUrl;
        img.alt = 'Product Image';
        img.style.maxWidth = '300px';
        img.style.marginTop = '10px';
        addMessage(img);
        addMessage("🤖Bot: Is there anything else I can help you with?");
        return;
      } else {
        addMessage("🤖Bot: I'm sorry, I couldn't retrieve the product image.");
        addMessage("🤖Bot: Is there anything else I can help you with?");
        return;
      }
    } catch (error) {
      console.error('Error fetching image:', error);
      addMessage("🤖Bot: There was an error retrieving the image.");
      addMessage("🤖Bot: Is there anything else I can help you with?");
      return;
    }
  }

  try {
    const res = await fetch(`${apiUrl}/user/chat?query=${encodeURIComponent(userInput)}`);
    const data = await res.json();

    // If parent (company) data is returned.
    if (data.company) {
      addMessage(`🤖Bot: Company: ${data.company}`);
      addMessage(`📍Locations: ${Array.isArray(data.locations) ? data.locations.join(', ') : data.locations}`);
      addMessage(`⏰Hours: ${data.hours}`);
      addMessage(`📝About: ${data.about}`);
      if (Array.isArray(data.products) && data.products.length > 0) {
        addMessage("🤖Bot: Our available products are:");
        data.products.forEach(product => {
          addMessage(`• ${product.name} - ${product.description}`);
        });
      }
      if (data.endingNote) addMessage(`🤖Bot: ${data.endingNote}`);
      // Clear stored product context.
      lastProduct = null;
    }
    // If product data is returned.
    else if (data.name) {
      addMessage(`🤖Bot: We have ${data.name}`);
      addMessage(`📝Description: ${data.description}`);
      addMessage(`📊Specs: ${JSON.stringify(data.specs)}`);
      // If an image URL is provided, show it.
      if (data.imageUrl) {
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.alt = 'Product Image';
        img.style.maxWidth = '300px';
        img.style.marginTop = '10px';
        addMessage(img);
      }
      if (data.endingNote) addMessage(`🤖Bot: ${data.endingNote}`);
      // Store the product context (including imageKey) for potential follow-up.
      lastProduct = data;
    }
    // Fallback for no matching data.
    else {
      if (data.answer) addMessage(`🤖Bot: ${data.answer}`);
      if (data.endingNote) addMessage(`🤖Bot: ${data.endingNote}`);
      lastProduct = null;
    }

    // If conversation is ending, show the contact info form.
    if (data.final) {
      document.getElementById('userInfo').style.display = 'block';
      lastProduct = null;
    }
  } catch (err) {
    console.error('Chat error:', err);
  }
});

// Save Chat History with user details.
document.getElementById('saveChatBtn').addEventListener('click', async () => {
  const userName = document.getElementById('userName').value.trim();
  const userEmail = document.getElementById('userEmail').value.trim();
  if (!userName || !userEmail) {
    alert("Please enter both name and email.");
    return;
  }

  const messagesStructured = fullChatHistory.map(msg => {
    const splitMsg = msg.split(": ");
    return { role: splitMsg[0].toLowerCase(), content: splitMsg.slice(1).join(": ") };
  });

  try {
    const res = await fetch(`${apiUrl}/user/chat/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { name: userName, email: userEmail },
        messages: messagesStructured
      })
    });
    const data = await res.json();
    alert(data.message);
    fullChatHistory = [];
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('chatWindow').innerHTML = '';
    lastProduct = null;
  } catch (err) {
    console.error('Error saving chat:', err);
  }
});

window.addEventListener('load', () => {
  addMessage("🤖Bot: Hi! How can I help you?");
});
