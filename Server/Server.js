import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config(); // also check current working directory .env

const app = express();

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// In-memory bookings store with seed data
let bookings = [
  {
    id: 'MSR-RZP-984210',
    name: 'Anand Kumar',
    email: 'anand.k@gmail.com',
    phone: '+91 98450 12345',
    date: '2026-07-28',
    roomType: 'Suite Room (₹2,500/night)',
    amount: 2500,
    paymentMethod: 'Online Pre-payment (Razorpay)',
    status: 'Paid Online',
    createdAt: new Date('2026-07-24T09:30:00Z').toISOString(),
  },
  {
    id: 'MSR-CTR-482910',
    name: 'Priya Sharma',
    email: 'priya.s@yahoo.com',
    phone: '+91 97412 67890',
    date: '2026-07-29',
    roomType: 'Dormitory Bed (₹450/night)',
    amount: 450,
    paymentMethod: 'Pay at Counter / Property',
    status: 'Pending at Check-in',
    createdAt: new Date('2026-07-24T10:15:00Z').toISOString(),
  },
  {
    id: 'MSR-RZP-319582',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@outlook.com',
    phone: '+91 99001 23456',
    date: '2026-07-25',
    roomType: 'Suite Room (₹2,500/night)',
    amount: 2500,
    paymentMethod: 'Online Pre-payment (Razorpay)',
    status: 'Checked In',
    createdAt: new Date('2026-07-23T14:20:00Z').toISOString(),
  },
  {
    id: 'MSR-CTR-109284',
    name: 'Siddharth Nair',
    email: 'siddharth@gmail.com',
    phone: '+91 83019 95940',
    date: '2026-07-26',
    roomType: 'Dormitory Bed (₹450/night)',
    amount: 450,
    paymentMethod: 'Pay at Counter / Property',
    status: 'Paid at Counter',
    createdAt: new Date('2026-07-24T11:00:00Z').toISOString(),
  },
];

// Total Inventory Configuration
const TOTAL_SUITES = 5;
const TOTAL_DORM_BEDS = 15;

// In-memory Price Configuration
let roomPrices = {
  suitePrice: 2500,
  dormPrice: 450,
};

// In-memory Maintenance Configuration
let maintenanceStatus = {
  maintenanceSuites: 0,
  maintenanceDormBeds: 0,
  suiteMaintenanceReason: '',
  dormMaintenanceReason: '',
};

// In-memory Notifications store for Admin
let notifications = [
  {
    id: 'NOTIF-1',
    type: 'new_booking',
    bookingId: 'MSR-RZP-984210',
    title: 'New Online Booking: Anand Kumar',
    message: 'Anand Kumar booked Suite Room for 2026-07-28 (₹2,500)',
    amount: 2500,
    roomType: 'Suite Room (₹2,500/night)',
    guestName: 'Anand Kumar',
    guestPhone: '+91 98450 12345',
    guestEmail: 'anand.k@gmail.com',
    checkInDate: '2026-07-28',
    paymentMethod: 'Online Pre-payment (Razorpay)',
    read: false,
    createdAt: new Date('2026-07-24T09:30:00Z').toISOString(),
  },
  {
    id: 'NOTIF-2',
    type: 'new_booking',
    bookingId: 'MSR-CTR-482910',
    title: 'New Counter Booking: Priya Sharma',
    message: 'Priya Sharma booked Dormitory Bed for 2026-07-29 (₹450)',
    amount: 450,
    roomType: 'Dormitory Bed (₹450/night)',
    guestName: 'Priya Sharma',
    guestPhone: '+91 97412 67890',
    guestEmail: 'priya.s@yahoo.com',
    checkInDate: '2026-07-29',
    paymentMethod: 'Pay at Counter / Property',
    read: false,
    createdAt: new Date('2026-07-24T10:15:00Z').toISOString(),
  },
];

// Helper: Validation for booking payload
function validateBookingData({ name, email, phone, date, roomType }) {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Guest name is required (minimum 2 characters).');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required (e.g. name@example.com).');
  }

  const phoneDigits = (phone || '').replace(/\D/g, '');
  if (!phone || typeof phone !== 'string' || phoneDigits.length < 7) {
    errors.push('A valid contact phone number with at least 7 digits is required.');
  }

  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('A valid check-in date in YYYY-MM-DD format is required.');
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date + 'T00:00:00');
    if (isNaN(bookingDate.getTime())) {
      errors.push('Invalid check-in date provided.');
    } else if (bookingDate < today) {
      errors.push('Check-in date cannot be in the past.');
    }
  }

  if (!roomType || typeof roomType !== 'string') {
    errors.push('Room type selection is required.');
  }

  return errors;
}

// Helper: Real-time availability check for booking
function checkRoomAvailability(date, roomType) {
  const activeBookings = bookings.filter(
    (b) => b.status !== 'Cancelled' && b.date === date
  );

  const isDorm = (roomType || '').toLowerCase().includes('dormitory');
  const isSuite = (roomType || '').toLowerCase().includes('suite');

  if (isSuite) {
    const bookedSuites = activeBookings.filter((b) => b.roomType.includes('Suite')).length;
    const availableSuites = Math.max(0, TOTAL_SUITES - bookedSuites - maintenanceStatus.maintenanceSuites);
    if (availableSuites <= 0) {
      return {
        available: false,
        error: `Suite rooms are completely sold out or under maintenance on ${date}. Please select another date.`,
      };
    }
  } else if (isDorm) {
    const bookedDormBeds = activeBookings.filter((b) => b.roomType.includes('Dormitory')).length;
    const availableDormBeds = Math.max(0, TOTAL_DORM_BEDS - bookedDormBeds - maintenanceStatus.maintenanceDormBeds);
    if (availableDormBeds <= 0) {
      return {
        available: false,
        error: `Dormitory beds are completely sold out or under maintenance on ${date}. Please select another date.`,
      };
    }
  }

  return { available: true };
}

// GET current room prices
app.get('/api/prices', (req, res) => {
  res.json(roomPrices);
});

// POST update room prices (Admin)
app.post('/api/admin/prices', (req, res) => {
  const { suitePrice, dormPrice } = req.body;
  if (suitePrice !== undefined && !isNaN(Number(suitePrice))) {
    roomPrices.suitePrice = Number(suitePrice);
  }
  if (dormPrice !== undefined && !isNaN(Number(dormPrice))) {
    roomPrices.dormPrice = Number(dormPrice);
  }
  res.json({ success: true, roomPrices });
});

// GET current maintenance status
app.get('/api/admin/maintenance', (req, res) => {
  res.json(maintenanceStatus);
});

// POST update maintenance status (Admin)
app.post('/api/admin/maintenance', (req, res) => {
  const { maintenanceSuites, maintenanceDormBeds, suiteMaintenanceReason, dormMaintenanceReason } = req.body;
  if (maintenanceSuites !== undefined) {
    maintenanceStatus.maintenanceSuites = Math.min(TOTAL_SUITES, Math.max(0, Number(maintenanceSuites)));
  }
  if (maintenanceDormBeds !== undefined) {
    maintenanceStatus.maintenanceDormBeds = Math.min(TOTAL_DORM_BEDS, Math.max(0, Number(maintenanceDormBeds)));
  }
  if (suiteMaintenanceReason !== undefined) {
    maintenanceStatus.suiteMaintenanceReason = String(suiteMaintenanceReason);
  }
  if (dormMaintenanceReason !== undefined) {
    maintenanceStatus.dormMaintenanceReason = String(dormMaintenanceReason);
  }
  res.json({ success: true, maintenanceStatus });
});

// GET availability for a given date or overall
app.get('/api/availability', (req, res) => {
  const { date } = req.query;

  const activeBookings = bookings.filter(
    (b) => b.status !== 'Cancelled' && (!date || b.date === date)
  );

  const bookedSuites = activeBookings.filter((b) =>
    b.roomType.includes('Suite')
  ).length;

  const bookedDormBeds = activeBookings.filter((b) =>
    b.roomType.includes('Dormitory')
  ).length;

  const availableSuites = Math.max(0, TOTAL_SUITES - bookedSuites - maintenanceStatus.maintenanceSuites);
  const availableDormBeds = Math.max(0, TOTAL_DORM_BEDS - bookedDormBeds - maintenanceStatus.maintenanceDormBeds);

  res.json({
    date: date || null,
    totalSuites: TOTAL_SUITES,
    bookedSuites,
    maintenanceSuites: maintenanceStatus.maintenanceSuites,
    availableSuites,
    totalDormBeds: TOTAL_DORM_BEDS,
    bookedDormBeds,
    maintenanceDormBeds: maintenanceStatus.maintenanceDormBeds,
    availableDormBeds,
    roomPrices,
    maintenanceStatus,
  });
});

// Admin Login endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && (password === 'admin' || password === 'admin123')) {
    return res.json({ success: true, token: 'msr_admin_session_token' });
  }
  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

// GET all bookings
app.get('/api/bookings', (req, res) => {
  res.json(bookings);
});

// Create order for Razorpay
app.post('/create-order', async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100,
      currency: 'INR',
      receipt: 'receipt_order',
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Save online booking completion
app.post('/api/confirm-online-booking', (req, res) => {
  try {
    const { id, name, email, phone, date, roomType, amount, paymentMethod } = req.body;

    // 1. Field-level validation
    const validationErrors = validateBookingData({ name, email, phone, date, roomType });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors[0],
        errors: validationErrors,
      });
    }

    // 2. Room availability validation
    const availCheck = checkRoomAvailability(date, roomType);
    if (!availCheck.available) {
      return res.status(400).json({
        success: false,
        error: availCheck.error,
      });
    }

    const calculatedAmount = Number(amount) || (roomType && roomType.includes('Dormitory') ? roomPrices.dormPrice : roomPrices.suitePrice);
    const bookingId = id || ('MSR-RZP-' + Math.floor(100000 + Math.random() * 900000));

    const newBooking = {
      id: bookingId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      date,
      roomType: roomType || 'Suite Room (₹2,500/night)',
      amount: calculatedAmount,
      paymentMethod: paymentMethod || 'Online Pre-payment (Razorpay)',
      status: 'Paid Online',
      createdAt: new Date().toISOString(),
    };
    bookings.unshift(newBooking);

    // 3. Create Admin Notification
    const notif = {
      id: 'NOTIF-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: 'new_booking',
      bookingId: newBooking.id,
      title: `Online Payment Confirmed: ${newBooking.name}`,
      message: `${newBooking.name} booked ${newBooking.roomType} for ${newBooking.date} (₹${newBooking.amount.toLocaleString('en-IN')})`,
      amount: newBooking.amount,
      roomType: newBooking.roomType,
      guestName: newBooking.name,
      guestPhone: newBooking.phone,
      guestEmail: newBooking.email,
      checkInDate: newBooking.date,
      paymentMethod: newBooking.paymentMethod,
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(notif);
    console.log(`🔔 [ADMIN NOTIFICATION] Online Booking Received: ${newBooking.id} | ${newBooking.name} | ${newBooking.date} | ₹${newBooking.amount}`);

    res.status(201).json({
      success: true,
      bookingId: newBooking.id,
      message: 'Online booking confirmed successfully!',
      booking: newBooking,
      details: newBooking,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save counter booking
app.post('/book-counter', (req, res) => {
  try {
    const { name, email, phone, date, roomType } = req.body;

    // 1. Field-level validation
    const validationErrors = validateBookingData({ name, email, phone, date, roomType });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors[0],
        errors: validationErrors,
      });
    }

    // 2. Room availability validation
    const availCheck = checkRoomAvailability(date, roomType);
    if (!availCheck.available) {
      return res.status(400).json({
        success: false,
        error: availCheck.error,
      });
    }

    const bookingId = 'MSR-CTR-' + Math.floor(100000 + Math.random() * 900000);
    const amount = roomType && roomType.includes('Dormitory') ? roomPrices.dormPrice : roomPrices.suitePrice;
    
    const newBooking = {
      id: bookingId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      date,
      roomType: roomType || 'Suite Room (₹2,500/night)',
      amount,
      paymentMethod: 'Pay at Counter / Property',
      status: 'Pending at Check-in',
      createdAt: new Date().toISOString(),
    };

    bookings.unshift(newBooking);

    // 3. Create Admin Notification
    const notif = {
      id: 'NOTIF-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: 'new_booking',
      bookingId: newBooking.id,
      title: `New Counter Reservation: ${newBooking.name}`,
      message: `${newBooking.name} booked ${newBooking.roomType} for ${newBooking.date} (Pay on Arrival: ₹${newBooking.amount.toLocaleString('en-IN')})`,
      amount: newBooking.amount,
      roomType: newBooking.roomType,
      guestName: newBooking.name,
      guestPhone: newBooking.phone,
      guestEmail: newBooking.email,
      checkInDate: newBooking.date,
      paymentMethod: newBooking.paymentMethod,
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(notif);
    console.log(`🔔 [ADMIN NOTIFICATION] Counter Booking Received: ${newBooking.id} | ${newBooking.name} (${newBooking.phone}) | ${newBooking.date} | ₹${newBooking.amount}`);

    res.status(201).json({
      success: true,
      bookingId,
      message: 'Booking confirmed! Please pay at the counter during check-in.',
      details: newBooking,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all admin notifications & unread count
app.get('/api/admin/notifications', (req, res) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({
    success: true,
    unreadCount,
    totalCount: notifications.length,
    notifications,
  });
});

// PATCH mark notification as read
app.patch('/api/admin/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notif = notifications.find((n) => n.id === id);
  if (notif) {
    notif.read = true;
    const unreadCount = notifications.filter((n) => !n.read).length;
    return res.json({ success: true, notification: notif, unreadCount });
  }
  res.status(404).json({ success: false, error: 'Notification not found' });
});

// POST mark all notifications as read
app.post('/api/admin/notifications/mark-all-read', (req, res) => {
  notifications.forEach((n) => {
    n.read = true;
  });
  res.json({ success: true, unreadCount: 0 });
});

// DELETE single notification
app.delete('/api/admin/notifications/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = notifications.length;
  notifications = notifications.filter((n) => n.id !== id);
  if (notifications.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ success: true, message: 'Notification removed', unreadCount });
});

// PATCH update booking status
app.patch('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (status) {
    booking.status = status;
  }

  res.json({ success: true, booking });
});

// DELETE booking
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const decodedId = decodeURIComponent(id);
  const initialLength = bookings.length;
  bookings = bookings.filter((b) => b.id !== id && b.id !== decodedId);

  if (bookings.length === initialLength) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  res.json({ success: true, message: 'Booking deleted' });
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});