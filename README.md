# লুডু আড্ডা - সম্পূর্ণ সিস্টেম

ক্লায়েন্ট নিয়ন্ত্রিত লুডু প্ল্যাটফর্ম। ক্লায়েন্ট তার প্যানেল থেকে সম্পূর্ণ নিয়ন্ত্রণ করবে।

## সিস্টেম কাঠামো

### ১. Player Site (`player-site/`)
খেলোয়াড়দের জন্য ওয়েবসাইট
- রেজিস্ট্রেশন/লগইন
- লবি থেকে রুম তৈরি/জয়েন
- Send Money ভিত্তিক ডিপোজিট/উইথড্র
- রুম চ্যাট
- ওয়ালেট ম্যানেজমেন্ট

### ২. Client Panel (`client-panel/`)
ক্লায়েন্টের কন্ট্রোল প্যানেল
- ড্যাশবোর্ড
- ডিপোজিট রিকোয়েস্ট এপ্রুভ/রিজেক্ট
- উইথড্র রিকোয়েস্ট (Paid মার্ক)
- ইউজার ম্যানেজমেন্ট (ব্যালেন্স যোগ/বিয়োগ, ব্যান)
- রুম মনিটরিং
- চ্যাট মনিটরিং
- সেটিংস (বেট লিমিট, টেবিল ফি পরিবর্তনযোগ্য)

### ৩. Backend Server (`server/`)
Node.js + Express + Socket.IO + MySQL
- REST API
- Real-time Socket
- ব্যালেন্স হোল্ড সিস্টেম
- ট্রানজেকশন লেজার
- চ্যাট ফিল্টার

## সেটআপ নির্দেশনা

### প্রয়োজনীয় সফটওয়্যার
- Node.js (v18+)
- XAMPP/WAMP (MySQL)
- VS Code

### ধাপ ১: ডাটাবেস সেটআপ
```bash
cd server
cp .env.example .env
```

`.env` ফাইলে আপনার ডাটাবেস তথ্য দিন:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ludu_aaddaa
```

ডাটাবেস তৈরি করুন:
```bash
npm install
npm run db:setup
```

**ডিফল্ট অ্যাডমিন:** username: `admin`, password: `admin123`

### ধাপ ২: সার্ভার চালু
```bash
npm run dev
```
সার্ভার চলবে: `http://localhost:5000`

### ধাপ ৩: ক্লায়েন্ট প্যানেল চালু
`client-panel/index.html` ফাইলটি ব্রাউজারে খুলুন অথবা Live Server ব্যবহার করুন।

### ধাপ ৪: প্লেয়ার সাইট চালু
`player-site/index.html` ফাইলটি ব্রাউজারে খুলুন অথবা Live Server ব্যবহার করুন।

## ফিচারসমূহ

### পেমেন্ট সিস্টেম
- **সর্বনিম্ন রিচার্জ:** ৫০০ টাকা
- **সর্বনিম্ন উত্তোলন:** ২০০০ টাকা
- **পদ্ধতি:** বিকাশ, নগদ, রকেট (Send Money)
- **TrxID যাচাই** - ডুপ্লিকেট রোধ
- **ম্যানুয়াল এপ্রুভ** - ক্লায়েন্ট প্যানেল থেকে

### বেটিং সিস্টেম
- **সর্বনিম্ন বেট:** ১০০ টাকা
- **সর্বোচ্চ বেট:** ৫০০০ টাকা
- **টেবিল ফি:** ১০ টাকা প্রতি খেলোয়াড়
- **উদাহরণ:** বেট ১০০ + ১০০ = ২০০, টেবিল ফি ২০, বিজয়ী পাবে ১৮০ টাকা
- **ব্যালেন্স হোল্ড:** রুমে জয়েন/তৈরি করার সময় টাকা হোল্ড

### চ্যাট সিস্টেম
- **রুম চ্যাট:** শুধুমাত্র একই টেবিলে থাকা খেলোয়াড়দের মধ্যে
- **স্প্যাম ফিল্টার:** ফোন নম্বর, লিংক ব্লক
- **চ্যাট লগ:** ক্লায়েন্ট প্যানেলে সংরক্ষণ

### কন্ট্রোল ফিচার
- ক্লায়েন্ট প্যানেল থেকে টেবিল লিমিট সেটিংস পরিবর্তনযোগ্য
- ডিপোজিট/উইথড্র এক ক্লিকে এপ্রুভ/রিজেক্ট
- ইউজার ব্যালেন্স ম্যানুয়াল যোগ/বিয়োগ
- লাইভ রুম ও চ্যাট মনিটরিং
- ইউজার ব্যান/আনব্যান

## API Endpoints

### Auth
- `POST /api/auth/register` - রেজিস্ট্রেশন
- `POST /api/auth/login` - লগইন
- `GET /api/auth/me` - ইউজার তথ্য

### Rooms
- `GET /api/rooms` - রুম লিস্ট
- `POST /api/rooms/create` - রুম তৈরি
- `POST /api/rooms/join/:roomCode` - রুম জয়েন
- `GET /api/rooms/:roomCode` - রুম বিস্তারিত
- `POST /api/rooms/leave/:roomCode` - রুম ছাড়

### Payment
- `GET /api/payment/settings` - সেটিংস
- `POST /api/payment/deposit` - ডিপোজিট রিকোয়েস্ট
- `GET /api/payment/deposit` - আমার ডিপোজিট হিস্ট্রি
- `POST /api/payment/withdraw` - উইথড্র রিকোয়েস্ট
- `GET /api/payment/withdraw` - আমার উইথড্র হিস্ট্রি

### Admin
- `POST /api/admin/login` - অ্যাডমিন লগইন
- `GET /api/admin/dashboard` - ড্যাশবোর্ড
- `GET /api/admin/deposits` - ডিপোজিট লিস্ট
- `POST /api/admin/deposits/:id/approve` - ডিপোজিট এপ্রুভ
- `POST /api/admin/deposits/:id/reject` - ডিপোজিট রিজেক্ট
- `GET /api/admin/withdraws` - উইথড্র লিস্ট
- `POST /api/admin/withdraws/:id/paid` - Paid মার্ক
- `POST /api/admin/withdraws/:id/reject` - উইথড্র রিজেক্ট
- `GET /api/admin/users` - ইউজার লিস্ট
- `POST /api/admin/users/:id/balance` - ব্যালেন্স আপডেট
- `POST /api/admin/users/:id/ban` - ব্যান/আনব্যান
- `GET /api/admin/rooms` - রুম লিস্ট
- `GET /api/admin/chats/:roomId` - চ্যাট লগ
- `GET /api/admin/settings` - সেটিংস
- `POST /api/admin/settings` - সেটিংস আপডেট

## নিরাপত্তা
- JWT Authentication
- ব্যালেন্স হোল্ড সিস্টেম
- TrxID ডুপ্লিকেট চেক
- চ্যাট ফিল্টার (ফোন নম্বর/লিংক ব্লক)
- SQL Injection প্রতিরোধ (Prepared Statement)
- Password Hashing (bcrypt)

## পরবর্তী উন্নয়ন
- পূর্ণাঙ্গ লুডু গেম লজিক
- টার্ন ভিত্তিক গেম প্লে
- ডাইস রোলিং + গুটি চালনা
- গেম শেষ হলে অটোমেটিক পেমেন্ট
- নোটিফিকেশন সিস্টেম
- মোবাইল রেসপন্সিভ উন্নতি
- APK তে প্লেয়ার সাইট ইন্টিগ্রেট

## ক্রেডিট
Developed by Plabon
