// app.js
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// AWS SDK clients for DynamoDB and S3
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Secret key for JWT (store securely as environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret';

// ------------------------
// Admin Login Endpoint
// ------------------------
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ------------------------
// JWT Verification Middleware
// ------------------------
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.admin = decoded;
    next();
  });
}

// ------------------------
// Admin Endpoints: Product Management
// ------------------------

// POST: Add a new product
app.post('/admin/product', verifyAdmin, async (req, res) => {
  const { id, name, description, specs, imageKey } = req.body;
  const params = {
    TableName: 'Products',
    Item: { id, name, description, specs, imageKey }
  };
  try {
    await dynamoDB.put(params).promise();
    res.json({ message: 'Product added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Update an existing product
app.put('/admin/product/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, specs, imageKey } = req.body;
  const params = {
    TableName: 'Products',
    Key: { id },
    UpdateExpression: 'set #n = :n, description = :d, specs = :s, imageKey = :i',
    ExpressionAttributeNames: { '#n': 'name' },
    ExpressionAttributeValues: {
      ':n': name,
      ':d': description,
      ':s': specs,
      ':i': imageKey
    },
    ReturnValues: 'UPDATED_NEW'
  };
  try {
    const result = await dynamoDB.update(params).promise();
    res.json({ message: 'Product updated', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Remove a product
app.delete('/admin/product/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const params = {
    TableName: 'Products',
    Key: { id }
  };
  try {
    await dynamoDB.delete(params).promise();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Admin Endpoint: Parent (Company) Data Management
// ------------------------
// PUT: Update Parent Data (Company Info)
app.put('/admin/parent', verifyAdmin, async (req, res) => {
  // Expect a payload with company data; partition key is 'company'
  const { company, locations, hours, about } = req.body;
  const params = {
    TableName: 'CompanyInfo',
    Key: { id: 'company' },
    UpdateExpression: 'set company = :c, locations = :l, hours = :h, about = :a',
    ExpressionAttributeValues: {
      ':c': company,
      ':l': locations,
      ':h': hours,
      ':a': about
    },
    ReturnValues: 'UPDATED_NEW'
  };
  try {
    const result = await dynamoDB.update(params).promise();
    res.json({ message: 'Company info updated', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// User Chat Endpoint
// ------------------------
app.get('/user/chat', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Missing query parameter" });
  const lowerQuery = query.toLowerCase().trim();

  // Short query guard.
  if (lowerQuery.length < 3 && lowerQuery!="no") {
    return res.json({ answer: "Could you please provide more details?", final: false });
  }

  // Greeting.
  if (["start", "hi", "hello"].includes(lowerQuery)) {
    return res.json({ answer: "Hi! How can I help you today?", final: false });
  }

  // Termination: require exact match.
  const terminationPhrases = ["thank you", "got it", "no thank you", "that's all", "no","thanks","thankyou"];
  const isFinal = terminationPhrases.some(phrase => lowerQuery === phrase);
  if (isFinal) {
    return res.json({ answer: "Thank you for chatting with ABC Lighting Corp. Please provide your name and email so we can save your chat history.", final: true });
  }

  try {
    // Check if query is about company (parent) info.
    if (lowerQuery.includes("location") || lowerQuery.includes("branch") ||
        lowerQuery.includes("hour") || lowerQuery.includes("address") || lowerQuery.includes("company")) {
      const parentData = await dynamoDB.get({ TableName: 'CompanyInfo', Key: { id: 'company' } }).promise();
      // Also fetch all available products.
      const productData = await dynamoDB.scan({ TableName: 'Products' }).promise();
      if (parentData.Item) {
        return res.json({
          company: parentData.Item.company,
          locations: parentData.Item.locations,
          hours: parentData.Item.hours,
          about: parentData.Item.about,
          products: productData.Items, // list all available products.
          endingNote: "Is there anything else I can help you with?",
          final: false
        });
      }
    }

    // Otherwise, treat as product query.
    const data = await dynamoDB.scan({ TableName: 'Products' }).promise();
    const products = data.Items;
    const queryWords = lowerQuery.split(/\s+/);

    // Flexible matching: return first product if any query word is found.
    const matchingProduct = products.find(product => {
      const combinedText = `${product.name} ${product.description} ${JSON.stringify(product.specs)}`.toLowerCase();
      return queryWords.some(word => combinedText.includes(word));
    });

    if (matchingProduct) {
      // Determine if the user explicitly requests an image.
      const wantsImage = lowerQuery.includes("photo") || lowerQuery.includes("image") || lowerQuery.includes("show")|| lowerQuery.includes("images")|| lowerQuery.includes("photos")|| lowerQuery.includes("pics")|| lowerQuery.includes("pic");
      // Always return the imageKey in the response, so the client has context.
      const response = {
        name: matchingProduct.name,
        description: matchingProduct.description,
        specs: matchingProduct.specs,
        imageKey: matchingProduct.imageKey,
        endingNote: "Is there anything else I can help you with?",
        final: false
      };
      // If the user explicitly requested an image, include a signed URL.
      if (wantsImage && matchingProduct.imageKey) {
        response.imageUrl = s3.getSignedUrl('getObject', {
          Bucket: 'abc-lighting-assets',
          Key: matchingProduct.imageKey,
          Expires: 3600
        });
      }
      return res.json(response);
    } else {
      return res.json({
        answer: "I'm sorry, I couldn't find product details related to your query.",
        endingNote: "Is there anything else I can help you with?",
        final: false
      });
    }
  } catch (error) {
    console.error("Error fetching product or parent data:", error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Chat History Save Endpoint
// ------------------------
app.post('/user/chat/save', async (req, res) => {
  const { user, messages } = req.body;
  if (!user || !messages) return res.status(400).json({ error: "Missing user or messages payload" });
  const chatId = crypto.randomBytes(16).toString('hex');
  const params = {
    TableName: 'ChatHistory',
    Item: {
      chatId,
      user,
      messages,
      timestamp: new Date().toISOString()
    }
  };

  try {
    await dynamoDB.put(params).promise();
    res.json({ message: "Chat history saved successfully", chatId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// S3 Signed URL Endpoint for Images
// ------------------------
app.get('/user/image', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "Missing image key" });
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: 'abc-lighting-assets',
      Key: key,
      Expires: 3600 // Valid for 1 hour
    });
    res.json({ imageUrl: url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
