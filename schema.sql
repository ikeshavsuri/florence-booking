CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_date DATE NOT NULL,
  guest_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30),
  party_type VARCHAR(60),
  guests INTEGER,
  function_time VARCHAR(40),
  venue VARCHAR(120),
  food_package VARCHAR(160),
  estimated_amount NUMERIC(12,2) DEFAULT 0,
  advance_paid NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enquiry' CHECK (status IN ('confirmed','hold','enquiry','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);

CREATE TABLE IF NOT EXISTS room_bookings (
  id BIGSERIAL PRIMARY KEY,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30),
  room_type VARCHAR(30) NOT NULL CHECK (room_type IN ('Suite','Premium','Superior')),
  room_number VARCHAR(10) NOT NULL,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  estimated_amount NUMERIC(12,2) DEFAULT 0,
  advance_paid NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enquiry' CHECK (status IN ('confirmed','hold','enquiry','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS idx_room_bookings_dates ON room_bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_room_bookings_room ON room_bookings(room_number);
