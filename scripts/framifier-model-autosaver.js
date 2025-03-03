/*
FRAMifier is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (framifier-model-autosaver.js) provides the GUI
functionality for the FRAMifier model autosaver.

*/

/*
Copyright (c) 2024-2025 Delft University of Technology

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// CLASS ModelAutoSaver automatically saves the current model at regular time
// intervals.
// NOTE: It seemed to be a good idea to do this in the browser's local storage,
// but this breaks for large model files.
class ModelAutoSaver {
  constructor() {
    // Keep track of time-out interval of auto-saving feature
    this.timeout_id = 0;
    this.time_prefix = '_D_F_R_A_M__A_S_T_$';
    this.interval = 10; // auto-save every 10 minutes
    this.period = 24; // delete models older than 24 hours
    // Overwite defaults if settings still in local storage of browser
    this.purgeSavedModels();
    this.setInterval();
    // Add listeners to GUI elements.
    this.confirm_dialog = document.getElementById('confirm-remove-models');
    document.getElementById('auto-save-clear-btn').addEventListener('click',
        () => AUTO_SAVE.confirm_dialog.style.display = 'block');
    document.getElementById('autosave-do-remove').addEventListener('click',
        () => AUTO_SAVE.removeSavedModels());
    document.getElementById('autosave-cancel').addEventListener('click',
        () => AUTO_SAVE.confirm_dialog.style.display = 'none');
    document.getElementById('restore-cancel').addEventListener('click',
        () => AUTO_SAVE.hideRestoreDialog(false));
    document.getElementById('restore-confirm').addEventListener('click',
        () => AUTO_SAVE.hideRestoreDialog(true));
  }
  
  getSettings() {
    // Reads custom auto-save settings from local storage
    try {
      const item = window.localStorage.getItem('FRAMifier-autosave');
      if(item) {
        const
            mh = item.split('|'),
            m = parseFloat(mh[0]),
            h = parseFloat(mh[1]);
        if(isNaN(m) || isNaN(h)) {
          UI.warn('Invalid local auto-save settings');
        } else {
          this.interval = m;
          this.period = h;
        }
      }
    } catch(err) {
      console.log('No auto-save:', err);
    }  
  }
  
  setSettings() {
    // Writes custom auto-save settings to local storage
    try {
      window.localStorage.setItem('FRAMifier-autosave',
          this.interval + '|' + this.period);
    } catch(err) {
      UI.warn('Failed to write auto-save settings to local storage');
    }  
  }
  
  saveModel() {
    document.getElementById('autosave-btn').classList.add('stay-activ');
    // Use setTimeout to let browser always briefly show the active color
    // even when the model file is small and storing hardly takes time
    setTimeout(() => FILE_MANAGER.saveToLocalStorage(), 300);
  }
  
  setInterval() {
    // Activate the auto-save feature (if interval is configured)
    if(this.timeout_id) clearInterval(this.timeout_id);
    this.getSettings();
    if(this.interval) {
      // Interval is in minutes, so multiply by 60 thousand to get msec
      this.timeout_id = setInterval(
          () => AUTO_SAVE.saveModel(), this.interval * 60000);
    }
  }
  
  purgeSavedModels() {
    // Remove all autosaved models that have been stored beyond the set period
    try {
      for(let key in window.localStorage) {
        if(key.startsWith(this.time_prefix)) {
          const
              name = key.split(this.time_prefix)[1],
              ts = parseInt(window.localStorage.getItem(key)),
              now = Date.now();
          if((now - ts) / 3600000 > this.period) {
            window.localStorage.removeItem(name);
            console.log('Purged model', name, 'from local storage');
            // Also remove the timestamp item
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch(err) {
      console.log('No auto-save:', err);
    }
  }
  
  savedModelList() {
    // Returns autosaved models as array of tuples [model name, time, file size]
    // First purge outdated auto-saved models
    this.purgeSavedModels();
    const list = [];
    try {
      for(let key in window.localStorage) {
        if(key.startsWith(this.time_prefix)) {
          const
              name = key.split(this.time_prefix)[1],
              ts = parseInt(window.localStorage.getItem(key)),
              // Retrieve the item to make sure it exists.
              xml = window.localStorage.getItem(name);
          if(xml && xml.length > 100) {
            let mdate = new Date();
            mdate.setTime(ts);
            const offset = mdate.getTimezoneOffset();
            mdate = new Date(mdate.getTime() - (offset * 60 * 1000));
            mdate = mdate.toISOString().split(':');
            mdate = mdate[0].replace('T', ' ') + ':' + mdate[1];
            list.push([name, mdate, UI.sizeInBytes(xml.length)]);
          } else {
            console.log('Autosaved model not found or invalid:', xml);
          }
        }
      }
      // NOTE: sort models in reverse time order (most recent on top)
      list.sort((a, b) => {
          if(a[1] > b[1]) return -1;
          if(a[1] < b[1]) return 1;
          return 0;
        });
    } catch(err) {
      console.log('No auto-save:', err);
    }
    return list;
  }
  
  checkForSavedModels() {
    const ml = this.savedModelList();
    document.getElementById('autosave-btn').title =
        pluralS(ml.length, 'auto-saved model');
  }
  
  removeSavedModels() {
    const ml = this.savedModelList();
    for(let i = 0; i < ml.length; i++) {
      const n = ml[i][0];
      window.localStorage.removeItem(n);
      window.localStorage.removeItem(this.time_prefix + n);
    }
    this.hideRestoreDialog(true);
  }
  
  deleteSavedModel(n) {
    window.localStorage.removeItem(n);
    window.localStorage.removeItem(this.time_prefix + n);
    const ml = this.savedModelList();
    if(ml.length > 0) {
      this.showRestoreDialog();
    } else {
      this.hideRestoreDialog(true);  
    }
  }
  
  showRestoreDialog() {
    // Shows list of auto-saved models; clicking on one will load it
    const ml = this.savedModelList();
    document.getElementById('load-modal').style.display = 'none';
    // Contruct the table to select from
    let html = '';
    for(let i = 0; i < ml.length; i++) {
      const bytes = ml[i][2].split(' ');
      html += ['<tr class="dataset" style="color: gray" ',
          'onclick="AUTO_SAVE.restoreModel(\'',
          ml[i][0],'\');"><td class="restore-name">', ml[i][0], '</td><td>',
          ml[i][1], '</td><td style="text-align: right">',
          bytes[0], '</td><td>', bytes[1],
          '</td><td><img class="del-asm-btn" src="images/delete.png" ',
          'onclick="AUTO_SAVE.deleteSavedModel(\'',
          ml[i][0], '\')"></td></tr>'].join('');
    }
    document.getElementById('restore-table').innerHTML = html;
    // Adjust dialog height (max-height will limit list to 10 lines)
    document.getElementById('restore-dlg').style.height =
        (45 + 19 * ml.length) + 'px';
    document.getElementById('confirm-remove-models').style.display = 'none';
    // Fill text input fields with present settings
    document.getElementById('auto-save-minutes').value = this.interval;
    document.getElementById('auto-save-hours').value = this.period;
    // Show remove button only if restorable files exits
    const
      ttl = document.getElementById('restore-dlg-title'),
      sa = document.getElementById('restore-scroll-area'),
      btn = document.getElementById('auto-save-clear-btn');
    if(ml.length) {
      ttl.innerHTML = 'Restore auto-saved model';
      sa.style.display = 'block';
      btn.style.display = 'block';
    } else {
      ttl.innerHTML = 'Auto-save settings (for this browser)';
      sa.style.display = 'none';
      btn.style.display = 'none';
    }
    document.getElementById('restore-modal').style.display = 'block';
  }
  
  restoreModel(key) {
    FILE_MANAGER.loadFromLocalStorage(key);
    this.hideRestoreDialog();
  }
  
  hideRestoreDialog(save=true) {
    // Close the restore auto-save model dialog.
    document.getElementById('confirm-remove-models').style.display = 'none';
    // NOTE: Cancel button or ESC will pass `cancel` as FALSE => do not save
    if(!save) {
      document.getElementById('restore-modal').style.display = 'none';
      return;
    }
    // Validate settings
    let m = this.interval,
        h = this.period,
        e = document.getElementById('auto-save-minutes');
    m = parseInt(e.value);
    if(!isNaN(m)) {
      e = document.getElementById('auto-save-hours');
      h = parseInt(e.value);
      if(!isNaN(h)) {
        // If valid, store in local storage of browser
        if(m !== this.interval || h !== this.period) {
          UI.notify('New auto-save settings stored in browser');
          this.interval = m;
          this.period = h;
          this.setSettings();
        }
        document.getElementById('restore-modal').style.display = 'none';
        return;
      }
    }
    UI.warn('Invalid auto-save settings');
    e.focus();
  }

} // END of class ModelAutoSaver


