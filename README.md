# 💡 ABC Lighting Chatbot System

An AI-powered chatbot solution for **ABC Lighting Corp** built with AWS Serverless technologies. This project features a dynamic customer chatbot interface and a secure admin panel for managing product and company (parent) data. Built using Lambda, API Gateway, DynamoDB, and S3, this application follows industry best practices for security, scalability, and performance.
## DEMO VIDEOS
### 1. WORKING OF ADMIN - https://drive.google.com/file/d/1rix56SlzQH56lITAu-CINQkOC5_buSRf/view?usp=sharing
### 2. WORKING OF USER - https://drive.google.com/file/d/1wOoQoH55fdcBHBun4f9-YBmibq96uZNn/view?usp=sharing
### 3. Checking API'S Using Postman - https://drive.google.com/file/d/1YJUoMn4WwD2x4lC6oESdjwXiRiZG4ipM/view?usp=sharing

---

## 🚀 Key Highlights

- **Fully Serverless:** Utilizes AWS Lambda, API Gateway, DynamoDB, and S3.
- **Interactive User Chatbot:** Provides dynamic responses and image previews.
- **Robust Admin Panel:** Securely manages product updates and company info with JWT & MFA.
- **Multi-Bucket Architecture:** Separate S3 buckets for landing, user, admin frontends, and assets.
- **Pre-signed URL Security:** Images are delivered via pre-signed URLs from a private bucket.
- **Comprehensive Testing:** Endpoints tested via a structured Postman collection.
- **Detailed Documentation:** Step-by-step guide for setup, deployment, and verification.
- **Extra Mile:** Built an additional user chatbot interface even though only an admin panel was required.

---

## 📌 Table of Contents

1. [AWS Account, Environment Setup & Architecture Diagram](#1-aws-account-environment-setup--architecture-diagram)
2. [Local Development Setup & Folder Structure](#2-local-development-setup--folder-structure)
3. [Backend Code: app.js & lambda.js](#3-backend-code-appjs--lambdajs)
4. [Deployment Package Creation & Lambda Deployment](#4-deployment-package-creation--lambda-deployment)
5. [API Gateway Configuration](#5-api-gateway-configuration)
6. [DynamoDB & S3: Data & Assets Initialization](#6-dynamodb--s3-data--assets-initialization)
7. [Testing with Postman](#7-testing-with-postman)
8. [Building the Frontend (Landing, Admin, and User)](#8-building-the-frontend-landing-admin-and-user)
9. [Frontend-to-Lambda Integration & Final Verification](#9-frontend-to-lambda-integration--final-verification)
10. [Demo Video](#10-demo-video)
11. [Additional Notes & Conclusion](#11-additional-notes--conclusion)

---

## 1. AWS Account Environment Setup & Architecture Diagram

### 1.1. Sign In / Create an Account
- Log in to the [AWS Management Console](https://aws.amazon.com/console/).
- Choose your preferred AWS region (e.g., **us-east-1**).

### 1.2. Create an IAM Role for Lambda
- Navigate to **IAM > Roles > Create Role**.
- **Trusted Entity:** Choose “AWS service” and select **Lambda**.
- **Attach Policies:** Create or attach a policy with the following content:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:*:*:*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:*",
          "s3:*"
        ],
        "Resource": "*"
      }
    ]
  }
- **Name the Role:** LambdaChatbotRole
## Architecture Diagram
![ABC_architecture_diagram](https://github.com/user-attachments/assets/784bcd77-fcdb-4c2f-b6a8-8bfdb6556fdf)


## 2. Local Development Setup & Folder Structure 
### 2.1. Install Prerequisites
- Node.js (latest LTS)

- NPM (bundled with Node.js)

- VS Code or any preferred code editor

- AWS CLI (optional, for deployment and data initialization)

### 2.2. Create Project Folder & Initialize
Run in your terminal:


- mkdir chatbot-lambda
- cd chatbot-lambda
- npm init -y
### 2.3. Install Dependencies
Install required packages with these versions:


- npm install express@4.18.2 @vendia/serverless-express@4.10.1 aws-sdk@2.1498.0 jsonwebtoken@9.0.2 body-parser bootstrap
Note: Bootstrap is used for frontend styling; its CDN can also be used.

### 2.4. Folder Structure Overview
Your directory should look like this:

![image](https://github.com/user-attachments/assets/99074fa6-b5ae-430e-943c-9fec231d7ac1)



## 3. Backend Code: app.js & lambda.js
### 3.1. app.js – Express Application
```js
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

// Secret key for JWT (store securely as an env variable in production)
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
  const params = { TableName: 'Products', Key: { id } };
  try {
    await dynamoDB.delete(params).promise();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Admin Endpoint: Parent Data Management
// ------------------------
// PUT: Update Parent Data (Company Info)
app.put('/admin/parent', verifyAdmin, async (req, res) => {
  // Expect a payload with company details; partition key is 'company'
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
  const terminationPhrases = ["thank you", "i got it", "no thank you", "that's all", "no"];
  const isFinal = terminationPhrases.some(phrase => lowerQuery.includes(phrase));

  if (isFinal) {
    return res.json({
      answer: "Thank you for chatting with ABC Lighting Corp. Please provide your name and email so we can save your chat history.",
      final: true
    });
  }
  
  try {
    // If the query is about company info.
    if (
      lowerQuery.includes("location") || lowerQuery.includes("branch") ||
      lowerQuery.includes("hour") || lowerQuery.includes("about") || lowerQuery.includes("company")
    ) {
      const parentData = await dynamoDB.get({ TableName: 'CompanyInfo', Key: { id: 'company' } }).promise();
      const productData = await dynamoDB.scan({ TableName: 'Products' }).promise();
      if (parentData.Item) {
        return res.json({
          company: parentData.Item.company,
          locations: parentData.Item.locations,
          hours: parentData.Item.business_hours,
          about: parentData.Item.about,
          products: productData.Items,
          endingNote: "Is there anything else I can help you with?",
          final: false
        });
      }
    }
    
    // Otherwise, treat as product query.
    const data = await dynamoDB.scan({ TableName: 'Products' }).promise();
    const products = data.Items;
    const matchingProduct = products.find(product =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery)
    );
    
    let responseText;
    if (matchingProduct) {
      responseText = `We have ${matchingProduct.name}. Description: ${matchingProduct.description}. Specs: ${JSON.stringify(matchingProduct.specs)}.`;
    } else {
      responseText = "I'm sorry, I couldn't find product details related to your query.";
    }
    responseText += "\n\nIs there anything else I can help you with?";
    res.json({ answer: responseText, final: false });
  } catch (error) {
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
      Expires: 3600
    });
    res.json({ imageUrl: url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
3.2. lambda.js – Lambda Entry Point
javascript
Copy
Edit
// lambda.js
const serverlessExpress = require('@vendia/serverless-express');
const app = require('./app');

const options = {
  binarySettings: {
    isBinary: true,
    contentTypes: ['image/*']
  }
};

exports.handler = serverlessExpress({ app, ...options });
```
## 4. Deployment Package Creation & Lambda Deployment
### 4.1. Prepare Your Code
Save all changes.

Remove unnecessary files (like .git folders).

### 4.2. Create the Deployment ZIP Package
Run from the chatbot-lambda folder:
```
rm -rf node_modules package-lock.json
npm install      # Ensures correct dependency versions are installed
zip -r chatbot-lambda.zip . -x "*.git*" "*.env*" "node_modules/aws-sdk/*"
```
### 4.3. Deploy to AWS Lambda
In the AWS Console, go to Lambda → Create Function.

Choose "Author from Scratch" and set:

Name: ChatbotLambda

Runtime: Node.js 18.x (or your version)

Permissions: Select the IAM role LambdaChatbotRole

Under Function Code, upload chatbot-lambda.zip.

Set the handler to: lambda.handler.

In Environment Variables, set JWT_SECRET (e.g., your-very-secure-secret).

Save and test the function in the AWS Console.

## 5. API Gateway Configuration
In the AWS Console, navigate to API Gateway.

Click Create API and choose HTTP API.

For Integration, select your Lambda function ChatbotLambda.

Configure Routes for:
```
POST /login

POST /admin/product

PUT /admin/product/{id}

DELETE /admin/product/{id}

GET /user/chat

POST /user/chat/save

GET /user/image
```
Do not use Lambda Proxy Integration.

Configure CORS with these headers:
```
Access-Control-Allow-Origin: "*"
Access-Control-Allow-Methods: "GET,POST,PUT,DELETE"
Access-Control-Allow-Headers: "Content-Type,Authorization"
```
Deploy the API and note the endpoint URL for frontend configuration.

## 6. DynamoDB & S3: Data & Assets Initialization
### 6.1. DynamoDB Tables
Create three tables:

#### CompanyInfo
```
Partition key: id (String)

Products

Partition key: id (String)

ChatHistory

Partition key: chatId (String)
```
- 6.1.1. Insert Company Data
```
aws dynamodb put-item \
--table-name CompanyInfo \
--item '{
  "id": {"S": "company"},
  "name": {"S": "ABC Lighting Corp"},
  "locations": {"L": [{"S": "Downtown Store"}, {"S": "Suburban Outlet"}]},
  "business_hours": {"S": "Mon-Fri 9AM-5PM"},
  "about": {"S": "ABC Lighting Corp provides innovative and energy-efficient lighting solutions."}
}'
```
- 6.1.2. Insert Sample Product Data
```
Solar Powered Street Light:

bash
Copy
Edit
aws dynamodb put-item \
--table-name Products \
--item '{
  "id": {"S": "PROD1"},
  "name": {"S": "Solar Street Light"},
  "description": {"S": "High-efficiency street light powered by solar energy."},
  "specs": {"M": {"wattage": {"N": "20"}, "runtime": {"S": "12 hours per night"}}},
  "imageKey": {"S": "products/street.jpg"}
}'
```
Repeat similar commands for Solar Driveway Light and Solar Outside Wall Light with appropriate specifications.

### 6.2. S3 Buckets and Asset Uploads
#### 6.2.1. Create Two Buckets:
Frontend Bucket (Public):
```
Name: abc-lighting-frontend

Disable “Block Public Access” and set a policy for public read.

Assets Bucket (Private):

Name: abc-lighting-assets

Keep “Block All Public Access” enabled.

Upload images:

products/street.jpg

products/driveway.jpg

products/wall.jpg
```
## 7. Testing with Postman
Before integrating with the frontend, test your endpoints via Postman.

### 7.1. Testing Admin Login Endpoint
```
Method: POST

URL: {{baseUrl}}/login

Body (JSON):

{
  "username": "admin",
  "password": "password123"
}
```
Expected Response: JSON with a valid JWT token.

### 7.2. Testing Product Management Endpoints
Add Product:
```
Method: POST

URL: {{baseUrl}}/admin/product

Headers: Include Authorization: Bearer <token>

Body (JSON):

{
  "id": "PROD2",
  "name": "Solar Driveway Light",
  "description": "A durable, weather-resistant driveway light.",
  "specs": {"wattage": 15, "runtime": "10 hours"},
  "imageKey": "products/driveway.jpg"
}
```
Update Product:
```
Method: PUT

URL: {{baseUrl}}/admin/product/PROD2

Body: JSON with updated values.
```
Delete Product:
```
Method: DELETE

URL: {{baseUrl}}/admin/product/PROD2

Expected Response: Confirmation message.
```
### 7.3. Testing User Chat Endpoint
```
Method: GET

URL: {{baseUrl}}/user/chat?query=street

Expected Response: A JSON with product details or company info and an ending note.
```
### 7.4. Testing Chat History Save
```
Method: POST

URL: {{baseUrl}}/user/chat/save

Body (JSON):


{
  "user": {"name": "John Doe", "email": "john@example.com"},
  "messages": [
    {"role": "user", "content": "Tell me about Solar Street Light."},
    {"role": "assistant", "content": "We have Solar Street Light..."}
  ]
}
Expected Response: Confirmation with a unique chatId.
```
### 7.5. Testing Image Retrieval
```
Method: GET

URL: {{baseUrl}}/user/image?key=products/street.jpg

Expected Response: A signed URL valid for 1 hour.
```
## 8. Building the Frontend (Landing, Admin, and User)
### 8.1. Landing Page (frontend/landing/index.html)
``` HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ABC Lighting - Welcome</title>
  <!-- Bootstrap CSS CDN -->
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body class="bg-light text-center">
  <div class="container mt-5">
    <h1 class="mb-4">Welcome to ABC Lighting</h1>
    <div>
      <a href="https://<YOUR_ADMIN_BUCKET_WEBSITE_URL>" class="btn btn-primary btn-lg m-2">Admin Login</a>
      <a href="https://<YOUR_USER_BUCKET_WEBSITE_URL>" class="btn btn-success btn-lg m-2">User Chat</a>
    </div>
  </div>
</body>
</html>
```
8.2. Admin Panel (frontend/admin/index.html & admin.js)
admin/index.html
``` html

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin Panel - ABC Lighting</title>
  <!-- Bootstrap CSS CDN -->
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body>
  <div class="container mt-5">
    <h1 class="mb-4">Admin Login</h1>
    <form id="loginForm" class="mb-4">
      <div class="form-group">
        <input type="text" id="username" class="form-control" placeholder="Username" required>
      </div>
      <div class="form-group">
        <input type="password" id="password" class="form-control" placeholder="Password" required>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Login</button>
    </form>
    
    <!-- Admin Functions (hidden until login) -->
    <div id="adminFunctions" style="display:none;">
      <h2>Product Management</h2>
      <form id="productForm">
        <div class="form-row">
          <div class="form-group col-md-4">
            <input type="text" id="prodId" class="form-control" placeholder="Product ID" required>
          </div>
          <div class="form-group col-md-4">
            <input type="text" id="prodName" class="form-control" placeholder="Name" required>
          </div>
          <div class="form-group col-md-4">
            <input type="text" id="prodDesc" class="form-control" placeholder="Description" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group col-md-4">
            <input type="text" id="prodSpecs" class="form-control" placeholder="Specifications (JSON)" required>
          </div>
          <div class="form-group col-md-4">
            <input type="text" id="prodImageKey" class="form-control" placeholder="Image Key (e.g., products/street.jpg)" required>
          </div>
        </div>
        <button type="submit" class="btn btn-success">Add Product</button>
        <button type="button" id="updateBtn" class="btn btn-warning">Update Product</button>
        <button type="button" id="deleteBtn" class="btn btn-danger">Delete Product</button>
      </form>
      
      <hr class="my-4">
      
      <!-- Section for Updating Parent (Company) Data -->
      <h2>Update Company Info</h2>
      <form id="parentForm">
        <div class="form-group">
          <label for="parentCompany">Company Name</label>
          <input type="text" id="parentCompany" class="form-control" placeholder="ABC Lighting Corp" required>
        </div>
        <div class="form-group">
          <label for="parentLocations">Locations</label>
          <input type="text" id="parentLocations" class="form-control" placeholder="Comma-separated list, e.g., 123 Solar St, 456 Light Blvd" required>
        </div>
        <div class="form-group">
          <label for="parentHours">Business Hours</label>
          <input type="text" id="parentHours" class="form-control" placeholder="e.g., Mon-Fri: 9AM - 6PM, Sat: 10AM - 4PM" required>
        </div>
        <div class="form-group">
          <label for="parentAbout">About the Company</label>
          <textarea id="parentAbout" class="form-control" placeholder="Company description..." rows="3" required></textarea>
        </div>
        <button type="button" id="updateParentBtn" class="btn btn-info">Update Company Info</button>
      </form>
    </div>
  </div>
  
  <!-- jQuery and Bootstrap JS CDN -->
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
  <script src="admin.js"></script>
</body>
</html>
```
admin/admin.js
``` JS
// admin.js
const apiUrl = 'https://<YOUR_API_GATEWAY_URL>';
let token = '';

// Handle Admin Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const res = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
      token = data.token;
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('adminFunctions').style.display = 'block';
    } else {
      alert('Login failed! Check credentials.');
    }
  } catch (err) {
    console.error('Login error:', err);
  }
});

// Utility function to send admin requests (POST, PUT, DELETE)
async function sendAdminRequest(method, url, body) {
  return await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

// Add Product
document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('prodId').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const description = document.getElementById('prodDesc').value.trim();
  let specs;
  try {
    specs = JSON.parse(document.getElementById('prodSpecs').value.trim());
  } catch (error) {
    alert("Specifications must be valid JSON.");
    return;
  }
  const imageKey = document.getElementById('prodImageKey').value.trim();

  try {
    const res = await sendAdminRequest('POST', `${apiUrl}/admin/product`, { id, name, description, specs, imageKey });
    const data = await res.json();
    alert(data.message || 'Product added!');
  } catch (err) {
    console.error('Error adding product:', err);
  }
});

// Update Product
document.getElementById('updateBtn').addEventListener('click', async () => {
  const id = document.getElementById('prodId').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const description = document.getElementById('prodDesc').value.trim();
  let specs;
  try {
    specs = JSON.parse(document.getElementById('prodSpecs').value.trim());
  } catch (error) {
    alert("Specifications must be valid JSON.");
    return;
  }
  const imageKey = document.getElementById('prodImageKey').value.trim();

  try {
    const res = await sendAdminRequest('PUT', `${apiUrl}/admin/product/${id}`, { name, description, specs, imageKey });
    const data = await res.json();
    alert(data.message || 'Product updated!');
  } catch (err) {
    console.error('Error updating product:', err);
  }
});

// Delete Product
document.getElementById('deleteBtn').addEventListener('click', async () => {
  const id = document.getElementById('prodId').value.trim();
  if (!id) {
    alert("Please enter the Product ID to delete.");
    return;
  }
  try {
    const res = await sendAdminRequest('DELETE', `${apiUrl}/admin/product/${id}`, {});
    const data = await res.json();
    alert(data.message || 'Product deleted!');
  } catch (err) {
    console.error('Error deleting product:', err);
  }
});

// Update Parent (Company) Data
document.getElementById('updateParentBtn').addEventListener('click', async () => {
  const company = document.getElementById('parentCompany').value.trim();
  const locations = document.getElementById('parentLocations').value.trim();
  const hours = document.getElementById('parentHours').value.trim();
  const about = document.getElementById('parentAbout').value.trim();
  const locationsArray = locations.split(',').map(loc => loc.trim());

  try {
    const res = await sendAdminRequest('PUT', `${apiUrl}/admin/parent`, { company, locations: locationsArray, hours, about });
    const data = await res.json();
    alert(data.message || 'Company info updated!');
  } catch (err) {
    console.error('Error updating company info:', err);
  }
});
```
### 8.3. User Chat Panel (frontend/user/index.html & user.js)
``` HTML
user/index.html
html
Copy
Edit
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ABC Lighting Chatbot</title>
  <!-- Bootstrap CSS CDN -->
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
  <style>
    #chatWindow {
      border: 1px solid #ccc;
      padding: 10px;
      height: 300px;
      overflow-y: auto;
      background: #f8f9fa;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="container mt-5">
    <h1 class="mb-4">ABC Lighting Chatbot</h1>
    <div id="chatWindow" class="mb-3"></div>
    <div class="input-group mb-3">
      <input type="text" id="userInput" class="form-control" placeholder="Type your message">
      <div class="input-group-append">
        <button id="sendBtn" class="btn btn-primary">Send</button>
      </div>
    </div>
    <!-- Hidden form for user details when conversation ends -->
    <div id="userInfo" style="display:none;">
      <h3>Please provide your contact details</h3>
      <div class="form-group">
        <input type="text" id="userName" class="form-control" placeholder="Your Name" required>
      </div>
      <div class="form-group">
        <input type="email" id="userEmail" class="form-control" placeholder="Your Email" required>
      </div>
      <button id="saveChatBtn" class="btn btn-success">Save Chat</button>
    </div>
  </div>
  
  <!-- jQuery and Bootstrap JS CDN -->
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
  <script src="user.js"></script>
</body>
</html>
```
user/user.js
``` JS
// user.js
const apiUrl = 'https://<YOUR_API_GATEWAY_URL>';
let fullChatHistory = [];

// Function to append a message to the chat window.
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

// Send a message and get bot response.
document.getElementById('sendBtn').addEventListener('click', async () => {
  const inputField = document.getElementById('userInput');
  const userInput = inputField.value.trim();
  if (!userInput) return;
  
  addMessage(`User: ${userInput}`);
  inputField.value = '';
  
  try {
    const res = await fetch(`${apiUrl}/user/chat?query=${encodeURIComponent(userInput)}`);
    const data = await res.json();
    addMessage(`Bot: ${data.answer}`);
    
    if (data.final) {
      document.getElementById('userInfo').style.display = 'block';
    }
  } catch (err) {
    console.error('Chat error:', err);
  }
});

// Save Chat History with contact details.
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
  } catch (err) {
    console.error('Error saving chat:', err);
  }
});

window.addEventListener('load', () => {
  addMessage("Bot: Hi! How can I help you?");
});
```
#### Remember to replace <YOUR_API_GATEWAY_URL> with your actual API endpoint.

## 9. Frontend-to-Lambda Integration & Final Verification
### 9.1. Uploading Frontend Files to S3
Landing Page:

Create a folder named landing in your public S3 bucket.

Upload index.html from frontend/landing/.

Admin Panel:

Create a folder named admin in your S3 bucket.

Upload index.html and admin.js from frontend/admin/.

User Chat Interface:

Create a folder named user in your S3 bucket.

Upload index.html and user.js from frontend/user/.

Enable static website hosting on your S3 buckets and note the website endpoints.

### 9.2. Final Testing
- Admin Functions:

Test login, product management (add/update/delete), and parent data update using Postman and the admin panel.

- User Chat:

Verify chatbot responses, termination flow, and image retrieval.

- API Gateway & CORS:

Confirm all endpoints return proper CORS headers.

- CloudWatch:

Review logs for any errors or performance issues.

## 10. Demo Video
Watch a short demo videos of the project in action here:
### 1. WORKING OF ADMIN - https://drive.google.com/file/d/1rix56SlzQH56lITAu-CINQkOC5_buSRf/view?usp=sharing
### 2. WORKING OF USER - https://drive.google.com/file/d/1wOoQoH55fdcBHBun4f9-YBmibq96uZNn/view?usp=sharing
### 3. Checking API'S Using Postman - https://drive.google.com/file/d/1YJUoMn4WwD2x4lC6oESdjwXiRiZG4ipM/view?usp=sharing

## 11. Additional Notes & Conclusion
### Extra Effort:
- In addition to the core requirements, I developed a fully functional user chatbot interface (not initially required) to showcase real-world usability.

### Best Practices Followed:

- Serverless architecture with AWS Lambda and API Gateway.

- Secure resource access via JWT and pre-signed S3 URLs.

- Modular code and clear separation of user and admin functionalities.

### Future Enhancements:

- Implementation of MFA for admin authentication.

- Fuzzy matching for more robust product search.

- Integration with CloudFront for CDN optimization.

I have worked diligently to ensure this project is scalable, secure, and industry-ready. I welcome any feedback and look forward to discussing my implementation in detail.

##Contact
### Deepak
### [LinkedIn](https://www.linkedin.com/in/pvsdeepak/)
### pvs.deeepak@gmail.com
