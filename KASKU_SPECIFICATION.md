# KASKU --- Project Specification

## 1. Project Overview

**Kasku** adalah aplikasi web Personal & Family Finance Management yang
membantu pengguna merencanakan, mengatur, mencatat, memantau, dan
mengevaluasi aktivitas keuangan.

Kasku mendukung dua jenis pengelolaan keuangan:

-   **Personal Finance:** pengelolaan keuangan pribadi.
-   **Family Finance:** pengelolaan keuangan bersama anggota keluarga.

Konsep produk menggunakan pendekatan **Hybrid**: tampilan sederhana dan
mudah digunakan, dengan fitur perencanaan serta analisis keuangan yang
lengkap.

### Prinsip utama

-   Mudah digunakan oleh pengguna awam.
-   Data pribadi dan keluarga terpisah.
-   Mendukung pencatatan pemasukan dan pengeluaran.
-   Mendukung perencanaan anggaran dan target keuangan.
-   Menampilkan kondisi keuangan secara visual.
-   Mendukung kolaborasi antaranggota keluarga.
-   Menjaga akurasi perhitungan dan keamanan data.

## 2. Technology Stack

### Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   Recharts untuk visualisasi data

### Backend

-   NestJS
-   TypeScript
-   Prisma ORM
-   PostgreSQL
-   NestJS Passport
-   JWT Authentication
-   Argon2 untuk password hashing
-   Swagger untuk dokumentasi API

### Arsitektur

-   Frontend dan backend dipisahkan.
-   Backend menggunakan pendekatan **Modular Monolith**.
-   Komunikasi frontend dan backend menggunakan REST API.
-   Terapkan separation of concerns.
-   Gunakan DTO dan validasi input.
-   Gunakan error handling dan format response yang konsisten.

## 3. Authentication & User Management

Buat sistem autentikasi yang mencakup:

-   Register menggunakan nama, email, dan password.
-   Login menggunakan email dan password.
-   Logout.
-   Validasi email.
-   Hash password menggunakan Argon2.
-   JWT access token dan refresh token.
-   Refresh token rotation.
-   Ganti password melalui halaman pengaturan.
-   Verifikasi password saat ini sebelum mengganti password.
-   Manajemen profil pengguna.
-   Proteksi halaman dan API berdasarkan autentikasi.

**Batasan tahap awal:** jangan implementasikan Google OAuth atau login
pihak ketiga lainnya. Google Login dapat ditambahkan pada tahap
pengembangan berikutnya tanpa mengubah keseluruhan sistem akun.

Setiap pengguna yang berhasil mendaftar harus otomatis mendapatkan
Personal Workspace.

## 4. Workspace Management

Workspace adalah ruang pengelolaan keuangan. Terdapat dua jenis
workspace.

### Personal Workspace

-   Dibuat otomatis ketika pengguna mendaftar.
-   Hanya dapat diakses pemiliknya.
-   Memiliki transaksi, dompet, anggaran, kategori, dan laporan sendiri.

### Family Workspace

-   Dapat dibuat oleh pengguna.
-   Dapat memiliki beberapa anggota.
-   Memiliki transaksi dan dompet bersama.
-   Memiliki anggaran dan target keuangan keluarga.
-   Mendukung undangan anggota.
-   Mendukung pengaturan role dan permission.

Pengguna dapat memiliki beberapa workspace dan berpindah workspace
melalui dropdown pada sidebar.

Pastikan seluruh data keuangan terisolasi berdasarkan `workspace_id`.
Data pribadi tidak boleh otomatis terlihat oleh anggota keluarga.

## 5. Family Management

Buat fitur pengelolaan keluarga dengan kemampuan:

-   Membuat workspace keluarga.
-   Mengubah nama keluarga.
-   Mengundang anggota menggunakan email.
-   Menerima dan menolak undangan.
-   Melihat daftar anggota.
-   Menghapus anggota.
-   Mengatur role anggota.
-   Melihat aktivitas anggota.
-   Mengatur akses pengelolaan keuangan.

### Role

**Owner** - Memiliki kontrol penuh terhadap workspace. - Mengelola
anggota dan pengaturan keluarga. - Mengelola seluruh data keuangan
keluarga.

**Admin** - Mengelola transaksi, dompet, kategori, dan anggaran sesuai
permission. - Mengelola anggota sesuai izin Owner.

**Member** - Melihat keuangan bersama. - Mencatat pemasukan dan
pengeluaran. - Mengakses fitur sesuai permission yang diberikan.

Authorization harus diterapkan di backend, bukan hanya dengan
menyembunyikan menu di frontend.

## 6. Dashboard

Buat dashboard yang menampilkan informasi sesuai workspace aktif:

-   Total saldo.
-   Total pemasukan bulan ini.
-   Total pengeluaran bulan ini.
-   Sisa anggaran.
-   Grafik pemasukan dan pengeluaran.
-   Grafik pengeluaran berdasarkan kategori.
-   Riwayat transaksi terbaru.
-   Ringkasan penggunaan anggaran.
-   Target tabungan dan progres.
-   Ringkasan kondisi keuangan.

Tambahkan filter periode:

-   Minggu ini.
-   Bulan ini.
-   Tahun ini.
-   Rentang tanggal khusus (custom date range).

Seluruh data dashboard harus berasal dari database, bukan dummy data
pada implementasi final.

## 7. Transaction Management

Buat modul transaksi dengan operasi CRUD lengkap.

### Jenis transaksi

-   **Income:** pemasukan.
-   **Expense:** pengeluaran.
-   **Transfer:** pemindahan saldo antar-dompet.

### Atribut transaksi

-   ID.
-   Workspace ID.
-   Wallet ID.
-   Category ID.
-   User ID pembuat transaksi.
-   Jenis transaksi.
-   Nominal.
-   Tanggal.
-   Deskripsi.
-   Catatan.
-   Created At.
-   Updated At.

### Fitur

-   Tambah transaksi.
-   Edit transaksi.
-   Hapus transaksi.
-   Detail transaksi.
-   Filter tanggal.
-   Filter kategori.
-   Filter jenis transaksi.
-   Pencarian transaksi.
-   Pagination.
-   Validasi nominal.
-   Riwayat pembuat transaksi.

### Aturan bisnis

-   Income menambah saldo.
-   Expense mengurangi saldo.
-   Transfer mengurangi saldo dompet asal dan menambah saldo dompet
    tujuan.
-   Transfer tidak dihitung sebagai pemasukan atau pengeluaran.
-   Gunakan database transaction untuk menjaga konsistensi perubahan
    saldo.
-   Hindari kesalahan perhitungan akibat floating point.
-   Pastikan dompet asal dan tujuan berada dalam workspace yang sama.
-   Setiap perubahan atau penghapusan transaksi harus memperbarui saldo
    secara konsisten.

## 8. Wallet Management

Buat fitur pengelolaan dompet.

Contoh dompet:

-   Cash.
-   Bank Account.
-   E-Wallet.
-   Family Wallet.

### Fitur

-   Membuat dompet.
-   Mengubah dompet.
-   Menghapus dompet.
-   Melihat saldo.
-   Melihat riwayat transaksi.
-   Transfer antar-dompet.

Setiap dompet harus terhubung dengan workspace tertentu. Penghapusan
dompet harus ditolak jika masih memiliki transaksi yang perlu
dipertahankan, kecuali tersedia mekanisme arsip atau pemindahan data
yang aman.

## 9. Category Management

Buat pengelolaan kategori pemasukan dan pengeluaran.

### Contoh kategori pemasukan

-   Gaji.
-   Bonus.
-   Bisnis.
-   Hadiah.
-   Lainnya.

### Contoh kategori pengeluaran

-   Makanan.
-   Transportasi.
-   Pendidikan.
-   Kesehatan.
-   Hiburan.
-   Tagihan.
-   Belanja.
-   Lainnya.

### Fitur

-   CRUD kategori.
-   Ikon kategori.
-   Warna kategori.
-   Jenis kategori.
-   Kategori default.
-   Kategori custom.

Pastikan kategori tidak bisa digunakan pada jenis transaksi yang tidak
sesuai. Kategori yang sudah digunakan sebaiknya diarsipkan atau
dilindungi dari penghapusan yang merusak riwayat transaksi.

## 10. Budget Management

Buat fitur perencanaan anggaran.

### Fitur

-   Membuat anggaran bulanan.
-   Menentukan periode anggaran.
-   Membuat anggaran berdasarkan kategori.
-   Menentukan batas nominal.
-   Melihat total penggunaan anggaran.
-   Melihat sisa anggaran.
-   Progress bar penggunaan anggaran.
-   Peringatan ketika anggaran hampir habis.
-   Status anggaran terlampaui.

Anggaran harus dihitung berdasarkan transaksi pengeluaran yang sesuai
kategori dan periode. Transfer tidak boleh dihitung sebagai pengeluaran.

## 11. Savings Goals

Buat fitur target tabungan.

### Fitur

-   Membuat target tabungan.
-   Nama target.
-   Deskripsi.
-   Nominal target.
-   Deadline.
-   Progress tabungan.
-   Riwayat setoran.
-   Tambah setoran.
-   Edit target.
-   Hapus atau arsipkan target.
-   Status pencapaian target.

Contoh target:

-   Membeli laptop.
-   Dana pendidikan.
-   Dana darurat.
-   Liburan keluarga.

Setiap setoran harus tercatat dan dapat ditelusuri. Pastikan kontribusi
tabungan tidak menyebabkan saldo dompet berubah secara keliru atau
terhitung ganda.

## 12. Financial Reports

Buat modul laporan keuangan.

### Jenis laporan

-   Laporan pemasukan.
-   Laporan pengeluaran.
-   Laporan saldo.
-   Laporan kategori.
-   Laporan bulanan.
-   Laporan tahunan.
-   Perbandingan keuangan antarperiode.

### Visualisasi

-   Grafik income vs expense.
-   Pie chart pengeluaran berdasarkan kategori.
-   Grafik tren keuangan.
-   Ringkasan statistik.

Tambahkan kemampuan ekspor:

-   PDF.
-   Excel.

Laporan harus dapat difilter berdasarkan workspace dan periode. Pastikan
angka laporan konsisten dengan data transaksi.

## 13. Debt & Receivables Management

Buat modul utang dan piutang.

### Fitur

-   Mencatat utang.
-   Mencatat piutang.
-   Nama pihak terkait.
-   Nominal.
-   Tanggal pencatatan.
-   Jatuh tempo.
-   Status pembayaran.
-   Riwayat pembayaran.
-   Sisa kewajiban.
-   Pengingat jatuh tempo.

### Status

-   Belum dibayar.
-   Sebagian dibayar.
-   Lunas.
-   Terlambat.

Pembayaran harus dapat dicatat dan ditelusuri. Tentukan secara konsisten
apakah pembayaran utang/piutang menghasilkan transaksi pada dompet, dan
hindari pencatatan ganda.

## 14. Recurring Transactions

Buat fitur transaksi berulang.

### Fitur

-   Menentukan transaksi rutin.
-   Menentukan nominal.
-   Menentukan kategori.
-   Menentukan dompet.
-   Menentukan frekuensi.
-   Menentukan tanggal mulai dan berakhir.
-   Mengaktifkan dan menonaktifkan jadwal.

### Frekuensi

-   Harian.
-   Mingguan.
-   Bulanan.
-   Tahunan.

Jangan membuat transaksi ganda ketika scheduler dijalankan berulang
kali. Terapkan mekanisme idempotency dan catat setiap eksekusi jadwal.

## 15. Notifications

Buat sistem notifikasi untuk:

-   Anggaran hampir habis.
-   Anggaran terlampaui.
-   Target tabungan tercapai.
-   Utang mendekati jatuh tempo.
-   Undangan keluarga.
-   Aktivitas penting dalam workspace keluarga.

Sediakan halaman notifikasi dan status sudah dibaca atau belum.
Notifikasi harus mengikuti workspace dan hak akses pengguna.

## 16. Settings

Buat halaman pengaturan yang dibagi menjadi beberapa bagian.

### Profile

-   Melihat profil.
-   Mengubah nama.
-   Mengubah email.
-   Mengubah foto profil.

### Preferences

-   Mengatur mata uang.
-   Mengatur format tanggal.
-   Mengatur tema terang dan gelap.
-   Mengatur preferensi notifikasi.

### Security

-   Mengganti password.
-   Memasukkan password saat ini.
-   Memasukkan password baru.
-   Konfirmasi password baru.
-   Logout.

Gunakan validasi frontend dan backend. Perubahan email dapat memerlukan
verifikasi email sebelum diterapkan.

## 17. Sidebar Navigation

Gunakan struktur sidebar berikut.

### MENU UTAMA

-   Dashboard
-   Transaksi
-   Dompet
-   Anggaran
-   Target Tabungan
-   Laporan

### PENGELOLAAN

-   Kategori
-   Utang & Piutang

### KELUARGA

-   Kelola Keluarga

### PREFERENSI

-   Pengaturan

Tambahkan workspace switcher di bagian atas sidebar untuk berpindah
antara Personal Workspace dan Family Workspace.

Tambahkan profil pengguna dan tombol logout di bagian bawah sidebar.

Menu dan aksi harus menyesuaikan hak akses pengguna pada workspace
aktif.

## 18. UI/UX Design Guidelines

Gunakan desain modern, minimalis, profesional, dan nyaman digunakan.

### Arah desain

-   Dominasi warna hijau sebagai identitas keuangan.
-   Background putih atau abu-abu sangat muda.
-   Card dengan radius konsisten.
-   Sidebar yang rapi.
-   Typography yang jelas.
-   Spacing konsisten.
-   Icon menggunakan Lucide.
-   Grafik mudah dibaca.
-   Responsive untuk desktop, tablet, dan mobile.

### Hindari

-   Dashboard terlalu padat.
-   Terlalu banyak warna.
-   Animasi berlebihan.
-   Informasi yang tidak relevan.
-   Tombol tanpa fungsi.
-   Dummy interaction.
-   Komponen yang hanya bersifat dekoratif.

Gunakan modal atau drawer untuk form jika sesuai dengan pengalaman
pengguna. Sediakan loading state, empty state, error state, dan success
feedback.

## 19. Security & Data Integrity

Terapkan:

-   Password hashing.
-   JWT authentication.
-   Refresh token rotation.
-   Authorization berbasis workspace.
-   Validasi input.
-   SQL injection protection melalui Prisma.
-   Rate limiting pada endpoint sensitif.
-   Proteksi terhadap akses data lintas workspace.
-   Secure environment variables.
-   Database transaction untuk operasi keuangan.
-   Audit trail untuk aktivitas keuangan penting.

Jangan pernah mempercayai `workspace_id`, `role`, atau `user_id` dari
frontend tanpa verifikasi di backend.

Gunakan tipe data desimal untuk nilai uang di database. Jangan
menggunakan floating point untuk penyimpanan atau perhitungan nominal
keuangan.

## 20. Development Rules

Ikuti aturan pengembangan berikut:

1.  Periksa struktur project sebelum melakukan perubahan.
2.  Jangan membuat ulang file atau konfigurasi yang sudah tersedia tanpa
    alasan.
3.  Gunakan struktur kode yang konsisten.
4.  Pisahkan controller, service, DTO, dan akses database.
5.  Gunakan reusable components di frontend.
6.  Jangan menaruh seluruh logika dalam satu file.
7.  Jangan membuat fitur yang hanya tampak berfungsi tetapi tidak
    terhubung ke backend.
8.  Jangan menggunakan dummy data untuk menggantikan fungsi database
    pada implementasi final.
9.  Buat migration Prisma untuk perubahan database.
10. Gunakan environment variables.
11. Buat dokumentasi endpoint melalui Swagger.
12. Buat unit test dan integration test untuk fungsi penting.
13. Pastikan semua fitur yang dibuat dapat digunakan.
14. Jangan mengubah fitur yang sudah berjalan tanpa kebutuhan yang
    jelas.
15. Periksa authorization dan isolasi workspace pada setiap endpoint
    yang mengakses data keuangan.
16. Dokumentasikan keputusan teknis dan aturan bisnis yang penting.

## 21. Expected Result

Hasil akhir adalah aplikasi Kasku yang memiliki:

-   Sistem autentikasi manual.
-   Pengelolaan keuangan pribadi.
-   Pengelolaan keuangan keluarga.
-   Workspace management.
-   Transaction management.
-   Wallet management.
-   Budget planning.
-   Savings goals.
-   Financial reports.
-   Debt management.
-   Recurring transactions.
-   Notifications.
-   User settings.

Aplikasi harus memiliki frontend dan backend yang benar-benar
terintegrasi, database yang konsisten, serta sistem keamanan yang
memadai.

## 22. Implementation Strategy

Jangan mengimplementasikan seluruh fitur sekaligus tanpa perencanaan.
Bangun secara bertahap berdasarkan dependency berikut:

1.  Project setup, konfigurasi database, dan struktur arsitektur.
2.  Authentication dan User Management.
3.  Workspace dan Family Management.
4.  Wallet dan Transaction Management.
5.  Category Management.
6.  Budget dan Savings Goals.
7.  Dashboard dan Financial Reports.
8.  Debt & Receivables.
9.  Recurring Transactions dan Notifications.
10. Settings, Security, Testing, dan Deployment.

Setiap tahap harus: - Memiliki implementasi frontend dan backend yang
terintegrasi. - Memiliki migration database jika diperlukan. - Memiliki
validasi dan penanganan error. - Diuji sebelum melanjutkan ke tahap
berikutnya. - Tidak merusak fitur yang sudah selesai.

**Instruksi utama:** Jadikan dokumen ini sebagai spesifikasi utama
proyek Kasku. Jika ada detail yang belum ditentukan, jelaskan asumsi dan
ajukan pertanyaan sebelum membuat keputusan arsitektur atau aturan
bisnis yang berdampak besar. Jangan mengarang fitur tambahan di luar
scope tanpa persetujuan.
