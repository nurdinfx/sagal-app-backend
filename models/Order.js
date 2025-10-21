const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Customer information - make these optional since we support multiple formats
  customerName: { 
    type: String, 
    required: false
  },
  phoneNumber: { 
    type: String, 
    required: false
  },
  address: { 
    type: String, 
    required: false
  },
  
  // Support both field names for flexibility
  customer: {
    name: String,
    phone: String,
    address: String
  },
  
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  items: [{
    productId: String,
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    image: String,
    product: String // Support both 'name' and 'product'
  }],
  
  totalAmount: { 
    type: Number, 
    required: false
  },
  total: Number, // Support both 'totalAmount' and 'total'
  
  paymentMethod: { 
    type: String, 
    enum: ['cash_on_delivery', 'online'], 
    default: 'cash_on_delivery'
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
  
  deliveryAddress: String,
  notes: String,
  assignedDriver: String,
  estimatedDelivery: Date
}, {
  timestamps: true
});

// Add pre-validate middleware to ensure required fields exist in some format
orderSchema.pre('validate', function(next) {
  // Check if we have customer info in either format
  const hasRootCustomerInfo = this.customerName && this.phoneNumber && this.address;
  const hasNestedCustomerInfo = this.customer && this.customer.name && this.customer.phone && this.customer.address;
  
  if (!hasRootCustomerInfo && !hasNestedCustomerInfo) {
    return next(new Error('Please provide customer name, phone number, and address either as root fields or nested customer object'));
  }
  
  // Check if we have total amount in either format
  const hasTotalAmount = this.totalAmount !== undefined && this.totalAmount !== null;
  const hasTotal = this.total !== undefined && this.total !== null;
  
  if (!hasTotalAmount && !hasTotal) {
    return next(new Error('Please provide total amount either as totalAmount or total'));
  }
  
  next();
});

// Add pre-save middleware to normalize data
orderSchema.pre('save', function(next) {
  // If customer object is provided, copy to root fields
  if (this.customer && this.customer.name) {
    this.customerName = this.customerName || this.customer.name;
  }
  if (this.customer && this.customer.phone) {
    this.phoneNumber = this.phoneNumber || this.customer.phone;
  }
  if (this.customer && this.customer.address) {
    this.address = this.address || this.customer.address;
  }
  
  // If total is provided but totalAmount is not, copy it
  if (this.total !== undefined && this.total !== null) {
    this.totalAmount = this.totalAmount || this.total;
  }
  
  // Copy deliveryAddress to address if needed
  if (this.deliveryAddress && !this.address) {
    this.address = this.deliveryAddress;
  }
  
  // Copy location address to address if needed
  if (this.location && this.location.address && !this.address) {
    this.address = this.location.address;
  }
  
  // Ensure items have proper structure
  if (this.items && this.items.length > 0) {
    this.items = this.items.map(item => ({
      productId: item.productId || item.id?.toString(),
      name: item.name || item.product,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      product: item.product || item.name
    }));
  }
  
  next();
});

module.exports = mongoose.model('Order', orderSchema);