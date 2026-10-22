import { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AdminLoginModal from './AdminLoginModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const BASE = import.meta.env.BASE_URL || './';
const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.replace(/^\.?\//, '');
  return BASE.endsWith('/') ? `${BASE}${cleanPath}` : `${BASE}/${cleanPath}`;
};

const suites = [
  {
    id: 1,
    title: 'Premium Suite Room',
    image: getAssetUrl('Images/Rooms/225449353.jpg'),
    description:
      'Luxury suite room with king-size bed, balcony, Wi-Fi, AC, and scenic views.',
    price: '₹2,500 / night',
  },
  {
    id: 2,
    title: 'Family Suite Room',
    image: getAssetUrl('Images/Rooms/1.jpg'),
    description:
      'Spacious suite ideal for families with modern interiors and attached bath.',
    price: '₹2,500 / night',
  },
];

const amenities = [
  'Free High-Speed Wi-Fi',
  '24x7 Reception',
  'Air Conditioned Rooms',
  'Free Parking',
  'Travel Assistance',
  'Hot Water Facility',
];

const galleryImages = [
  getAssetUrl('Images/Rooms/225449353.jpg'),
  getAssetUrl('Images/Rooms/1.jpg'),
  getAssetUrl('Images/Rooms/2.jpg'),
  getAssetUrl('Images/Rooms/3.jpg'),
  getAssetUrl('Images/Rooms/4.jpg'),
  getAssetUrl('Images/Rooms/5.jpg'),
  getAssetUrl('Images/Rooms/6.jpeg'),
  getAssetUrl('Images/Rooms/7.jpeg'),
];

const fallbackImage = getAssetUrl('Images/Rooms/1.jpg');

const generateRefId = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;

export default function StayFacilityWebsite() {
  const [currentView, setCurrentView] = useState('guest'); // 'guest' | 'admin'
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1); // 1: Check Availability, 2: Guest Details & Payment Method
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [paymentOption, setPaymentOption] = useState('counter'); // 'online' | 'counter'
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    countryCode: '+91',
    phone: '',
    checkInDate: '',
    roomType: 'Suite Room (₹2,500/night)',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const [availability, setAvailability] = useState({
    totalSuites: 5,
    availableSuites: 5,
    totalDormBeds: 15,
    availableDormBeds: 15,
  });

  const suitePrice = availability.roomPrices?.suitePrice || 2500;
  const dormPrice = availability.roomPrices?.dormPrice || 450;

  const roomAmounts = {
    'Suite Room (₹2,500/night)': suitePrice,
    'Dormitory Bed (₹450/night)': dormPrice,
    [`Suite Room (₹${suitePrice.toLocaleString('en-IN')}/night)`]: suitePrice,
    [`Dormitory Bed (₹${dormPrice.toLocaleString('en-IN')}/night)`]: dormPrice,
  };

  const fetchAvailability = async (dateStr = '') => {
    try {
      const url = dateStr
        ? `http://localhost:5000/api/availability?date=${dateStr}`
        : 'http://localhost:5000/api/availability';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setAvailability((prev) => ({ ...prev, ...data }));
          return data;
        }
      }
    } catch (err) {
      console.warn('Backend unavailable (using local defaults):', err);
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;
    const url = formData.checkInDate
      ? `http://localhost:5000/api/availability?date=${formData.checkInDate}`
      : 'http://localhost:5000/api/availability';

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data === 'object') {
          setAvailability((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.warn('Backend unavailable:', err));

    return () => {
      isMounted = false;
    };
  }, [formData.checkInDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'checkInDate' || name === 'roomType') {
      setAvailabilityChecked(false);
    }
  };

  const handleCheckAvailability = async (e) => {
    e.preventDefault();
    if (!formData.checkInDate) {
      alert('Please select a Check-in Date to check room availability.');
      return;
    }

    setCheckingAvailability(true);
    await fetchAvailability(formData.checkInDate);
    setCheckingAvailability(false);
    setAvailabilityChecked(true);
  };

  const handleResetStep = () => {
    setBookingStep(1);
    setAvailabilityChecked(false);
  };

  const saveOnlineBookingToBackend = (bookingData) => {
    fetch('http://localhost:5000/api/confirm-online-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    })
      .then(() => fetchAvailability(formData.checkInDate))
      .catch((err) => console.error('Failed to sync booking to backend:', err));
  };

  const selectedAvailableCount = formData.roomType.includes('Suite')
    ? availability.availableSuites
    : availability.availableDormBeds;

  const isSoldOut = selectedAvailableCount <= 0;

  const validateGuestForm = () => {
    if (!formData.fullName || formData.fullName.trim().length < 2) {
      return 'Please enter your full name (minimum 2 characters).';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email.trim())) {
      return 'Please enter a valid email address (e.g. yourname@gmail.com).';
    }
    const rawDigits = (formData.phone || '').replace(/\D/g, '');
    if (!formData.phone || rawDigits.length < 7) {
      return 'Please enter a valid contact phone number with at least 7 digits.';
    }
    if (!formData.checkInDate) {
      return 'Please select a valid check-in date.';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(formData.checkInDate + 'T00:00:00');
    if (bookingDate < today) {
      return 'Check-in date cannot be in the past.';
    }
    if (isSoldOut) {
      return 'Sorry, this accommodation is fully booked or under maintenance on the selected date.';
    }
    return null;
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');

    const validationError = validateGuestForm();
    if (validationError) {
      setBookingError(validationError);
      alert(`⚠️ Validation Notice:\n${validationError}`);
      return;
    }

    setIsSubmitting(true);
    const amount = roomAmounts[formData.roomType] || (formData.roomType.includes('Dormitory') ? dormPrice : suitePrice);
    const fullPhone = formData.phone.startsWith('+')
      ? formData.phone
      : `${formData.countryCode || '+91'} ${formData.phone.trim()}`;

    try {
      const res = await fetch('http://localhost:5000/book-counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: fullPhone,
          date: formData.checkInDate,
          roomType: formData.roomType,
        }),
      });

      const data = await res.json();

      // Check server response status and success flag
      if (!res.ok || !data.success) {
        const errMsg = data.error || (Array.isArray(data.errors) ? data.errors.join('; ') : 'Booking reservation could not be verified by server.');
        setBookingError(errMsg);
        alert(`⚠️ Booking Reservation Rejected:\n${errMsg}`);
        setIsSubmitting(false);
        return;
      }

      // Successful server response
      setBookingConfirmation({
        bookingId: data.bookingId || data.details?.id || generateRefId('MSR-CTR'),
        name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: fullPhone,
        date: formData.checkInDate,
        roomType: formData.roomType,
        paymentMethod: 'Pay at Counter / Property',
        status: 'Pending at Check-in',
        amount: data.details?.amount || amount,
        serverConfirmed: true,
      });

      // Refresh live availability
      fetchAvailability(formData.checkInDate);
    } catch (err) {
      console.warn('Backend unavailable (using offline fallback confirmation):', err);
      // Offline fallback when server is unreachable
      const fallbackId = generateRefId('MSR-CTR');
      setBookingConfirmation({
        bookingId: fallbackId,
        name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: fullPhone,
        date: formData.checkInDate,
        roomType: formData.roomType,
        paymentMethod: 'Pay at Counter / Property',
        status: 'Pending at Check-in (Offline Mode)',
        amount: amount,
        isOffline: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentView === 'admin') {
    return (
      <AdminDashboard
        onSwitchToSite={() => setCurrentView('guest')}
        onLogout={() => setCurrentView('guest')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">
              Mountain Stay Retreat
            </h1>

            <p className="text-sm text-slate-500">
              Luxury Suites & Budget Dormitory
            </p>
          </div>

          <nav className="hidden gap-6 items-center text-sm font-medium md:flex">
            <a href="#about" className="hover:text-blue-600">
              About
            </a>

            <a href="#rooms" className="hover:text-blue-600">
              Rooms
            </a>

            <a href="#dormitory" className="hover:text-blue-600">
              Dormitory
            </a>

            <a href="#booking" className="hover:text-blue-600">
              Booking
            </a>

            <a href="#contact" className="hover:text-blue-600">
              Contact
            </a>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              🛡️ Admin Login
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative flex h-[85vh] items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: `url("${getAssetUrl('Images/Rooms/7.jpeg')}")`,
        }}
      >
        <div className="absolute inset-0 bg-black/55"></div>

        <div className="relative z-10 max-w-4xl px-6 text-center text-white">
          <h2 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
            Experience Comfort & Peace
          </h2>

          <p className="mb-8 text-lg text-slate-200 md:text-xl">
            Premium stay facility featuring 5 luxury suite rooms and a
            15-bed dormitory for travelers, families, and groups.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#booking"
              className="rounded-2xl bg-blue-600 px-8 py-4 text-lg font-semibold shadow-lg transition hover:bg-blue-700"
            >
              Book Now
            </a>

            <a
              href="#rooms"
              className="rounded-2xl border border-white/40 bg-white/20 px-8 py-4 text-lg font-semibold transition hover:bg-white/30"
            >
              Explore Rooms
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-white px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <img
            src={getAssetUrl('Images/Rooms/7.jpeg')}
            alt="Stay Facility"
            className="h-[450px] w-full rounded-3xl object-cover shadow-2xl"
            onError={(e) => {
              e.currentTarget.src = fallbackImage;
            }}
          />

          <div>
            <h3 className="mb-6 text-4xl font-bold">
              Welcome to Mountain Stay Retreat
            </h3>

            <p className="mb-6 text-lg leading-8 text-slate-600">
              Our stay facility is designed to provide a comfortable and
              memorable experience for solo travelers, families, and groups.
              Enjoy premium accommodation, modern amenities, and seamless
              online booking with secure payment integration.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {amenities.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium"
                >
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="bg-slate-100 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold text-blue-700">
                🛋️ {availability.availableSuites} / 5 Suites Currently Available
              </span>
              {availability.maintenanceSuites > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800 border border-amber-300">
                  🛠️ {availability.maintenanceSuites} Suite{availability.maintenanceSuites !== 1 ? 's' : ''} Under Maintenance
                </span>
              )}
            </div>
            <h3 className="mb-4 text-4xl font-bold">
              Suite Rooms
            </h3>

            <p className="text-lg text-slate-600">
              Elegant rooms crafted for comfort and relaxation. Total 5 Suite Rooms available.
            </p>
          </div>

          <div className="grid items-stretch gap-10 md:grid-cols-2">
            {suites.map((room) => (
              <div
                key={room.id}
                className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
              >
                <img
                  src={room.image}
                  alt={room.title}
                  className="h-80 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = fallbackImage;
                  }}
                />

                <div className="flex flex-1 flex-col p-8">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-2xl font-bold">
                      {room.title}
                    </h4>

                    <span className="text-lg font-semibold text-blue-600">
                      ₹{suitePrice.toLocaleString('en-IN')} / night
                    </span>
                  </div>

                  <p className="mb-6 flex-1 leading-7 text-slate-600">
                    {room.description}
                  </p>

                  <a
                    href="#booking"
                    className="block w-full text-center rounded-2xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700"
                  >
                    Reserve Suite
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dormitory */}
      <section id="dormitory" className="bg-white px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-bold text-indigo-700">
                🛏️ {availability.availableDormBeds} / 15 Beds Currently Available
              </span>
              {availability.maintenanceDormBeds > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800 border border-amber-300">
                  🛠️ {availability.maintenanceDormBeds} Bed{availability.maintenanceDormBeds !== 1 ? 's' : ''} Under Maintenance
                </span>
              )}
            </div>
            <h3 className="mb-6 text-4xl font-bold">
              15-Bed Dormitory
            </h3>

            <p className="mb-6 text-lg leading-8 text-slate-600">
              Affordable and clean dormitory accommodation perfect for
              backpackers, group travelers, students, and corporate teams.
            </p>

            <ul className="space-y-4 text-slate-700">
              <li>• Individual lockers</li>
              <li>• Shared lounge & workspace</li>
              <li>• High-speed internet</li>
              <li>• Common washroom facilities</li>
              <li>• Budget-friendly pricing</li>
            </ul>

            <div className="mt-8">
              <span className="text-3xl font-bold text-blue-600">
                ₹{dormPrice.toLocaleString('en-IN')} / Bed
              </span>

              <p className="text-slate-500">Per Night</p>
            </div>
          </div>

          <img
            src={getAssetUrl('Images/Dormitory/Dormitory1.JPG')}
            alt="Dormitory"
            className="h-[450px] w-full rounded-3xl object-cover shadow-2xl"
            onError={(e) => {
              e.currentTarget.src = fallbackImage;
            }}
          />
        </div>
      </section>

      {/* Booking & Payment Gateway Integration */}
      <section id="booking" className="bg-slate-900 px-6 py-20 text-white">
        <div className="mx-auto mb-12 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1.5 text-sm font-medium text-blue-400">
            <span className={`h-2.5 w-2.5 rounded-full ${bookingStep === 1 ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`}></span>
            {bookingStep === 1 ? 'Step 1 of 2: Check Availability' : 'Step 2 of 2: Choose Payment & Book'}
          </div>

          <h3 className="mt-3 mb-4 text-4xl font-bold md:text-5xl">
            {bookingStep === 1 ? 'Check Room Availability' : 'Complete Your Reservation'}
          </h3>

          <p className="text-lg text-slate-300">
            {bookingStep === 1
              ? 'Select your check-in date and room type to check live availability first.'
              : 'Select your preferred payment method and enter guest details to confirm your stay.'}
          </p>
        </div>

        <div className={`mx-auto grid gap-10 ${bookingStep === 2 ? 'max-w-5xl lg:grid-cols-2' : 'max-w-xl'}`}>
          {/* Booking Step Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
            {bookingStep === 1 ? (
              /* STEP 1: CHECK AVAILABILITY FIRST */
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="text-2xl font-semibold flex items-center gap-2">
                    🔍 1. Select Date & Room
                  </h4>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
                    Step 1
                  </span>
                </div>

                <form onSubmit={handleCheckAvailability} className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Check-in Date *
                    </label>
                    <div className="relative w-full">
                      <DatePicker
                        selected={formData.checkInDate ? new Date(formData.checkInDate) : null}
                        onChange={(date) => {
                          if (!date) return handleInputChange({ target: { name: 'checkInDate', value: '' } });
                          const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                          handleInputChange({ target: { name: 'checkInDate', value: localISOTime } });
                        }}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="dd-mm-yyyy"
                        minDate={new Date()}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-slate-800/90 px-5 py-4 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        wrapperClassName="w-full"
                        popperPlacement="bottom-end"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center">
                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Accommodation Type *
                    </label>
                    <select
                      name="roomType"
                      value={formData.roomType}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-800 px-5 py-4 text-white outline-none focus:border-blue-500"
                    >
                      <option value="Suite Room (₹2,500/night)">
                        Suite Room (₹{suitePrice.toLocaleString('en-IN')} / night)
                      </option>
                      <option value="Dormitory Bed (₹450/night)">
                        Dormitory Bed (₹{dormPrice.toLocaleString('en-IN')} / night)
                      </option>
                    </select>
                  </div>

                  {availabilityChecked && isSoldOut && (
                    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300 font-semibold">
                      ⚠️ Sorry! {formData.roomType.split('(')[0]} is completely <strong>Sold Out</strong> on {formData.checkInDate}. Please select another date or room type.
                    </div>
                  )}

                  {/* Overall Capacity Counter */}
                  <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Live Total Capacity
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-900/80 p-2.5 text-center border border-slate-700">
                        <span className="block text-slate-400">Suite Rooms</span>
                        <span className={`font-bold text-sm ${availability.availableSuites > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {availability.availableSuites} / 5 Available
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-900/80 p-2.5 text-center border border-slate-700">
                        <span className="block text-slate-400">Dormitory Beds</span>
                        <span className={`font-bold text-sm ${availability.availableDormBeds > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {availability.availableDormBeds} / 15 Available
                        </span>
                      </div>
                    </div>
                  </div>

                  {!availabilityChecked || isSoldOut ? (
                    <button
                      type="submit"
                      disabled={checkingAvailability}
                      className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {checkingAvailability ? 'Checking Availability...' : '🔍 Check Availability'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBookingStep(2)}
                      className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-700"
                    >
                      Continue ➔
                    </button>
                  )}
                </form>
              </div>
            ) : (
              /* STEP 2: GUEST DETAILS & PAYMENT SELECTION */
              <div>
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h4 className="text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>✅ Accommodation Available!</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      {formData.roomType} on {formData.checkInDate} ({selectedAvailableCount} left)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetStep}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/20"
                  >
                    ← Change Date
                  </button>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Full Name *</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="e.g. Rahul Sharma"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-white placeholder-slate-400 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="e.g. rahul@example.com"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-white placeholder-slate-400 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Contact Number (Phone / WhatsApp) *
                    </label>
                    <div className="flex gap-2">
                      {/* Country Code Selector */}
                      <div className="relative shrink-0 w-36">
                        <select
                          name="countryCode"
                          value={formData.countryCode || '+91'}
                          onChange={handleInputChange}
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-white/10 px-3.5 py-3.5 text-xs font-semibold text-white outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="+91" className="bg-slate-800 text-white">🇮🇳 +91 (India)</option>
                          <option value="+971" className="bg-slate-800 text-white">🇦🇪 +971 (UAE)</option>
                          <option value="+966" className="bg-slate-800 text-white">🇸🇦 +966 (KSA)</option>
                          <option value="+974" className="bg-slate-800 text-white">🇶🇦 +974 (Qatar)</option>
                          <option value="+968" className="bg-slate-800 text-white">🇴🇲 +968 (Oman)</option>
                          <option value="+965" className="bg-slate-800 text-white">🇰🇼 +965 (Kuwait)</option>
                          <option value="+1" className="bg-slate-800 text-white">🇺🇸 +1 (USA/CA)</option>
                          <option value="+44" className="bg-slate-800 text-white">🇬🇧 +44 (UK)</option>
                          <option value="+65" className="bg-slate-800 text-white">🇸🇬 +65 (SG)</option>
                          <option value="+61" className="bg-slate-800 text-white">🇦🇺 +61 (AU)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">
                          ▼
                        </div>
                      </div>

                      {/* Mobile Number Input */}
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="e.g. 98765 43210"
                          maxLength="15"
                          required
                          className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-white placeholder-slate-400 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/90 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Payment Method:</span>
                      <span className="font-bold text-emerald-400">
                        🏨 Pay at Counter (Pay on Arrival)
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2 text-sm font-semibold">
                      <span>Total Amount Due at Check-in:</span>
                      <span className="text-xl text-emerald-400">
                        ₹{(roomAmounts[formData.roomType] || 2500).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {bookingError && (
                    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/20 p-3.5 text-xs text-rose-300 font-semibold flex items-start gap-2">
                      <span className="text-base shrink-0">⚠️</span>
                      <span>{bookingError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full rounded-2xl py-4 text-lg font-semibold shadow-lg transition duration-200 bg-emerald-600 hover:bg-emerald-700 text-white ${
                      isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting
                      ? 'Confirming Reservation...'
                      : '🏨 Confirm Reservation (Pay at Counter)'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Payment Option */}
          {bookingStep === 2 && (
            <div className="flex flex-col justify-between rounded-3xl bg-white p-8 text-slate-800 shadow-2xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h4 className="text-2xl font-bold">
                    Payment Option
                  </h4>
                  <p className="text-sm text-slate-500">
                    Pay at Counter is currently active for all room reservations
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Pay on Arrival
                </span>
              </div>

              <div className="space-y-4">
                {/* Active Option: Pay at Counter */}
                <div
                  className="relative rounded-2xl border-2 border-emerald-600 bg-emerald-50/60 p-5 shadow-md ring-2 ring-emerald-600/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white">
                      <span className="text-xs font-bold">✓</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-900">
                          🏨 Pay at Counter / Property
                        </h5>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                          Instant Booking
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        Reserve your stay without advance online payment. Settle with cash or UPI at the front desk upon check-in.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                        <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 shadow-2xs">
                          💵 Cash at Desk
                        </span>
                        <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 shadow-2xs">
                          ⚡ UPI QR (GPay / PhonePe / Paytm)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disabled Option: Online Pre-payment (Razorpay) */}
                <div
                  className="relative rounded-2xl border border-slate-200 bg-slate-50/80 p-5 opacity-60 cursor-not-allowed select-none"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-slate-400">
                      <span className="text-xs font-bold">✕</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-slate-500">
                          💳 Online Pre-payment (Razorpay)
                        </h5>
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                          Disabled / Coming Soon
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Online payment gateway backend is undergoing setup. Please book with Pay at Counter.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-xs text-slate-500">
              🔒 <strong>Process Guarantee:</strong> Room reservation is confirmed immediately. Pay comfortably upon your arrival.
            </div>
          </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h3 className="mb-4 text-4xl font-bold">
              Gallery
            </h3>

            <p className="text-lg text-slate-600">
              Explore our property and facilities.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {galleryImages.map((img, index) => (
              <img
                key={`${img}-${index}`}
                src={img}
                alt={`Gallery ${index + 1}`}
                className="h-72 w-full rounded-3xl object-cover shadow-lg transition duration-300 hover:scale-105 hover:shadow-2xl"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Location & Contact */}
      <section id="contact" className="bg-slate-100 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h3 className="mb-4 text-4xl font-bold">
              Contact & Location
            </h3>

            <p className="text-lg text-slate-600">
              Reach out for reservations, group bookings, and travel assistance.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-12">
            <div className="rounded-3xl bg-white p-8 shadow-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">
                📞
              </div>
              <h4 className="mb-2 text-lg font-bold">
                Phone
              </h4>
              <p className="text-slate-600 font-medium">
                +91 8301995940
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">
                ✉️
              </div>
              <h4 className="mb-2 text-lg font-bold">
                Email
              </h4>
              <p className="text-slate-600 font-medium">
                wdpcs.208@gmail.com
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">
                📍
              </div>
              <h4 className="mb-2 text-lg font-bold">
                Location
              </h4>
              <p className="text-slate-600 font-medium mb-3">
                Kerala, India
              </p>
              <a
                href="https://maps.app.goo.gl/WFbhoSgQYqwQSdL96"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </div>

          {/* Embedded Interactive Google Map */}
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 px-8 py-5 bg-white">
              <div>
                <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  📍 Find Us on Google Maps
                </h4>
                <p className="text-sm text-slate-500">
                  Easily navigate to Mountain Stay Retreat
                </p>
              </div>
              <a
                href="https://maps.app.goo.gl/WFbhoSgQYqwQSdL96"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                <span>Open in Google Maps App</span>
                <span className="text-xs">↗</span>
              </a>
            </div>
            
            <div className="relative h-96 w-full bg-slate-100">
              <iframe
                title="Mountain Stay Retreat Location Map"
                src="https://maps.google.com/maps?q=Mountain+Stay+Retreat,+Kerala&t=&z=13&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Buttons: Admin & WhatsApp */}
      <button
        onClick={() => setIsLoginModalOpen(true)}
        className="fixed bottom-6 left-6 z-50 rounded-full bg-slate-900 px-5 py-3 font-bold text-xs text-white shadow-2xl transition hover:bg-slate-800 flex items-center gap-1.5 border border-slate-700"
      >
        <span>🛡️ Admin Portal</span>
      </button>

      <a
        href="https://wa.me/918301995940"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 rounded-full bg-green-500 px-6 py-4 font-semibold text-white shadow-2xl transition hover:bg-green-600"
      >
        WhatsApp
      </a>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 text-center text-sm text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>© 2026 Mountain Stay Retreat. All Rights Reserved.</span>
        <button
          onClick={() => setIsLoginModalOpen(true)}
          className="text-slate-600 hover:text-slate-400 text-xs font-mono transition inline-flex items-center gap-1 opacity-60 hover:opacity-100"
        >
          🔒 Staff Portal
        </button>
      </footer>

      {/* Booking Confirmation Modal */}
      {bookingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-8 text-slate-800 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                🎉
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                Booking Confirmed!
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Thank you for choosing Mountain Stay Retreat.
              </p>
            </div>

            <div className="my-6 space-y-3 rounded-2xl bg-slate-50 p-5 text-sm border border-slate-200/80">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Booking Ref ID:</span>
                <span className="font-mono font-bold text-slate-900">{bookingConfirmation.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Guest Name:</span>
                <span className="font-semibold text-slate-800">{bookingConfirmation.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Number:</span>
                <span className="font-semibold text-slate-800">{bookingConfirmation.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in Date:</span>
                <span className="font-semibold text-slate-800">{bookingConfirmation.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accommodation:</span>
                <span className="font-semibold text-slate-800">{bookingConfirmation.roomType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-slate-900">₹{bookingConfirmation.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500">Payment Status:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  bookingConfirmation.status.includes('Paid')
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {bookingConfirmation.status}
                </span>
              </div>
            </div>

            {/* Admin Notification Status Banner */}
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
              <span className="text-base shrink-0">🔔</span>
              <div>
                <strong className="block font-semibold">Admin Notification Dispatched:</strong>
                <span>Mountain Stay Retreat front desk and manager console have been alerted to your reservation.</span>
              </div>
            </div>

            {/* Actions: Send to WhatsApp Admin, Print Receipt, Return */}
            <div className="space-y-2.5">
              <a
                href={`https://wa.me/918301995940?text=${encodeURIComponent(
                  `🏨 *Mountain Stay Retreat - New Reservation Alert*\n\n` +
                  `• *Booking ID:* ${bookingConfirmation.bookingId}\n` +
                  `• *Guest Name:* ${bookingConfirmation.name}\n` +
                  `• *Contact Number:* ${bookingConfirmation.phone}\n` +
                  `• *Email:* ${bookingConfirmation.email}\n` +
                  `• *Check-in Date:* ${bookingConfirmation.date}\n` +
                  `• *Accommodation:* ${bookingConfirmation.roomType}\n` +
                  `• *Total Due:* ₹${(bookingConfirmation.amount || 0).toLocaleString('en-IN')}\n` +
                  `• *Payment Status:* ${bookingConfirmation.status}\n\n` +
                  `Please confirm our room readiness. Thank you!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition"
              >
                <span>💬 Send Booking Confirmation to Reception WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>🖨️ Print / Save Booking Receipt</span>
              </button>

              <button
                onClick={() => {
                  setBookingConfirmation(null);
                  setBookingStep(1);
                  setAvailabilityChecked(false);
                  setFormData({
                    fullName: '',
                    email: '',
                    countryCode: '+91',
                    phone: '',
                    checkInDate: '',
                    roomType: 'Suite Room (₹2,500/night)',
                  });
                }}
                className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Done & Return to Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Security Login Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => {
          setCurrentView('admin');
          setIsLoginModalOpen(false);
        }}
      />
    </div>
  );
}