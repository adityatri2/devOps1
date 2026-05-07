# Rollup Backend

## Tech Stack
- Node.js
- Express
- PostgreSQL
- Redis

## Setup
1. Run `npm install`
2. Set up `.env` with your DB and Redis URIs
3. Create the database table (see schema below)
4. Run `npm run dev`

## Schema
```sql
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
