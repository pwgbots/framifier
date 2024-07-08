/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-file-manager.js) provides the GUI
functionality for the diaFRAM File Manager.

*/

/*
Copyright (c) 2024 Delft University of Technology

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

// CLASS GUIFileManager provides the GUI for loading and saving models and
// diagrams and handles the interaction with the MILP solver via POST requests
// to the server.
// NOTE: Because the console-only monitor requires Node.js modules, this
// GUI class does NOT extend its console-only counterpart.


// CLASS GUIFileManager
class GUIFileManager {

  // NOTE: The modal dialogs related to loading and saving a model file
  // are properties of the GUIController because they are activated by
  // buttons on the top menu.

  readModel(event) {
    // Read XML string from input file, decrypt if necessary, and then parse it
    UI.loadModelFromXML(event.target.result);
  }  
  
  loadModel() {
    // Get the XML of the file selected in the Load dialog
    const md = UI.modals.load;
    md.hide();
    try {
      const file = md.element('xml-file').files[0];
      if(!file) return;
      if(file.name.split('.').pop() != 'dia') {
        UI.warn('diaFRAM files should have extension .dia');
      }
      const reader = new FileReader();
      reader.onload = (event) => FILE_MANAGER.readModel(event);
      reader.readAsText(file);
    } catch(err) {
      UI.alert('Error while reading file: ' + err);
    }
  }

  promptToLoad() {
    // Show "Load model" modal
    // @@TO DO: warn user if unsaved changes to current model
    UI.hideStayOnTopDialogs();
    // Update auto-saved model list; if not empty, this will display the
    // "restore autosaved files" button
    AUTO_SAVE.checkForSavedModels();
    // Show the "Load model" dialog
    UI.modals.load.show();
  }

  saveModel() {
    // Save the current model either as a download (directly from the browser),
    // or in the user workspace (via the server) when the Save button is
    // Shift-clicked.
    MODEL.clearSelection();
    // NOTE: Encode hashtags, or they will break the URI.
    this.pushModelToBrowser(MODEL.asXML.replace(/#/g, '%23'));
  }
  
  pushModelToBrowser(xml) {
    // Save model as .dia file.
    UI.setMessage('Model file size: ' + UI.sizeInBytes(xml.length));
    const el = document.getElementById('xml-saver');
    el.href = 'data:attachment/text,' + encodeURI(xml);
    console.log('Encoded file size:', el.href.length);
    el.download = 'model.dia';
    if(el.href.length > 25*1024*1024 &&
        navigator.userAgent.search('Chrome') <= 0) {
      UI.notify('Model file size exceeds browser download limit of 25 MB');
    }
    el.click();
    // Clear the HREF after 3 seconds or it may use a lot of memory.
    setTimeout(
        () => { document.getElementById('xml-saver').href = ''; }, 3000);
    UI.normalCursor();
  }
  
 saveToLocalStorage() {
    // Store model identified by an identifier based on author name and
    // model name
    // (1) autosave is skipped while experiment is running, as it may interfere
    //     with storing run results
    // (2) action will overwrite earlier auto-saved version of this model
    //     unless its name and/or author have been changed in the meantime
    // (3) browser may be configured to prohibit local storage function,
    //     and local storage space is limited (by browser settings)
    try {
      // Store model XML string using its display name as key
      const n = MODEL.displayName;
      console.log('Autosaving', n);
      window.localStorage.setItem(n, MODEL.asXML);
      // Also store the timestamp for this operation
      window.localStorage.setItem(AUTO_SAVE.time_prefix + n, Date.now());
      // Remove the highlighting of the icon on the status bar
      document.getElementById('autosave-btn').classList.remove('stay-activ');
    } catch(err) {
      UI.alert(`Failed to auto-save model: ${err}`);
    }
  }

  loadFromLocalStorage(key) {
    // Retrieve auto-saved model identified by `key`
    // NOTE: browser may be configured to prohibit local storage function
    try {
      const
          ls = window.localStorage,
          xml = ls.getItem(key);
      if(xml) UI.loadModelFromXML(xml);
    } catch(err) {
      UI.alert(`Failed to restore auto-saved model ${key}: ${err}`);
    }
  }
  
  saveDiagramAsSVG(tight) {
    // Output SVG as string with nodes and arrows 100% opaque.
    if(tight) {
      // First align to grid and then fit to size.
      MODEL.alignToGrid();      
      UI.paper.fitToSize(1);
    } else {
      UI.paper.fitToSize();
      MODEL.alignToGrid();      
    }
    this.pushOutSVG(UI.paper.opaqueSVG);
  }
  
  pushOutSVG(svg) {
    const blob = new Blob([svg], {'type': 'image/svg+xml'});
    const e = document.getElementById('svg-saver');
    e.download = 'model.svg';
    e.type = 'image/svg+xml';
    e.href = (window.URL || webkitURL).createObjectURL(blob);
    e.click();
  }  
 
} // END of class GUIFileManager
