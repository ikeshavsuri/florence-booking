# Florence Boutique Hotel — Party Booking Calendar

## 1. Requirements
- Node.js 18+ recommended
- A Neon PostgreSQL database

## 2. Setup
1. Create a free PostgreSQL database on Neon.
2. In Neon SQL Editor, run `schema.sql`.
3. Copy `.env.example` to `.env` and put your Neon connection string in `DATABASE_URL`.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:5000`.

## Status colors
- Green = Confirmed
- Yellow = Hold
- Blue = Enquiry
- Red = Cancelled

## Production
Set `DATABASE_URL` and `PORT` as environment variables on your Node.js hosting service. Do not commit `.env` or database credentials to GitHub.
