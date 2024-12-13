const express = require('express');
const axios = require('axios');
const { Firestore } = require('@google-cloud/firestore');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path'); // Untuk mengatur path ke service account

// Path ke file kunci service account
const serviceAccountPath = path.join(__dirname, 'suxesstories-3ee3d-firebase-adminsdk-ik072-06b7878c55.json');

// Inisialisasi Firestore dengan kunci service account
const db = new Firestore({
  keyFilename: serviceAccountPath
});

// debug firestore
console.log('Firestore berhasil diinisialisasi:', db);

// Inisialisasi Express
const app = express();

// Middleware CORS
app.use(cors({
  origin: 'http://localhost:5173', // Izinkan hanya frontend Anda
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
}));

// Middleware untuk parsing JSON
app.use(bodyParser.json());

// Handler untuk root path
app.get('/', (req, res) => {
  res.send('Server berjalan. Gunakan endpoint /api/fetch-surveys untuk mengambil survei.');
});

// Konfigurasi LimeSurvey
const limeSurveyConfig = {
  baseURL: 'https://test.suxesstories.com',
  username: 'intern',
  password: 'Surabaya2024!?#',
};

// Fungsi untuk mendapatkan session key dari LimeSurvey
async function getSessionKey() {
  const response = await axios.post(`${limeSurveyConfig.baseURL}/admin/remotecontrol`, {
    method: 'get_session_key',
    params: [limeSurveyConfig.username, limeSurveyConfig.password],
    id: 1,
  });
  return response.data.result;
}

// Fungsi untuk melepaskan session key dari LimeSurvey
async function releaseSessionKey(sessionKey) {
  await axios.post(`${limeSurveyConfig.baseURL}/admin/remotecontrol`, {
    method: 'release_session_key',
    params: [sessionKey],
    id: 3,
  });
}

// Endpoint untuk mengambil dan menyimpan survei dari LimeSurvey
app.post('/api/fetch-surveys', async (req, res) => {
  let sessionKey;
  try {
    // 1. Dapatkan session key dari LimeSurvey
    sessionKey = await getSessionKey();
    if (!sessionKey) {
      throw new Error('Gagal mendapatkan session key dari LimeSurvey');
    }
    console.log('Session key:', sessionKey);

    // 2. Ambil daftar survei
    const surveysResponse = await axios.post(`${limeSurveyConfig.baseURL}/admin/remotecontrol`, {
      method: 'list_surveys',
      params: [sessionKey],
      id: 2,
    });

    const surveys = surveysResponse.data.result;

    if (!surveys || surveys.length === 0) {
      console.log('Tidak ada survei ditemukan.');
      return res.status(404).json({ message: 'Tidak ada survei ditemukan.' });
    }

    // 3. Filter survei aktif
    const activeSurveys = surveys.filter((survey) => survey.active === 'Y');
    console.log('Survei aktif ditemukan:', activeSurveys);

    // 4. Simpan survei ke Firestore
    const testsCollection = db.collection('tests');
    const savedSurveys = [];

    for (const survey of activeSurveys) {
      const newTestRef = testsCollection.doc(survey.sid);
      const testDoc = await newTestRef.get();

      if (!testDoc.exists) {
        await newTestRef.set({
          idSurvey: survey.sid,
          title: survey.surveyls_title,
          description: survey.surveyls_description || '',
          active: true,
        });

        savedSurveys.push({
          idSurvey: survey.sid,
          title: survey.surveyls_title,
        });

        console.log(`Tes aktif disimpan: ${survey.surveyls_title}`);
      } else {
        console.log(`Tes sudah ada: ${survey.surveyls_title}`);
      }
    }

    // Kirim respons sukses
    res.status(200).json({
      message: 'Survei aktif berhasil disimpan.',
      savedSurveys,
    });
  } catch (error) {
    console.error('Error fetching surveys from LimeSurvey:', error);
    res.status(500).json({ message: 'Gagal mengambil survei dari LimeSurvey.', error: error.message });
  } finally {
    // Lepaskan session key jika sudah diambil
    if (sessionKey) {
      await releaseSessionKey(sessionKey);
      console.log('Session key berhasil dilepaskan');
    }
  }
});

// Jalankan server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
