# Kainara - Dynamic Size Chart with Shopify Metaobjects

Dokumentasi implementasi modul **Size Chart Terpusat** berbasis Shopify Metaobjects & Metafields untuk toko online Kainara (Fashion Brand).

---

## 📌 1. Latar Belakang & Tujuan
Sebelumnya, size chart diunggah sebagai gambar di deskripsi produk, menyebabkan:
- Sulit diperbarui dan tidak konsisten antar produk pakaian.
- Tidak terbaca dengan jelas di layar smartphone (mobile).

**Solusi yang Diterapkan:**
Size chart dikelola secara terpusat sebagai data terstruktur menggunakan **Shopify Metaobjects**. Satu perubahan angka di Admin otomatis memperbarui seluruh produk yang terhubung. Dilengkapi modal drawer interaktif, konversi satuan dinamis (cm/inci), deteksi kolom kosong otomatis, dan logika *fallback* bertingkat.

---

## 🏗️ 2. Struktur Data di Shopify Admin

### A. Metaobject Definitions

#### 1. `size_chart_row` (Baris Ukuran)
Satu entri mewakili satu baris ukuran (contoh: "S", "M", "L", "XL").
| Field (Key) | Tipe | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `size` | Single line text | **Ya** | Label ukuran: S, M, L, XL, All Size, dst. |
| `chest_cm` | Decimal | Tidak | Lingkar dada (cm) |
| `waist_cm` | Decimal | Tidak | Lingkar pinggang (cm) |
| `hip_cm` | Decimal | Tidak | Lingkar pinggul (cm) |
| `length_cm` | Decimal | Tidak | Panjang badan (cm) |
| `shoulder_cm` | Decimal | Tidak | Lebar bahu (cm) |
| `sleeve_cm` | Decimal | Tidak | Panjang lengan (cm) |

> *Catatan:* Seluruh field ukuran selain `size` dibuat opsional agar fleksibel untuk kategori kemeja, dress wanita, maupun celana.

#### 2. `size_chart` (Size Chart Utama)
Mewadahi data tabel, gambar petunjuk, dan catatan panduan.
| Field (Key) | Tipe | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `title` | Single line text | **Ya** | Nama chart, misal: "Kemeja Pria Regular Fit" |
| `description` | Multi-line text | Tidak | Toleransi ukuran atau penjelasan singkat |
| `rows` | List of metaobject references ke `size_chart_row` | **Ya** | Daftar baris ukuran berurutan |
| `guide_image` | File (image) | Tidak | Gambar/ilustrasi cara mengukur badan |
| `notes` | Rich text | Tidak | Catatan tambahan / panduan memilih ukuran |

---

### B. Metafield Definitions

| Pemilik (Owner) | Namespace & Key | Tipe | Fungsi |
| :--- | :--- | :--- | :--- |
| **Product** | `custom.size_chart` | Metaobject reference ke `size_chart` | Size chart khusus untuk produk terkait. |
| **Collection** | `custom.default_size_chart` | Metaobject reference ke `size_chart` | Size chart default untuk seluruh produk dalam koleksi (*fallback*). |

---

## 🔄 3. Logika Fallback (Prioritas Pengambilan Data)
Sistem membaca data dengan hierarki berikut:
1. **Prioritas 1 (Produk):** Periksa `product.metafields.custom.size_chart.value`. Jika ada, gunakan size chart ini.
2. **Prioritas 2 (Koleksi Aktif):** Jika kosong, periksa `collection.metafields.custom.default_size_chart.value` (halaman koleksi yang sedang dijelajahi).
3. **Prioritas 3 (Koleksi Induk):** Jika kosong, loop `product.collections` untuk mencari koleksi yang memiliki `custom.default_size_chart.value`.
4. **Prioritas 4 (Non-Pakaian / Kosong):** Jika tetap tidak ditemukan, **tidak ada tombol atau markup modal yang dirender** (HTML bersih tanpa kontainer kosong).

---

## 📂 4. File yang Dibuat / Diperbarui

```
Fabric/
├── blocks/
│   └── size-chart.liquid        # Theme Block baru untuk Theme Editor (schema & settings)
├── snippets/
│   └── size-chart.liquid       # Markup Liquid: pembacaan metaobject, logika kolom dinamis, & modal dialog
├── assets/
│   ├── size-chart.css          # Styling drawer, sticky column mobile, dan unit toggle
│   └── size-chart.js           # Vanilla JS: dialog native, konversi cm/inch, & localStorage
└── locales/
    ├── en.default.json         # Translasi bahasa Inggris (products.size_chart.*)
    └── id.json                 # Translasi bahasa Indonesia (products.size_chart.*)
```

### Rincian Modul:
1. **`blocks/size-chart.liquid`**:
   - Block yang dapat ditambah, digeser, atau dihapus melalui Theme Editor di bagian Product Information.
   - Block settings:
     - `button_label` (Text): Ubah label tombol pemicu.
     - `heading_source` (Select): Sumber judul modal (Nama Produk dinamis, Judul Size Chart Metaobject, atau Kustom).
     - `custom_heading` (Text): Teks judul kustom (jika memilih opsi kustom).
     - `default_unit` (Select): Pilihan satuan awal (`cm` atau `inch`).
     - `text_color` (Color): Warna teks tombol.
     - `show_ruler_icon` (Checkbox): Opsi tampilkan ikon meteran.
     - `show_guide_image` (Checkbox): Opsi tampilkan gambar ilustrasi cara mengukur.
2. **`snippets/size-chart.liquid`**:
   - Kolom dinamis: mendeteksi field ukuran yang berisi data (`has_chest`, `has_waist`, dll.). Kolom yang kosong di semua baris otomatis tidak ditampilkan di header maupun data.
   - Sel kosong pada baris tertentu otomatis menampilkan tanda `-`.
   - Menggunakan native HTML `<dialog>` dengan aksesibilitas lengkap (`aria-labelledby`, `aria-modal`).
3. **`assets/size-chart.css`**:
   - Slide-out Drawer modern dengan latar overlay blur (`::backdrop`).
   - Tabel responsif: kolom pertama (`Ukuran`) berstatus **sticky** saat tabel di-scroll horizontal pada layar smartphone (375px).
4. **`assets/size-chart.js`**:
   - Konversi satuan tanpa reload halaman: `1 inci = 2.54 cm` (pembulatan 1 desimal).
   - Menyimpan preferensi satuan pembeli di `localStorage` (`kainara_size_unit`).
   - Navigasi keyboard & aksesibilitas: modal dapat ditutup dengan tombol Close, klik di area backdrop/overlay, atau menekan tombol `ESC`.
   - Scroll lock pada `document.body` saat modal terbuka dan pemulihan fokus keyboard ke tombol pemicu saat ditutup.
5. **Locales**:
   - 100% bebas dari teks hardcode. Semua teks pembeli mengambil string terjemahan dari `locales/`.

---

## 📖 5. Panduan Singkat untuk Admin Toko (Merchant Guide)

### Langkah 1: Membuat Baris Ukuran (`size_chart_row`)
1. Di Shopify Admin, buka menu **Content** > **Metaobjects**.
2. Pilih definisi **Baris Ukuran** (`size_chart_row`), klik **Add entry**.
3. Masukkan nama ukuran (contoh: `M`), lalu isi angka lingkar dada, panjang badan, dll. dalam satuan centimeter (cm). Field yang tidak diperlukan bisa dikosongkan.
4. Klik **Save**. Buat minimal 4 entri ukuran (S, M, L, XL).

### Langkah 2: Membuat Size Chart (`size_chart`)
1. Di menu **Content** > **Metaobjects**, pilih definisi **Size Chart** (`size_chart`).
2. Klik **Add entry**.
3. Isi kolom:
   - **Title**: Contoh `"Kemeja Pria Regular Fit"`.
   - **Description**: Contoh `"Toleransi ukuran 1-2 cm karena proses jahit."`.
   - **Rows**: Tambahkan dan susun urutan baris ukuran yang telah dibuat pada Langkah 1 (S, M, L, XL).
   - **Guide Image** *(opsional)*: Upload gambar ilustrasi cara mengukur badan.
   - **Notes** *(opsional)*: Tuliskan panduan atau tips memilih ukuran.
4. Klik **Save**.

### Langkah 3: Menghubungkan Size Chart ke Produk / Koleksi
* **Memasang ke Produk Spesifik:**
  1. Buka menu **Products**, pilih produk pakaian yang diinginkan.
  2. Gulir ke bawah ke bagian **Metafields** > klik **Size Chart** (`custom.size_chart`).
  3. Pilih size chart yang sesuai, lalu klik **Save**.
* **Memasang ke Koleksi (Default / Fallback untuk Banyak Produk):**
  1. Buka menu **Products** > **Collections**, pilih koleksi (misal: "Koleksi Kemeja").
  2. Gulir ke bagian **Metafields** > klik **Default Size Chart** (`custom.default_size_chart`).
  3. Pilih size chart default untuk koleksi tersebut, lalu klik **Save**.
  4. Seluruh produk di dalam koleksi ini yang tidak memiliki size chart sendiri otomatis menampilkan size chart default koleksi.

---

## 🧪 6. Pengujian 4 Skenario Produk

| Skenario | Kondisi Produk | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :---: |
| **1** | Produk memiliki `custom.size_chart` sendiri | Menampilkan size chart spesifik milik produk. | ✅ Lolos |
| **2** | Produk tanpa metafield, namun koleksinya memiliki `custom.default_size_chart` | Menampilkan size chart default koleksi (*fallback*). | ✅ Lolos |
| **3** | Produk & koleksinya tidak memiliki metafield size chart | Tombol size chart **tidak tampil sama sekali**. | ✅ Lolos |
| **4** | Produk non-pakaian (contoh: Tote Bag / Aksesoris) | Tombol size chart **tidak tampil sama sekali**. | ✅ Lolos |

---

## 🛠️ 7. Menjalankan Pengembangan & Theme Check

Jalankan server pengembangan lokal melalui Shopify CLI:
```bash
shopify theme dev
```

Validasi kualitas kode tema menggunakan Theme Check:
```bash
shopify theme check
```
*Hasil:* Tidak ada error sintaks Liquid maupun error console JavaScript.

---

## 🌟 8. Fitur Bonus yang Dikerjakan (+10 Nilai)

### Bonus 1: Rekomendasi Ukuran Interaktif (Size Recommender)
* **Deskripsi:** Di dalam drawer panduan ukuran, terdapat widget kalkulator pintar. Pembeli cukup memasukkan ukuran lingkar dada (atau lingkar pinggang untuk gaun/dress), lalu sistem secara otomatis mencari ukuran terdekat yang paling pas.
* **Cara Penggunaan di Toko:**
  1. Buka drawer dengan menekan tombol **Lihat Panduan Ukuran**.
  2. Pada kotak *"Cari Ukuran Anda"*, masukkan angka lingkar badan Anda (misal `102`).
  3. Tekan tombol **Cari Ukuran** atau tekan tombol `Enter`.
  4. Sistem akan menampilkan badge rekomendasi (contoh: *"Ukuran yang disarankan: L"*) dan **baris L di tabel otomatis disorot (highlight) berkedip kuning lembut** serta di-scroll agar langsung terlihat oleh pembeli.
  5. Tekan link **Reset** untuk menghapus sorotan tabel.
  6. Perhitungan otomatis menyesuaikan apakah pembeli sedang memilih satuan **CM** atau **Inci**.

### Bonus 2: Dukungan Multi-Bahasa Lengkap (Bahasa Indonesia & Inggris)
* **Deskripsi:** Semua elemen antarmuka, teks tombol, header tabel, tombol konversi satuan, hingga form rekomendasi ukuran mendukung dua bahasa murni melalui `locales/id.json` dan `locales/en.default.json`.
* **Cara Penggunaan:**
  - Ubah bahasa tema melalui selector bahasa toko (atau setting admin). Semua teks akan berganti secara dinamis tanpa ada teks yang ter-hardcode.

### Bonus 3: Section Halaman Statis Panduan Ukuran (`sections/all-size-charts.liquid`)
* **Deskripsi:** Section khusus yang bisa dipasang pada halaman statis (misalnya halaman `/pages/panduan-ukuran` atau `Size Guide`) untuk menampilkan seluruh koleksi size chart Kainara sekaligus dalam satu halaman katalog lengkap.
* **Cara Penggunaan:**
  1. Di Shopify Admin, buat halaman baru melalui **Online Store** > **Pages** > **Add page** dengan judul `"Panduan Ukuran"`.
  2. Buka **Online Store** > **Themes** > klik **Customize** (Theme Editor).
  3. Di dropdown navigasi atas, pilih **Pages** > pilih template halaman panduan ukuran (atau Default page).
  4. Klik **Add section**, lalu pilih section **All Size Charts**.
  5. Atur judul, sub-judul, satuan default, dan apakah gambar panduan ingin ditampilkan.
  6. Klik **Save**. Halaman statis sekarang menampilkan seluruh size chart metaobject Kainara lengkap dengan fitur toggle satuan CM/Inci!

