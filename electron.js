import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  initAutoUpdater();
}

function initAutoUpdater() {

  console.log('Checking for updates...');

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('⬇️ Update available', info.version);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'تحديث جديد',
      message: `يوجد إصدار جديد (${info.version}) وسيتم تنزيله تلقائياً.`,
      buttons: ['موافق']
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);

    console.log(`Downloading ${percent}%`);

    if (mainWindow) {
      mainWindow.setProgressBar(percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {

    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'التحديث جاهز',
      message: `تم تنزيل الإصدار ${info.version} بنجاح.\nهل تريد إعادة تشغيل البرنامج الآن؟`,
      buttons: ['إعادة التشغيل', 'لاحقاً']
    }).then(result => {

      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }

    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ Latest version installed');
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Update Error:', err);
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});