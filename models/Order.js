const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { 
    type: String, 
    required: [true, 'Customer name is required'] 
  },
  phoneNumber: { 
    type: String, 
    required: [true, 'Phone number is required'] 
  },
  address: { 
    type: String, 
    required: [true, 'Address is required'] 
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  items: [{
    product: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    image: String
  }],
  totalAmount: { 
    type: Number, 
    required: [true, 'Total amount is required'] 
  },
  paymentMethod: { 
    type: String, 
    enum: ['cash_on_delivery', 'online'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  orderNumber: { 
    type: String, 
    unique: true,
    required: true 
  },
  orderDate: { 
    type: Date, 
    default: Date.now 
  },
  notes: String,
  assignedDriver: String,
  estimatedDelivery: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);