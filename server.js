const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path'); // Required to serve static files

const app = express();
const PORT = process.env.PORT || 3000; // Use port 3000

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Parse JSON request bodies

// Serve static files (your HTML, CSS, JS from the frontend)
// This assumes your HTML file (index.html or login.html) is in a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Mock Database (for demonstration purposes) ---
// In a real application, you'd use a database like MongoDB, PostgreSQL, etc.
let users = []; // Stores user objects: { id, firstName, lastName, username, email, passwordHash, role, organization }
const SECRET_KEY = 'your_super_secret_key'; // **CHANGE THIS IN PRODUCTION!**

// --- API Routes ---

// Registration Route
app.post('/api/auth/register', async (req, res) => {
    const { firstName, lastName, username, email, password, role, organization } = req.body;

    // Basic validation
    if (!firstName || !lastName || !username || !email || !password || !role) {
        return res.status(400).json({ error: 'All required fields must be provided.' });
    }

    // Check if username or email already exists
    if (users.some(user => user.username === username)) {
        return res.status(409).json({ error: 'Username already taken.' });
    }
    if (users.some(user => user.email === email)) {
        return res.status(409).json({ error: 'Email already registered.' });
    }

    try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = {
            id: users.length + 1, // Simple ID generation
            firstName,
            lastName,
            username,
            email,
            passwordHash,
            role,
            organization: organization || null,
        };
        users.push(newUser);

        // Log the new user (for debugging)
        console.log('New user registered:', newUser.username);

        res.status(201).json({ message: 'User registered successfully!', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    // Default admin user (for testing if no users registered)
    if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ id: 0, username: 'admin', role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ message: 'Login successful!', token, user: { id: 0, username: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' } });
    }

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ error: 'Invalid username or password.' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });

        res.json({ message: 'Login successful!', token, user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
