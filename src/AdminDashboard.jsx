import { useState, useEffect } from 'react';

export default function AdminDashboard({ onSwitchToSite, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roomFilter, setRoomFilter] = useState('All');

  // Price Management State
  const [suitePriceInput, setSuitePriceInput] = useState(2500);
  const [dormPriceInput, setDormPriceInput] = useState(450);
  const [priceSaveMsg, setPriceSaveMsg] = useState('');

  // Under Maintenance State
  const [maintenanceSuitesInput, setMaintenanceSuitesInput] = useState(0);
  const [maintenanceDormBedsInput, setMaintenanceDormBedsInput] = useState(0);
  const [suiteReason, setSuiteReason] = useState('');
  const [dormReason, setDormReason] = useState('');
  const [maintSaveMsg, setMaintSaveMsg] = useState('');

  // Admin Notification State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [newBookingAlert, setNewBookingAlert] = useState(null);

  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio playback restrictions handled
    }
  };

  const fetchBookings = () => {
    fetch('http://localhost:5000/api/bookings')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch((err) => console.warn('Failed to fetch bookings:', err));
  };

  const fetchNotifications = async (detectNew = false) => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.notifications)) {
          if (detectNew && data.notifications.length > 0) {
            const latest = data.notifications[0];
            setNotifications((prev) => {
              const prevTopId = prev[0]?.id;
              if (latest && !latest.read && latest.id !== prevTopId) {
                setNewBookingAlert(latest);
                playAlertChime();
                setTimeout(() => setNewBookingAlert(null), 8000);
              }
              return data.notifications;
            });
          } else {
            setNotifications(data.notifications);
          }
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch admin notifications:', err);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:5000/api/admin/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/notifications/mark-all-read', {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:5000/api/admin/notifications/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((prev) => {
          const wasUnread = notifications.find((n) => n.id === id && !n.read);
          return wasUnread ? Math.max(0, prev - 1) : prev;
        });
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotificationClick = (notif) => {
    handleMarkAsRead(notif.id);
    if (notif.bookingId) {
      setSearchTerm(notif.bookingId);
    } else if (notif.guestName) {
      setSearchTerm(notif.guestName);
    }
    setIsNotifOpen(false);
  };

  useEffect(() => {
    let isMounted = true;
    fetch('http://localhost:5000/api/bookings')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (isMounted) {
          setBookings(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch bookings:', err);
        if (isMounted) setLoading(false);
      });

    // Initial fetch notifications
    fetchNotifications(false);

    // Fetch live prices
    fetch('http://localhost:5000/api/prices')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          if (data.suitePrice) setSuitePriceInput(data.suitePrice);
          if (data.dormPrice) setDormPriceInput(data.dormPrice);
        }
      })
      .catch((err) => console.error('Failed to fetch prices:', err));

    // Fetch live maintenance status
    fetch('http://localhost:5000/api/admin/maintenance')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          if (data.maintenanceSuites !== undefined) setMaintenanceSuitesInput(data.maintenanceSuites);
          if (data.maintenanceDormBeds !== undefined) setMaintenanceDormBedsInput(data.maintenanceDormBeds);
          if (data.suiteMaintenanceReason) setSuiteReason(data.suiteMaintenanceReason);
          if (data.dormMaintenanceReason) setDormReason(data.dormMaintenanceReason);
        }
      })
      .catch((err) => console.error('Failed to fetch maintenance:', err));

    // Polling interval every 8 seconds for background notification updates
    const pollTimer = setInterval(() => {
      if (isMounted) {
        fetchBookings();
        fetchNotifications(true);
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, []);

  const handleSavePrices = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/admin/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suitePrice: Number(suitePriceInput),
          dormPrice: Number(dormPriceInput),
        }),
      });
      if (res.ok) {
        setPriceSaveMsg('✅ Room rates updated successfully!');
        setTimeout(() => setPriceSaveMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save prices:', err);
    }
  };

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceSuites: Number(maintenanceSuitesInput),
          maintenanceDormBeds: Number(maintenanceDormBedsInput),
          suiteMaintenanceReason: suiteReason,
          dormMaintenanceReason: dormReason,
        }),
      });
      if (res.ok) {
        setMaintSaveMsg('✅ Maintenance status updated!');
        setTimeout(() => setMaintSaveMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save maintenance:', err);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const [deleteTargetBooking, setDeleteTargetBooking] = useState(null);

  const handleDeleteBooking = async (id) => {
    if (!id) return;
    // Optimistic UI deletion
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setDeleteTargetBooking(null);

    try {
      await fetch(`http://localhost:5000/api/bookings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to sync delete to backend:', err);
    }
  };

  // Filtered bookings
  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.phone && booking.phone.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'All' || booking.status === statusFilter;

    const matchesRoom =
      roomFilter === 'All' ||
      (roomFilter === 'Suite' && booking.roomType.includes('Suite')) ||
      (roomFilter === 'Dormitory' && booking.roomType.includes('Dormitory'));

    return matchesSearch && matchesStatus && matchesRoom;
  });

  // Calculate metrics
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const activeBookings = bookings.filter((b) => b.status !== 'Cancelled');
  const onlineBookings = bookings.filter((b) => b.paymentMethod.includes('Online')).length;
  const pendingCount = bookings.filter((b) => b.status.includes('Pending')).length;

  const suitesBooked = activeBookings.filter((b) => b.roomType.includes('Suite')).length;
  const dormBedsBooked = activeBookings.filter((b) => b.roomType.includes('Dormitory')).length;

  const suiteInventoryText = `${Math.max(0, 5 - suitesBooked)} / 5 Available`;
  const dormInventoryText = `${Math.max(0, 15 - dormBedsBooked)} / 15 Available`;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Paid Online':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Paid at Counter':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Checked In':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'Pending at Check-in':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-100 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-lg">
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Mountain Stay Retreat
              </h1>
              <p className="text-xs font-medium text-slate-400">
                Admin Management Console & Room Inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell with Badge & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className={`relative flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  unreadCount > 0
                    ? 'border-blue-500/60 bg-blue-900/40 text-blue-200 hover:bg-blue-900/60 shadow-lg shadow-blue-950/50'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title="Admin Booking Notifications"
              >
                <span className="text-sm">🔔</span>
                <span className="hidden sm:inline">Alerts</span>
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-2xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔔</span>
                      <h4 className="font-bold text-sm text-white">Booking Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 text-xs">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500">
                        <span className="text-2xl block mb-1">📭</span>
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`cursor-pointer rounded-2xl border p-3 transition ${
                            notif.read
                              ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                              : 'border-blue-500/40 bg-blue-950/50 hover:bg-blue-950/70 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">
                                {notif.roomType?.includes('Suite') ? '🛋️' : '🛏️'}
                              </span>
                              <span className="font-bold text-white text-xs">{notif.guestName}</span>
                              {!notif.read && (
                                <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                            {notif.message}
                          </p>

                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px]">
                            <div className="flex items-center gap-2">
                              {notif.guestPhone && (
                                <a
                                  href={`https://wa.me/${notif.guestPhone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-400 hover:bg-emerald-500/30"
                                >
                                  WhatsApp
                                </a>
                              )}
                              <span className="font-mono text-slate-400">{notif.bookingId}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {!notif.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(notif.id, e)}
                                  className="text-slate-400 hover:text-white"
                                  title="Mark as read"
                                >
                                  ✓ Read
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDeleteNotification(notif.id, e)}
                                className="text-slate-500 hover:text-rose-400"
                                title="Delete"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                fetchBookings();
                fetchNotifications(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={onSwitchToSite}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              🌐 Guest Website
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600/90 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-600 transition"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-8">
        {/* Floating / Toast New Booking Alert */}
        {newBookingAlert && (
          <div className="fixed top-20 right-6 z-50 max-w-md animate-bounce rounded-3xl border border-emerald-500/50 bg-slate-950 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl text-emerald-400 border border-emerald-500/40">
                🔔
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sm text-white">New Booking Received!</h5>
                  <button
                    onClick={() => setNewBookingAlert(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  <strong>{newBookingAlert.guestName}</strong> booked {newBookingAlert.roomType} for {newBookingAlert.checkInDate} (₹{(newBookingAlert.amount || 0).toLocaleString('en-IN')}).
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleNotificationClick(newBookingAlert);
                      setNewBookingAlert(null);
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition"
                  >
                    View in Table
                  </button>
                  {newBookingAlert.guestPhone && (
                    <a
                      href={`https://wa.me/${newBookingAlert.guestPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-slate-800 px-3 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-slate-700 transition"
                    >
                      WhatsApp Guest
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actionable Banner for Unread Reservations */}
        {unreadCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-950/70 via-slate-900/80 to-slate-950 p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/30 text-xl text-blue-400 border border-blue-500/40 animate-pulse">
                🔔
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{unreadCount} New Reservation Alert{unreadCount !== 1 ? 's' : ''} Received</span>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">Action Required</span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  New guest bookings have arrived. Review reservation details and ensure room readiness.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2.5 sm:mt-0">
              <button
                onClick={() => setIsNotifOpen(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition flex items-center gap-1.5"
              >
                <span>Open Notifications ({unreadCount})</span>
              </button>
              <button
                onClick={handleMarkAllRead}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Mark All Read
              </button>
            </div>
          </div>
        )}
        {/* Metric & Inventory Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Room Inventory (Suites)</span>
              <span className="rounded-full bg-blue-500/10 p-2 text-blue-400">🛋️</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-blue-400">{suiteInventoryText}</p>
            <p className="mt-1 text-xs text-slate-400">
              5 Total Suites ({suitesBooked} Booked)
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Dorm Inventory (Beds)</span>
              <span className="rounded-full bg-indigo-500/10 p-2 text-indigo-400">🛏️</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-indigo-400">{dormInventoryText}</p>
            <p className="mt-1 text-xs text-slate-400">
              15 Total Beds ({dormBedsBooked} Booked)
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Bookings</span>
              <span className="rounded-full bg-slate-500/10 p-2 text-slate-400">📋</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-white">{totalBookings}</p>
            <p className="mt-1 text-xs text-slate-400">
              {activeBookings.length} Active Reservations
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
              <span className="rounded-full bg-emerald-500/10 p-2 text-emerald-400">💰</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-emerald-400">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              All confirmed bookings
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Paid Online</span>
              <span className="rounded-full bg-indigo-500/10 p-2 text-indigo-400">💳</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-white">{onlineBookings}</p>
            <p className="mt-1 text-xs text-slate-400">
              Processed via Razorpay Gateway
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Check-in</span>
              <span className="rounded-full bg-amber-500/10 p-2 text-amber-400">⏳</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-amber-400">{pendingCount}</p>
            <p className="mt-1 text-xs text-slate-400">
              Awaiting counter payment / check-in
            </p>
          </div>
        </div>

        {/* Management Controls: Price Management & Under Maintenance */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Price Management Widget */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏷️ Price Management</span>
              </h3>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                Live Rates
              </span>
            </div>

            <form onSubmit={handleSavePrices} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    Suite Room Rate (₹ / night)
                  </label>
                  <input
                    type="number"
                    value={suitePriceInput}
                    onChange={(e) => setSuitePriceInput(e.target.value)}
                    required
                    min="1"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white font-bold outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    Dormitory Bed Rate (₹ / night)
                  </label>
                  <input
                    type="number"
                    value={dormPriceInput}
                    onChange={(e) => setDormPriceInput(e.target.value)}
                    required
                    min="1"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {priceSaveMsg && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-400 font-semibold text-center">
                  {priceSaveMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500"
              >
                💾 Update Room Prices
              </button>
            </form>
          </div>

          {/* Under Maintenance Status Widget */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🛠️ Under Maintenance Control</span>
              </h3>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                Unavailable Rooms
              </span>
            </div>

            <form onSubmit={handleSaveMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    Maintenance Suites (out of 5)
                  </label>
                  <select
                    value={maintenanceSuitesInput}
                    onChange={(e) => setMaintenanceSuitesInput(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white font-bold outline-none focus:border-blue-500"
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} Suite{n !== 1 ? 's' : ''} Under Maintenance
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    Maintenance Dorm Beds (out of 15)
                  </label>
                  <select
                    value={maintenanceDormBedsInput}
                    onChange={(e) => setMaintenanceDormBedsInput(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white font-bold outline-none focus:border-blue-500"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                      <option key={n} value={n}>
                        {n} Bed{n !== 1 ? 's' : ''} Under Maintenance
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">
                  Maintenance Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual painting & plumbing maintenance"
                  value={suiteReason}
                  onChange={(e) => setSuiteReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              {maintSaveMsg && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-400 font-semibold text-center">
                  {maintSaveMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-amber-600 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-amber-500"
              >
                ⚙️ Save Maintenance Status
              </button>
            </form>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search by Guest Name, Email, Phone, or Booking ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid Online">Paid Online</option>
                  <option value="Pending at Check-in">Pending at Check-in</option>
                  <option value="Paid at Counter">Paid at Counter</option>
                  <option value="Checked In">Checked In</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="All">All Room Types</option>
                  <option value="Suite">Suite Room</option>
                  <option value="Dormitory">Dormitory Bed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings Data Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60 shadow-xl">
          <div className="border-b border-slate-800 px-6 py-4 flex justify-between items-center bg-slate-900/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              📜 Reservation List
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                {filteredBookings.length}
              </span>
            </h2>
            <span className="text-xs text-slate-400">
              Showing {filteredBookings.length} of {bookings.length} reservations
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No bookings found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Booking ID</th>
                    <th className="px-6 py-4">Guest Details</th>
                    <th className="px-6 py-4">Accommodation</th>
                    <th className="px-6 py-4">Check-in Date</th>
                    <th className="px-6 py-4">Payment Method</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-white">
                        {b.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{b.name}</div>
                        <div className="text-xs text-slate-400">{b.email}</div>
                        {b.phone && (
                          <div className="text-xs text-blue-400 flex items-center gap-1.5 mt-1 font-medium">
                            <span>📞</span>
                            <a href={`tel:${b.phone}`} className="hover:underline">{b.phone}</a>
                            <a
                              href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chat on WhatsApp"
                              className="ml-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition"
                            >
                              WhatsApp
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {b.roomType}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-white">
                        {b.date}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {b.paymentMethod.includes('Online') ? '💳 Razorpay Gateway' : '🏨 Pay at Counter'}
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">
                        ₹{(b.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Quick Status Selector */}
                          <select
                            value={b.status}
                            onChange={(e) => handleStatusChange(b.id, e.target.value)}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                          >
                            <option value="Paid Online">Paid Online</option>
                            <option value="Pending at Check-in">Pending at Check-in</option>
                            <option value="Paid at Counter">Paid at Counter</option>
                            <option value="Checked In">Checked In</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTargetBooking(b)}
                            title="Delete Reservation"
                            className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-2 text-xs text-rose-400 hover:bg-rose-900/60 transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Custom Delete Confirmation Modal */}
      {deleteTargetBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-200 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-2xl text-rose-500">
                🗑️
              </div>
              <h3 className="text-xl font-bold text-white">
                Delete Reservation?
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Are you sure you want to permanently remove this booking?
              </p>
            </div>

            <div className="my-5 space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Booking Reference:</span>
                <span className="font-mono font-bold text-white">{deleteTargetBooking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Guest Name:</span>
                <span className="font-semibold text-slate-200">{deleteTargetBooking.name}</span>
              </div>
              {deleteTargetBooking.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact Number:</span>
                  <span className="font-semibold text-slate-200">{deleteTargetBooking.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Check-in Date:</span>
                <span className="font-semibold text-slate-200">{deleteTargetBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Accommodation:</span>
                <span className="font-semibold text-slate-200">{deleteTargetBooking.roomType}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetBooking(null)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBooking(deleteTargetBooking.id)}
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-rose-500 transition"
              >
                🗑️ Confirm & Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
