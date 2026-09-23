require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Dukungan file gambar hingga 50MB)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Membuka folder 'public' agar tampilan HTML bisa dibuka pengunjung
app.use(express.static(path.join(__dirname, 'public')));

// ================================================================
// GUDANG FORMULA RAHASIA (SYSTEM PROMPT TERSIMPAN AMAN DI SERVER)
// ================================================================
function buildSecretSystemPrompt(targetDish, referenceImagesCount) {
    return `
<system_instructions>
Anda adalah World-Class Senior AI Video Prompt Director khusus mesin Google Veo dan Gemini Omni Flash, Anda juga adalah ensiklopedia masakan dari berbagai negara.
Tugas Anda: Menganalisis masakan "${targetDish}" beserta ${referenceImagesCount > 0 ? 'GAMBAR REFERENSI yang dilampirkan' : 'karakteristik aslinya'}, lalu MEMBUAT DETERMINISTIC CULINARY BLUEPRINT (60+ Parameter Fisika) dan meracik Prompt Video PURE RAW UGC Kuliner 8K Macro ECU vertikal 9:16 durasi per part tepat 10 detik secara progresif adaptif (minimal 7 part). WAJIB MUTLAK: SELURUH OUTPUT TEKS DESKRIPSI WAJIB DITULIS 100% DALAM BAHASA INDONESIA BAKU.
</system_instructions>

<core_directives>
# DOKTRIN ABADI & INSTRUKSI SISTEM UGC FOOD STUDIO 8K
- HUKUM WADAH TUNGGAL MUTLAK & ZERO INGREDIENT DUPLICATION (BIJEKTIF 1:1):
  1. TOTAL MANGKUK FISIK WAJIB SAMA PERSIS DENGAN TOTAL RAGAM/JENIS BAHAN UNIK.
  2. DILARANG KERAS MEMUNCULKAN 2 MANGKUK DENGAN JENIS BAHAN YANG SAMA.
  3. LARANGAN PEMISAHAN FUNGSI DI PAMERAN BUMBU: Satukan seluruh jumlah bahan (halus maupun iris) ke dalam 1 mangkuk yang sama saat pameran.
  4. KAPASITAS VOLUME: Bahan boleh bertumpuk rapi di dalam 1 mangkuk jika jumlahnya banyak. Dilarang memecah wadah.
- STRICT 2 HANDS ONLY: Maksimal 2 tangan dari 1 orang talent. Deklarasikan leftHandAction dan rightHandAction eksplisit.
- KAMERA STATIS / FREEZE: Dilarang keras zoom in/out atau pan. Jarak Close-Up khusus bumbu, Macro ECU untuk adegan aksi.
- CAUSALITY LOCK: 1 aksi alat membagi 1 benda. Zero magic duplication.
</core_directives>

<json_schema_rules>
Keluarkan hasil murni dalam kerangka JSON dengan struktur "dishName", "totalPartsCount", "culinaryBlueprint", "globalPrompt", dan "parts".
Di dalam _selfCorrectionCheck poin 5: SAYA MENGGARANSI 100% TIDAK ADA DUA MANGKUK DENGAN JENIS BAHAN YANG SAMA (ZERO DUPLICATE BOWLS).
</json_schema_rules>
`;
}

// ================================================================
// JALUR API: MENERIMA PERMINTAAN GENERATE DARI WEBSITE
// ================================================================
app.post('/api/generate', async (req, res) => {
    try {
        const { 
            dishName, 
            recipeDetails, 
            referenceImages, 
            envSelected, 
            overlayStyle, 
            spiceTool, 
            voiceStyle, 
            currentVoiceGender, 
            handProfileName, 
            transitionStyle, 
            triggerVal,
            selectedModel // Pengguna bisa tetap memilih model dari dropdown
        } = req.body;

        if (!dishName) {
            return res.status(400).json({ error: "Nama masakan wajib diisi." });
        }

        const model = selectedModel || "gemini-1.5-flash";
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API Key belum dikonfigurasi di server." });
        }

        // 1. Susun System Prompt Rahasia
        const secretSystemPrompt = buildSecretSystemPrompt(dishName, referenceImages ? referenceImages.length : 0);

        // 2. Susun Pertanyaan Pengguna
        let userQuery = `Buatkan Prompt Video PURE RAW UGC 8K Lengkap untuk masakan: "${dishName}".\n`;
        if (recipeDetails) {
            userQuery += `\n[KUNCIAN KOMPOSISI BUMBU & BAHAN]:\n"""\n${recipeDetails}\n"""\n`;
        }
        userQuery += `\nKonfigurasi: Latar=${envSelected}, Suara VO=${voiceStyle} (${currentVoiceGender}), Tangan=${handProfileName}, Overlay Teks=${overlayStyle}, Transisi=${transitionStyle}, Kepadatan Anotasi=${triggerVal}, Alat Halus Bumbu=${spiceTool}`;

        const queryParts = [{ text: userQuery }];

        // Masukkan foto jika ada
        if (referenceImages && referenceImages.length > 0) {
            referenceImages.forEach(img => {
                queryParts.push({
                    inlineData: {
                        mimeType: img.mimeType || 'image/jpeg',
                        data: img.base64
                    }
                });
            });
        }

        // 3. Payload Resmi ke Google Gemini
        const payload = {
            contents: [{ parts: queryParts }],
            systemInstruction: { parts: [{ text: secretSystemPrompt }] },
            generationConfig: {
                temperature: 0.15,
                responseMimeType: "application/json"
            }
        };

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // 4. Server menghubungi Google (Bukan browser pengguna yang menghubungi)
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            return res.status(response.status || 500).json({ error: data.error?.message || "Gagal memproses AI" });
        }

        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
            return res.status(500).json({ error: "Respons Gemini kosong." });
        }

        // 5. Kirim HANYA hasil olahan JSON ke layar pengguna
        const parsedJson = JSON.parse(candidateText);
        return res.json(parsedJson);

    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
    }
});

// Menjalankan Server
app.listen(PORT, () => {
    console.log(`Server Dapur AI berjalan aman di http://localhost:${PORT}`);
});