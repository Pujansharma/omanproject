// utils/kitchenPrinter.js
const logger = require('./loggers');

/**
 * Generate kitchen ticket for printing
 * @param {Object} order - Order object
 * @returns {Object} Formatted ticket for kitchen display/printer
 */
function generateKitchenTicket(order) {
  const ticket = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    timestamp: new Date(),
    customerInfo: {
      name: `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim(),
      phone: order.customerPhone,
      vehiclePlate: order.vehiclePlateNumber
    },
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
      modifiers: item.modifiers || []
    })),
    specialInstructions: order.specialInstructions,
    orderType: order.orderType,
    priority: order.orderType === 'curbside' ? 'high' : 'normal'
  };
  
  return ticket;
}

/**
 * Format ticket for text printing (thermal printer)
 * @param {Object} ticket - Kitchen ticket object
 * @returns {string} Formatted text for printing
 */
function formatKitchenTicketText(ticket) {
  const line = '='.repeat(48);
  const divider = '-'.repeat(48);
  
  let text = '\n';
  text += line + '\n';
  text += '           KITCHEN ORDER TICKET\n';
  text += line + '\n';
  text += `Order #: ${ticket.orderNumber}\n`;
  text += `Time: ${ticket.timestamp.toLocaleTimeString()}\n`;
  text += `Type: ${ticket.orderType.toUpperCase()}\n`;
  text += divider + '\n';
  
  if (ticket.customerInfo.vehiclePlate) {
    text += `Vehicle: ${ticket.customerInfo.vehiclePlate}\n`;
    text += divider + '\n';
  }
  
  text += '\nITEMS:\n';
  text += divider + '\n';
  
  ticket.items.forEach((item, idx) => {
    text += `${idx + 1}. ${item.quantity}x ${item.name}\n`;
    if (item.specialInstructions) {
      text += `   *Note: ${item.specialInstructions}\n`;
    }
    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach(mod => {
        text += `   - ${mod.name}\n`;
      });
    }
    text += '\n';
  });
  
  if (ticket.specialInstructions) {
    text += divider + '\n';
    text += `SPECIAL INSTRUCTIONS:\n${ticket.specialInstructions}\n`;
  }
  
  text += line + '\n';
  text += `Priority: ${ticket.priority === 'high' ? '🔥 HIGH - CURBSIDE' : 'Normal'}\n`;
  text += line + '\n\n';
  
  return text;
}

/**
 * Send to network printer (ESC/POS protocol)
 * @param {string} printerIp - Printer IP address
 * @param {number} printerPort - Printer port (usually 9100)
 * @param {string} text - Text to print
 */
async function sendToNetworkPrinter(printerIp, printerPort, text) {
  const net = require('net');
  
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    
    client.connect(printerPort, printerIp, () => {
      logger.info(`Connected to printer at ${printerIp}:${printerPort}`);
      client.write(text);
      client.end();
      resolve(true);
    });
    
    client.on('error', (err) => {
      logger.error(`Printer connection error: ${err.message}`);
      reject(err);
    });
    
    setTimeout(() => {
      client.destroy();
      reject(new Error('Printer connection timeout'));
    }, 5000);
  });
}

/**
 * Print kitchen ticket
 * @param {Object} order - Order object
 * @param {Object} branchConfig - Branch printer configuration
 */
async function printKitchenTicket(order, branchConfig) {
  try {
    const ticket = generateKitchenTicket(order);
    const formattedText = formatKitchenTicketText(ticket);
    
    logger.info(`Printing kitchen ticket for order ${order.orderNumber}`);
    
    if (branchConfig.printerIp && branchConfig.printerPort) {
      await sendToNetworkPrinter(
        branchConfig.printerIp,
        branchConfig.printerPort,
        formattedText
      );
      logger.info(`Kitchen ticket printed successfully for order ${order.orderNumber}`);
      return { success: true, method: 'network' };
    } else {
      // Fallback to browser printing via WebSocket
      logger.info(`No network printer configured for order ${order.orderNumber}, using browser print`);
      return { success: true, method: 'browser', ticket: formattedText };
    }
  } catch (error) {
    logger.error(`Failed to print kitchen ticket: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateKitchenTicket,
  formatKitchenTicketText,
  sendToNetworkPrinter,
  printKitchenTicket
};