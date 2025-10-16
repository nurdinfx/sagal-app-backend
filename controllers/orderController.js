const Order = require('../models/Order');
const { generateOrderNumber } = require('../utils/generateOrderNumber');

// Create new order (Customer facing)
exports.createOrder = async (req, res) => {
  try {
    const { customerName, phoneNumber, address, items, totalAmount, paymentMethod, location } = req.body;

    console.log('📦 Received order request:', {
      customerName,
      phoneNumber,
      address,
      itemsCount: items?.length,
      totalAmount
    });

    // Validation
    if (!customerName || !phoneNumber || !address) {
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

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than 0'
      });
    }

    const orderData = {
      customerName,
      phoneNumber,
      address,
      location,
      items,
      totalAmount,
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

// Get all orders (Office only)
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

// Search orders (Office only)
exports.searchOrders = async (req, res) => {
  try {
    const { query, phone } = req.query;
    
    let searchQuery = {};
    
    if (query) {
      searchQuery = {
        $or: [
          { customerName: { $regex: query, $options: 'i' } },
          { orderNumber: { $regex: query, $options: 'i' } },
          { address: { $regex: query, $options: 'i' } }
        ]
      };
    }
    
    if (phone) {
      searchQuery.phoneNumber = { $regex: phone, $options: 'i' };
    }

    const orders = await Order.find(searchQuery).sort({ createdAt: -1 }).limit(100);

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Search orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search orders'
    });
  }
};

// Get order by ID (Office only)
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
};

// Update order status (Office only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, assignedDriver, notes, estimatedDelivery } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        ...(assignedDriver && { assignedDriver }),
        ...(notes && { notes }),
        ...(estimatedDelivery && { estimatedDelivery })
      },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('🔄 Order status updated:', order.orderNumber, '->', status);

    // Emit status update to office
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('order_updated', order);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('❌ Update order error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update order'
    });
  }
};

// Delete order (Office only)
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('🗑️ Order deleted:', order.orderNumber);

    // Emit deletion to office
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('order_deleted', req.params.id);
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order'
    });
  }
};

// Get order statistics (Office only)
exports.getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
    const preparingOrders = await Order.countDocuments({ status: 'preparing' });
    const deliveryOrders = await Order.countDocuments({ status: 'on_the_way' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today }
    });

    const todayRevenue = await Order.aggregate([
      { 
        $match: { 
          status: 'delivered',
          createdAt: { $gte: today }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        preparingOrders,
        deliveryOrders,
        deliveredOrders,
        cancelledOrders,
        todayOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// Get system status
exports.getSystemStatus = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const todayOrders = await Order.countDocuments({
      createdAt: { 
        $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
      }
    });

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        todayOrders,
        serverTime: new Date().toISOString(),
        database: 'healthy'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching system status'
    });
  }
};