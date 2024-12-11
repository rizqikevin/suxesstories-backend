require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const midtransClient = require("midtrans-client");
const nodemailer = require("nodemailer");
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require("firebase/firestore");

// Inisialisasi Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
app.use(cors()); // Mengaktifkan CORS
app.use(bodyParser.json());

// Midtrans Configuration
const snap = new midtransClient.Snap({
  isProduction: false, // Set ke `true` jika menggunakan production
  serverKey: process.env.SERVER_KEY,
  clientKey: process.env.CLIENT_KEY,
});

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.LS_USER,
    pass: process.env.LS_PASS,
  },
});

// Endpoint untuk root
app.get("/", (req, res) => {
  res.send("API is working!");
});

app.post("/api/email-event", async (req, res) => {
  const { email, tests, name } = req.body;

  console.log("Request body:", req.body); // Log for debugging

  if (!email || !tests || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    console.log("Tests received:", tests); // Log test data for debugging

    const mailOptions = {
      from: '"Event Organizer" <your-email@gmail.com>',
      to: email,
      subject: "Event Registration Confirmation",
      html: `
        <h1>Hello ${name},</h1>
        <p>Here are your test details:</p>
        <ul>
          ${tests
            .map(
              (test) =>
                `<li>${test.title}: <a href="https://test.suxesstories.com/${test.idSurvey}" target="_blank">https://test.suxesstories.com/${test.idSurvey}</a></li>`
            )
            .join("")}
        </ul>
      `,
    };

    // Sending the email using transporter
    await transporter.sendMail(mailOptions);

    // Respond with success message
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


// Endpoint untuk assign event
app.post("/api/assign-event", async (req, res) => {
  const { event, form, tests } = req.body;

  try {
    if (!event.payment) {
      return res.json({ message: "Registered successfully" });
    }

    // Jika membutuhkan pembayaran, buat transaksi Midtrans
    const orderId = `EVENT-${event.id}-${Date.now()}`;
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(event.amount),
      },
      customer_details: {
        first_name: form.name,
        email: form.email,
      },
      item_details: [
        {
          id: event.id,
          price: parseInt(event.amount),
          quantity: 1,
          name: event.name,
        },
      ],
    };

    const transaction = await snap.createTransaction(parameter);

    return res.json({
      paymentToken: transaction.token,
      orderId,
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return res.status(500).json({ message: error.message });
  }
});

// Endpoint untuk mendapatkan data event dan test dari Firebase
app.post("/api/get-tests", async (req, res) => {
  const { eventId } = req.body;

  try {
    const eventDoc = await getDoc(doc(db, "events", eventId));

    if (!eventDoc.exists()) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventDoc.data();

    if (!event.tests || event.tests.length === 0) {
      return res.json({ message: "No tests associated with this event" });
    }

    const testsCollection = collection(db, "tests");
    const q = query(testsCollection, where("id", "in", event.tests));
    const querySnapshot = await getDocs(q);

    const tests = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ event, tests });
  } catch (error) {
    console.error("Error fetching tests:", error);
    return res.status(500).json({ message: error.message });
  }
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
