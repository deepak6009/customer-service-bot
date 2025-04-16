const apiUrl = 'https://5x5cwti8og.execute-api.us-east-1.amazonaws.com';
let token = '';

// Handle Admin Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const res = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// ------------------------
// Product Management Functions (unchanged)
// ------------------------

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

// ------------------------
// Parent (Company) Data Update
// ------------------------
// When the admin clicks the "Update Company Info" button, send the updated parent data.
document.getElementById('updateParentBtn').addEventListener('click', async () => {
  const company = document.getElementById('parentCompany').value.trim();
  const locations = document.getElementById('parentLocations').value.trim(); // Expect comma-separated list
  const hours = document.getElementById('parentHours').value.trim();
  const about = document.getElementById('parentAbout').value.trim();

  // Convert locations string to an array.
  const locationsArray = locations.split(',').map(loc => loc.trim());

  try {
    const res = await sendAdminRequest('PUT', `${apiUrl}/admin/parent`, { company, locations: locationsArray, hours, about });
    const data = await res.json();
    alert(data.message || 'Company info updated!');
  } catch (err) {
    console.error('Error updating company info:', err);
  }
});
