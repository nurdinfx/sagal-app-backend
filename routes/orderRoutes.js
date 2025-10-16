const express = require('express');
const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
  deleteOrder,
  searchOrders
} = require('../controllers/orderController');
const { protect } = require('../controllers/authController');

const router = express.Router();

// PUBLIC ROUTES - Customers can only create orders
router.post('/', createOrder);

// PROTECTED ROUTES - Only office/admin can access these
router.get('/', protect, getAllOrders);
router.get('/stats', protect, getOrderStats);
router.get('/search', protect, searchOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, deleteOrder);

module.exports = router;