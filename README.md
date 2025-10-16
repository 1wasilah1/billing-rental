# Sistem Billing Rental PlayStation 3

Sistem billing rental PS3 dengan Node.js, WebSocket, dan MongoDB untuk mengelola 5 Smart TV.

## Fitur

- **Dashboard Admin**: Kontrol semua TV dari satu tempat
- **Timer Real-time**: Update waktu secara otomatis via WebSocket
- **Kontrol Session**: Mulai, jeda, lanjut, perpanjang, dan stop
- **Display TV**: Tampilan timer yang besar dan jelas untuk Smart TV
- **Database**: Penyimpanan session dengan MongoDB

## Instalasi

1. **Install Dependencies**
```bash
npm install
```

2. **Install dan Jalankan MongoDB**
```bash
# macOS dengan Homebrew
brew install mongodb-community
brew services start mongodb-community

# Atau jalankan manual
mongod --dbpath /usr/local/var/mongodb
```

3. **Jalankan Server**
```bash
npm start
# atau untuk development
npm run dev
```

## Penggunaan

### Admin Dashboard
- Buka: `http://localhost:3000`
- Kontrol semua 5 TV dari dashboard
- Input durasi dalam menit
- Tombol: Mulai, Jeda, Lanjut, Perpanjang, Stop

### Smart TV Display
- TV 1: `http://localhost:3000/tv/1`
- TV 2: `http://localhost:3000/tv/2`
- TV 3: `http://localhost:3000/tv/3`
- TV 4: `http://localhost:3000/tv/4`
- TV 5: `http://localhost:3000/tv/5`

### Setup Smart TV

1. **Hubungkan TV ke WiFi**
2. **Buka Browser TV** (biasanya ada di menu Smart TV)
3. **Akses URL**: `http://[IP_SERVER]:3000/tv/[NOMOR_TV]`
4. **Fullscreen**: Tekan F11 atau gunakan mode fullscreen TV

## Struktur Sistem

```
rental/
├── server.js          # Server utama
├── package.json       # Dependencies
├── public/
│   ├── admin.html     # Dashboard admin
│   └── tv.html        # Display timer TV
└── README.md
```

## API Endpoints

- `POST /api/start-session` - Mulai session baru
- `POST /api/pause-session` - Jeda session
- `POST /api/resume-session` - Lanjut session
- `POST /api/extend-session` - Perpanjang waktu
- `POST /api/stop-session` - Stop session
- `GET /api/sessions` - Ambil semua session aktif

## WebSocket Events

- `session-update` - Update status session
- `timer-update` - Update timer setiap detik
- `register-tv` - Registrasi TV ke server

## Konfigurasi Jaringan

1. **Cari IP Server**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

2. **Update URL di Smart TV** dengan IP yang ditemukan:
```
http://192.168.1.100:3000/tv/1
```

## Troubleshooting

### MongoDB Connection Error
```bash
# Pastikan MongoDB berjalan
brew services list | grep mongodb
# atau
ps aux | grep mongod
```

### Smart TV Tidak Terhubung
1. Pastikan TV dan server di jaringan yang sama
2. Cek firewall tidak memblokir port 3000
3. Gunakan IP address, bukan localhost

### Timer Tidak Update
1. Cek koneksi WebSocket di browser console
2. Refresh halaman TV
3. Restart server jika perlu

## Pengembangan Lanjutan

- Tambah sistem pembayaran
- Laporan penggunaan harian/bulanan
- Notifikasi suara saat waktu hampir habis
- Kontrol remote via mobile app
- Integrasi dengan printer untuk struk