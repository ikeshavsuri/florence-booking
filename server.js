require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// DATABASE
// =========================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

// =========================
// CONSTANTS
// =========================

const allowed = new Set([
  'confirmed',
  'hold',
  'enquiry',
  'cancelled'
]);

// =========================
// HEALTH CHECK
// =========================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      ok: true,
      message: 'Database connected'
    });

  } catch (error) {

    console.error('Health check error:', error);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ======================================================
// PARTY BOOKINGS
// ======================================================

// GET PARTY BOOKINGS
app.get('/api/bookings', async (req, res) => {

  try {

    const { month } = req.query;

    let query = 'SELECT * FROM bookings';
    let params = [];

    if (month) {

      query += `
        WHERE booking_date >= $1::date
        AND booking_date < ($1::date + INTERVAL '1 month')
      `;

      params = [month + '-01'];
    }

    query += `
      ORDER BY booking_date,
      function_time,
      created_at
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (error) {

    console.error('Get bookings error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// CREATE PARTY BOOKING
app.post('/api/bookings', async (req, res) => {

  try {

    const b = req.body;

    if (!b.booking_date || !b.guest_name) {

      return res.status(400).json({
        error: 'Date and guest name are required'
      });
    }

    const status = b.status || 'enquiry';

    if (!allowed.has(status)) {

      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO bookings
      (
        booking_date,
        guest_name,
        phone,
        party_type,
        guests,
        function_time,
        venue,
        food_package,
        estimated_amount,
        advance_paid,
        status,
        notes
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        b.booking_date,
        b.guest_name,
        b.phone || null,
        b.party_type || null,
        b.guests || null,
        b.function_time || null,
        b.venue || null,
        b.food_package || null,
        b.estimated_amount || 0,
        b.advance_paid || 0,
        status,
        b.notes || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {

    console.error('Create party booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// UPDATE PARTY BOOKING
app.put('/api/bookings/:id', async (req, res) => {

  try {

    const b = req.body;

    if (!allowed.has(b.status)) {

      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    const result = await pool.query(
      `
      UPDATE bookings
      SET
        booking_date=$1,
        guest_name=$2,
        phone=$3,
        party_type=$4,
        guests=$5,
        function_time=$6,
        venue=$7,
        food_package=$8,
        estimated_amount=$9,
        advance_paid=$10,
        status=$11,
        notes=$12,
        updated_at=NOW()
      WHERE id=$13
      RETURNING *
      `,
      [
        b.booking_date,
        b.guest_name,
        b.phone || null,
        b.party_type || null,
        b.guests || null,
        b.function_time || null,
        b.venue || null,
        b.food_package || null,
        b.estimated_amount || 0,
        b.advance_paid || 0,
        b.status,
        b.notes || null,
        req.params.id
      ]
    );

    if (!result.rowCount) {

      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {

    console.error('Update party booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// DELETE PARTY BOOKING
app.delete('/api/bookings/:id', async (req, res) => {

  try {

    const result = await pool.query(
      'DELETE FROM bookings WHERE id=$1',
      [req.params.id]
    );

    if (!result.rowCount) {

      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    res.status(204).end();

  } catch (error) {

    console.error('Delete party booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// ROOM BOOKINGS
// ======================================================

// GET ROOM BOOKINGS
app.get('/api/room-bookings', async (req, res) => {

  try {

    const { month } = req.query;

    let query = 'SELECT * FROM room_bookings';
    let params = [];

    if (month) {

      query += `
        WHERE check_out > $1::date
        AND check_in < ($1::date + INTERVAL '1 month')
      `;

      params = [month + '-01'];
    }

    query += `
      ORDER BY check_in,
      room_number,
      created_at
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (error) {

    console.error('Get room bookings error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// CREATE ROOM BOOKING
app.post('/api/room-bookings', async (req, res) => {

  try {

    const b = req.body;

    if (
      !b.check_in ||
      !b.check_out ||
      !b.guest_name ||
      !b.room_number
    ) {

      return res.status(400).json({
        error:
          'Check-in, check-out, guest name and room are required'
      });
    }

    if (b.check_out <= b.check_in) {

      return res.status(400).json({
        error: 'Check-out must be after check-in'
      });
    }

    const status = b.status || 'enquiry';

    if (!allowed.has(status)) {

      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    // CHECK DOUBLE BOOKING
    const clash = await pool.query(
      `
      SELECT id
      FROM room_bookings
      WHERE room_number=$1
      AND status<>'cancelled'
      AND check_in < $3::date
      AND check_out > $2::date
      LIMIT 1
      `,
      [
        b.room_number,
        b.check_in,
        b.check_out
      ]
    );

    if (clash.rowCount) {

      return res.status(409).json({
        error:
          `Room ${b.room_number} is already booked/held for part of these dates.`
      });
    }

    const result = await pool.query(
      `
      INSERT INTO room_bookings
      (
        check_in,
        check_out,
        guest_name,
        phone,
        room_type,
        room_number,
        adults,
        children,
        estimated_amount,
        advance_paid,
        status,
        notes
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        b.check_in,
        b.check_out,
        b.guest_name,
        b.phone || null,
        b.room_type,
        b.room_number,
        b.adults || 1,
        b.children || 0,
        b.estimated_amount || 0,
        b.advance_paid || 0,
        status,
        b.notes || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {

    console.error('Create room booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// UPDATE ROOM BOOKING
app.put('/api/room-bookings/:id', async (req, res) => {

  try {

    const b = req.body;

    if (!allowed.has(b.status)) {

      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    if (b.check_out <= b.check_in) {

      return res.status(400).json({
        error: 'Check-out must be after check-in'
      });
    }

    // CHECK DOUBLE BOOKING
    const clash = await pool.query(
      `
      SELECT id
      FROM room_bookings
      WHERE room_number=$1
      AND id<>$4
      AND status<>'cancelled'
      AND check_in < $3::date
      AND check_out > $2::date
      LIMIT 1
      `,
      [
        b.room_number,
        b.check_in,
        b.check_out,
        req.params.id
      ]
    );

    if (clash.rowCount) {

      return res.status(409).json({
        error:
          `Room ${b.room_number} is already booked/held for part of these dates.`
      });
    }

    const result = await pool.query(
      `
      UPDATE room_bookings
      SET
        check_in=$1,
        check_out=$2,
        guest_name=$3,
        phone=$4,
        room_type=$5,
        room_number=$6,
        adults=$7,
        children=$8,
        estimated_amount=$9,
        advance_paid=$10,
        status=$11,
        notes=$12,
        updated_at=NOW()
      WHERE id=$13
      RETURNING *
      `,
      [
        b.check_in,
        b.check_out,
        b.guest_name,
        b.phone || null,
        b.room_type,
        b.room_number,
        b.adults || 1,
        b.children || 0,
        b.estimated_amount || 0,
        b.advance_paid || 0,
        b.status,
        b.notes || null,
        req.params.id
      ]
    );

    if (!result.rowCount) {

      return res.status(404).json({
        error: 'Room booking not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {

    console.error('Update room booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// DELETE ROOM BOOKING
app.delete('/api/room-bookings/:id', async (req, res) => {

  try {

    const result = await pool.query(
      'DELETE FROM room_bookings WHERE id=$1',
      [req.params.id]
    );

    if (!result.rowCount) {

      return res.status(404).json({
        error: 'Room booking not found'
      });
    }

    res.status(204).end();

  } catch (error) {

    console.error('Delete room booking error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// FRONTEND FALLBACK
// ======================================================
//
// IMPORTANT:
// Express 5 does NOT support app.get('*') in the old format.
// This middleware handles frontend routes safely.
//

app.use((req, res) => {

  if (req.path.startsWith('/api/')) {

    return res.status(404).json({
      error: 'API endpoint not found'
    });
  }

  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

// ======================================================
// SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(
    `Booking Calendar running on port ${PORT}`
  );
});