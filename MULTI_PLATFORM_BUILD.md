# دليل البناء المتعدد المنصات لـ DzStore 🚀
# DzStore Multi-Platform Build Guide

هذا المشروع مبني على معمارية موحدة تسمح لك باستخدام **نفس الكود البرمجي بالكامل** للمواقع الإلكترونية، تطبيقات الأندرويد، الآيفون، والكمبيوتر باستخدام **React + Vite + Firebase + PWA** بالدمج مع **CapacitorJS** و**Electron / Tauri**.

This project is designed with a unified codebase architecture, allowing you to use the **exact same code** for Web, Android, iOS, and Desktop platforms using **React + Vite + Firebase + PWA** coupled with **CapacitorJS** and **Electron / Tauri**.

---

## 📐 مخطط معمارية النظام / Project Architecture

```text
               المشروع الأساسي (Core Codebase)
            [ React + Vite + Firebase + PWA ]
                           │
       ┌───────────────────┼───────────────────┬───────────────────┐
       ▼                   ▼                   ▼                   ▼
    تطبيق الويب         ويندوز          أندرويد              آيفون
    [ Web (PWA) ]   [ Windows (EXE) ]  [ Android (APK) ]   [ iOS (App) ]
  (متصفح / تثبيت فورى)  (Electron/Tauri)    (Capacitor SDK)     (Capacitor SDK)
```

---

## 🛠️ المتطلبات الأساسية / Prerequisites
قبل البدء في بناء النسخ للهواتف وأجهزة الكمبيوتر، تأكد من تثبيت الأدوات التالية على حاسوبك:
Before compiling your mobile and desktop applications, make sure you have the following installed on your machine:
* **Node.js** (v18+)
* **Android Studio** (لبناء تطبيقات الأندرويد / For compiling Android APK)
* **Xcode** (لبناء تطبيقات الآيفون - يحتاج نظام ماك / For compiling iOS App - macOS Required)

---

## 1️⃣ تطبيق الويب و PWA (الأساس المشترك) / Web & PWA (The Core Base)
هذا هو الجزء الأساسي الذي يحتوي على كامل منطق الأعمال والتصميم التفاعلي السريع. عند بناء المشروع، يتولد مجلد `dist` والذي يعامل كتطبيق ويب تقدمي (PWA) يمكن تثبيته مباشرة من المتصفحات على الهواتف والكمبيوتر.

This is the main container with all application logic and responsive design. Building the project generates the `dist` static folder, fully configured with a Service Worker as a Progressive Web App (PWA) installable directly from web browsers.

```bash
# تثبيت الاعتماديات / Install base packages
npm install

# لبناء كود الويب والـ PWA فقط (موصى به لتطبيقات الهواتف وأجهزة الكمبيوتر)
# Build ONLY the client-side static web application (Recommended for Android/iOS/Windows wraps)
npm run build:web

# لبناء كود الويب بالكامل مضافاً إليه ملفات السيرفر المركزي
# Build the complete full-stack web and backend code
npm run build
```

---

## 2️⃣ تطبيق الأندرويد (Android - APK / AAB) 🤖
نستخدم **CapacitorJS** للتحويل التلقائي لكود الويب إلى تطبيق أندرويد نيتف نقي 100%.

We use **CapacitorJS** to wrap the exact same web assets into a clean, 100% native Android application.

### خطوات البناء / Build Steps:
1. **أول مرة فقط (تهيئة الأندرويد)** / **First time only (Initialize Android)**:
   ```bash
   # تثبيت حزمة الأندرويد لـ Capacitor / Install Capacitor Android package
   npm install @capacitor/android
   
   # إضافة مجلد الأندرويد الأصلي للمشروع / Add native Android folder
   npx cap add android
   ```

2. **عند إجراء أي تحديث أو تغيير في الكود مستقبلاً** / **Syncing updates (Whenever you edit the React app)**:
   ```bash
   # 1. بناء ملفات الويب أولاً / Build your web web-assets
   npm run build:web
   
   # 2. نقل التحديثات الجديدة إلى مجلد الأندرويد تلقائياً / Sync assets to native project
   npm run cap:sync
   ```

3. **توليد ملف APK وتجربة التطبيق في المحاكي** / **Build APK & Run via Android Studio**:
   ```bash
   # فتح مشروع الأندرويد في أندرويد ستوديو / Open Android Studio automatically
   npm run cap:open:android
   ```
   * من داخل **Android Studio**، توجه إلى:
     `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)` لإنتاج ملف الـ **APK** جاهزاً للإرسال والتثبيت فوراً للمحلات!

---

## 3️⃣ تطبيق الآيفون (iOS - App Store) 🍏
بـ نَفْسِ الطريقة تماماً، نستخدم Capacitor لإنتاج تطبيق iOS نيتف متكامل.

In the same way, we use Capacitor to generate a fully native iOS application package.

### خطوات البناء / Build Steps:
1. **أول مرة فقط (تهيئة الآيفون)** / **First time only (Initialize iOS)**:
   ```bash
   # تثبيت حزمة الآيفون لـ Capacitor / Install Capacitor iOS package
   npm install @capacitor/ios
   
   # إضافة مجلد الآيفون الأصلي للمشروع / Add native iOS folder
   npx cap add ios
   ```

2. **عند إجراء أي تحديث أو تغيير في الكود مستقبلاً** / **Syncing updates**:
   ```bash
   # 1. بناء كود الويب
   npm run build:web
   
   # 2. نقل التحديثات لمشروع Xcode
   npm run cap:sync
   ```

3. **بناء التطبيق وتشغيله** / **Build & Run via Xcode**:
   ```bash
   # فتح المشروع في برنامج Xcode تلقائياً / Open iOS project in Xcode
   npm run cap:open:ios
   ```
   * من داخل **Xcode**, اختر جهاز الاختبار أو المحاكي واضغط على زر **Play/Run**، أو قم بعمل **Archive** لنشر التطبيق على متجر آب ستور.

---

## 4️⃣ برنامج الكومبيوتر للويندوز (Windows EXE) 💻
للحصول على برنامج مكتبي ثنائى (.exe) يعمل محليا على نظام ويندوز لتشغيل كاشير المحل مباشرة دون متصفح، نستخدم **Electron**:

To compile a native Windows desktop executable (.exe) to run the system directly offline without any browser, we wrap the `dist` directory using **Electron**.

### خطوات التهيئة السريعة لويندوز / Quick Setup for Windows:
1. **تثبيت حواشي Electron** / **Install Electron development package**:
   ```bash
   npm install electron electron-builder --save-dev
   ```

2. **إنشاء ملف إلكترون الرئيسي `main.cjs`** في المجلد الرئيسي / **Create simple `main.cjs`** in root:
   ```javascript
   // main.cjs
   const { app, BrowserWindow } = require('electron');
   const path = require('path');

   function createWindow() {
     const win = new BrowserWindow({
       width: 1200,
       height: 800,
       webPreferences: {
         nodeIntegration: false,
         contextIsolation: true
       },
       autoHideMenuBar: true
     });

     // تحميل المجلد الجاهز للمشروع / Load compiled dist folder
     win.loadFile(path.join(__dirname, 'dist', 'index.html'));
   }

   app.whenReady().then(createWindow);

   app.on('window-all-closed', () => {
     if (process.platform !== 'darwin') app.quit();
   });
   ```

3. **إضافة أمر التعبئة في `package.json`** / **Add build targets inside your environment**:
   ```json
   "main": "main.cjs",
   "scripts": {
     "dist:win": "npm run build:web && electron-builder --windows"
   }
   ```
   عند تشغيل `npm run dist:win` سيقوم النظام بإنشاء ملف `.exe` تلقائي مستقل بالكامل وخفيف مخصص للتثبيت المكتبي السريع!

---

## 🛠️ حل المشاكل الشائعة / Troubleshooting Guide

### ⚠️ مشكلة الأخطاء في مسار `server.ts` أثناء البناء (esbuild compile errors)
إذا ظهر لك خطأ في سطر الأوامر مثل:
`X [ERROR] Could not resolve "server.ts"`
أو مشاكل مشابهة على نظام Windows، فذلك لأن نظام التشغيل يطلب كتابة المسار بشكل نسبي كامل.

لقد قمنا بحل هذه المشكلة بتحديث أوامر البناء لـ:
1. تعديل الأوامر إلى `./server.ts` (مع النقطة والشرطة المائلة) ليعمل مع جميع أنظمة التشغيل (ويندوز، ماك، ولينكس) بسلاسة.
2. إضافة خيار مستقل لبناء كود الويب فقط وهو `npm run build:web`. عندما تبني للهاتف أو الكمبيوتر، **استخدم دائماً `npm run build:web`** لتفادي محاولة بناء السيرفر الخلفي غير الضروري لتطبيقات الهواتف.

---

## 💡 فوائد هذه المعمارية الموحدة / Benefits of Unified Architecture
1. **تحديث فوري**: عند تعديل ميزة في كود الـ React، يتم تطبيقها تلقائيا على أندرويد وآيفون وويندوز بضغطة زر واحدة وعبر أمر مزامنة بسيط (`npm run cap:sync`).
2. **شاشات نيتف سريعة**: واجهة المستخدم والـ PWA تتميز بالسيولة المطلقة وتتعامل مباشرة مع الميزات الأصلية كالكاميرا لتصوير الباركود ومسحه وطباعة الفواتير.
3. **الدعم دون اتصال (Full Offline Capability)**: لأن الكود مبني بـ IndexedDB وتخزين محلى ذكي، التطبيق يستطيع طباعة التذاكر وإجراء المبيعات بالكامل بدون إنترنت، ويزامن البيانات تلقائيا عند عودة الشبكة مع سيرفر Firebase لجميع الأجهزة المشتركة!
