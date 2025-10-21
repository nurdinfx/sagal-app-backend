const Order = require('../models/Order');
const { generateOrderNumber } = require('../utils/generateOrderNumber');

// Create new order (Customer facing)
exports.createOrder = async (req, res) => {
  try {
    console.log('📦 Received order request body:', JSON.stringify(req.body, null, 2));

    const { 
      customerName, 
      phoneNumber, 
      address, 
      customer, // Support nested customer object
      items, 
      totalAmount, 
      total, // Support both totalAmount and total
      paymentMethod, 
      location,
      deliveryAddress 
    } = req.body;

    // Extract customer info from nested object if provided
    const finalCustomerName = customerName || (customer && customer.name);
    const finalPhoneNumber = phoneNumber || (customer && customer.phone);
    const finalAddress = address || deliveryAddress || (customer && customer.address);
    const finalTotalAmount = totalAmount || total;

    console.log('🔍 Extracted order data:', {
      customerName: finalCustomerName,
      phoneNumber: finalPhoneNumber,
      address: finalAddress,
      itemsCount: items?.length,
      totalAmount: finalTotalAmount
    });

    // Validation
    if (!finalCustomerName || !finalPhoneNumber || !finalAddress) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customer name, phone number, and address'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one item to the order'
      });
    }

    if (!finalTotalAmount || finalTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than 0'
      });
    }

    const orderData = {
      customerName: finalCustomerName,
      phoneNumber: finalPhoneNumber,
      address: finalAddress,
      deliveryAddress: finalAddress,
      customer: customer || {
        name: finalCustomerName,
        phone: finalPhoneNumber,
        address: finalAddress
      },
      location,
      items: items.map(item => ({
        productId: item.productId || item.id?.toString(),
        name: item.name || item.product,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        product: item.product || item.name
      })),
      totalAmount: finalTotalAmount,
      total: finalTotalAmount,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      orderNumber: generateOrderNumber()
    };

    console.log('🔄 Creating order in database:', orderData);

    const order = await Order.create(orderData);

    console.log('✅ Order created successfully:', order.orderNumber);

    // Emit real-time update to office admin panel
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('new_order', order);
      console.log('📢 Real-time notification sent to admin');
    }

    // Customer response - only basic info, no order history access
    res.status(201).json({
      success: true,
      message: 'Order placed successfully! Our team will contact you shortly.',
      data: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        estimatedDelivery: '30-45 minutes',
        contactInfo: 'If you have questions, call: +1234567890'
      }
    });
  } catch (error) {
    console.error('❌ Order creation error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to place order. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ... rest of your controller methods remain the same
exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};
