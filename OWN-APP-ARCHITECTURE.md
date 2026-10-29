# নিজস্ব Ludu অ্যাপ + ওয়েব কন্ট্রোল আর্কিটেকচার

## মূল সিদ্ধান্ত

খেলা সম্পূর্ণভাবে আমাদের নিজস্ব Android অ্যাপের ভেতরে হবে। কোনো Original Ludo King অ্যাপ, বাইরের গেম বা তৃতীয় পক্ষের লিংকে খেলোয়াড়কে পাঠানো হবে না। ওয়েবসাইট হবে একই backend-এর client/admin control surface।

```text
Android App ── HTTPS/WebSocket ── API + Match Server ── Database
                                      │
                              Admin Website
```

## Android অ্যাপ

- ফোন লগইন ও প্রোফাইল
- নিজের লুডু বোর্ড ও সার্ভার-নিয়ন্ত্রিত ডাইস/চাল
- ম্যাচমেকিং ও private room code
- ম্যাচ চলাকালীন chat, emoji, mute এবং report
- ম্যাচ ইতিহাস, player status ও notification
- অ্যাপ থেকে কোনো বাইরের Ludo app খোলা হবে না

## ওয়েবসাইট / অ্যাডমিন প্যানেল

- live match তালিকা ও match detail
- ম্যাচ pause, resume, cancel ও dispute review
- chat report, user mute/ban এবং moderation queue
- banner, notice, tournament/event content management
- support link ও FAQ পরিবর্তন
- audit log এবং staff role permissions

## গেমের authoritative flow

1. Android app শুধু player input পাঠাবে।
2. Match server চাল বৈধ কি না যাচাই করবে এবং dice result তৈরি করবে।
3. Server-এর state WebSocket দিয়ে দুই খেলোয়াড় ও admin panel-এ পাঠাবে।
4. Android app animation দেখাবে; ফলাফল নিজে সিদ্ধান্ত নেবে না।
5. Admin কোনো ম্যাচ pause করলে server নতুন চাল বন্ধ করবে এবং দুই অ্যাপে status দেখাবে।

## বর্তমান ডেমো থেকে production-এ যাওয়ার কাজ

- বর্তমান local WebView demo-কে API client করা
- real-time WebSocket match service যোগ করা
- PostgreSQL বা সমমানের database
- secure admin login, staff roles ও two-factor authentication
- chat moderation, rate limiting ও audit retention
- Android APK-তে নতুন API base URL ও environment configuration

পেমেন্ট বা cash-out এই architecture-এর আলাদা, অনুমোদন-নির্ভর module হবে; client-এর অনুমোদিত business/API credentials ছাড়া সেটি চালু করা হবে না।
