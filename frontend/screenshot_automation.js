const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

async function takeScreenshots() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const url = 'http://localhost:3000';
    const outDir = path.resolve(__dirname, '..', 'screenshots');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    try {
        console.log(`Loading app at ${url}...`);
        await win.loadURL(url);

        // Initial wait for React & animations
        await new Promise(r => setTimeout(r, 4000));

        // 1. Home View (Media Input)
        console.log('Capturing: Home View');
        let image = await win.capturePage();
        fs.writeFileSync(path.join(outDir, '1_home_view.png'), image.toPNG());

        // 2. New Transcription Modal
        console.log('Opening: New Transcription Modal');
        await win.webContents.executeJavaScript(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New Transcription'));
      if (btn) btn.click();
    `);
        await new Promise(r => setTimeout(r, 1000));
        image = await win.capturePage();
        fs.writeFileSync(path.join(outDir, '2_input_modal.png'), image.toPNG());

        // 3. Settings Menu
        console.log('Opening: Settings Menu');
        await win.webContents.executeJavaScript(`
      // Close modal first
      const closeBtn = document.querySelector('.lucide-x');
      if (closeBtn) closeBtn.closest('button').click();
      
      // Open settings
      setTimeout(() => {
        const settingsIcon = document.querySelector('.lucide-settings');
        if (settingsIcon) settingsIcon.closest('button').click();
      }, 500);
    `);
        await new Promise(r => setTimeout(r, 1500));
        image = await win.capturePage();
        fs.writeFileSync(path.join(outDir, '3_settings_menu.png'), image.toPNG());

        // 4. History Sidebar
        console.log('Opening: History Sidebar');
        await win.webContents.executeJavaScript(`
      // Click outside to close settings (standard behavior we just added)
      document.body.click();
      
      // Open history
      setTimeout(() => {
        const clockIcon = document.querySelector('.lucide-clock');
        if (clockIcon) clockIcon.closest('button').click();
      }, 500);
    `);
        await new Promise(r => setTimeout(r, 2000));
        image = await win.capturePage();
        fs.writeFileSync(path.join(outDir, '4_history_sidebar.png'), image.toPNG());

        // 5. Try to capture Active Player view if history exists
        console.log('Attempting to capture: Active Player View');
        await win.webContents.executeJavaScript(`
      const historyItem = document.querySelector('.group.p-3.rounded-xl'); // First history item
      if (historyItem) historyItem.click();
    `);
        await new Promise(r => setTimeout(r, 3000)); // Wait for media/transcript load
        image = await win.capturePage();
        fs.writeFileSync(path.join(outDir, '5_active_player.png'), image.toPNG());

        console.log(`Success! ${fs.readdirSync(outDir).length} screenshots saved to ${outDir}`);
        app.quit();
        process.exit(0);
    } catch (e) {
        console.error('Screenshot Automation Failed:', e);
        app.quit();
        process.exit(1);
    }
}

app.whenReady().then(takeScreenshots);
