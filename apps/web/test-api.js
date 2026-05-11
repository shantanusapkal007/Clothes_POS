const body = {
  "name": "Test",
  "price": 10,
  "costPrice": 5,
  "stock": 10,
  "minStock": 2,
  "barcode": "",
  "category": "Tops",
  "discountPercent": 0,
  "taxPercent": 5
};

fetch('http://localhost:3001/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
})
.then(r => Promise.all([r.status, r.json()]))
.catch(console.error);
