# ChatConnect

A beginner-friendly real-time chat platform built with React, Node.js, Express, MySQL, JWT and Socket.IO.

## Requirements
- Node.js 18+
- MySQL 8+

## 1. Database
Create the database by importing `database/schema.sql` into MySQL.

## 2. Backend
Open a terminal:
```bash
cd server
npm install
```

Copy `.env.example` to `.env` and update the MySQL settings.

Start:
```bash
npm run dev
```

Backend runs on http://localhost:5000

## 3. Frontend
Open another terminal:
```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally http://localhost:5173.

## Features in this first version
- Register
- Login/logout
- JWT authentication
- User search
- Start private conversations
- Real-time messages with Socket.IO
- Message history
- Online user indicator
- User profile editing
- Profile picture upload
- User bio
- Responsive UI


## Registration troubleshooting
If registration shows an error, make sure:
1. MySQL/XAMPP MySQL is running.
2. The `chatconnect` database exists and `database/schema.sql` has been imported.
3. `server/.env` exists and contains the correct MySQL settings.
4. `JWT_SECRET` is set.
5. Backend is running with `npm run dev`.

You can test the database connection at:
`http://localhost:5000/api/health/db`

A successful response is:
`{"ok":true,"message":"MySQL connection is working"}`
