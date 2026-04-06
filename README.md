# Real-Time Chat Backend

This is the backend for the real-time chat application. It is built with Node.js, Express, MongoDB, and Socket.io.

## Tech Stack
* **Node.js** & **Express**
* **MongoDB** & **Mongoose** (Database & ODM)
* **Socket.io** (Real-time events)
* **JWT** & **bcrypt** (Authentication & security)
* **dotenv** (Environment variables)

## Installation & Setup

1. **Install Dependencies**
   Navigate to the `server` directory and install the necessary npm packages:
   ```bash
   cd server
   npm install
   ```

2. **Environment Variables**
   Make a copy of the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and replace the placeholders with your actual MongoDB Atlas connection string and a secret hash for your JWT token:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key
   ```

3. **Run the Backend**
   For development with hot-reloading (nodemon):
   ```bash
   npm run dev
   ```

   For production:
   ```bash
   npm start
   ```

The backend server should now be running on `http://localhost:5000`. It expects the React frontend to be running on `localhost:3000` or `localhost:5173`.
