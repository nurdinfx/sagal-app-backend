exports.validateOrder = (req, res, next) => {
  const { customerName, phoneNumber, address, items, totalAmount } = req.body;

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

  next();
};