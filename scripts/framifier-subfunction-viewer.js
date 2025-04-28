/*
FRAMifier is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (framifier-subfunction-viewer.js) provides the GUI
functionality for the FRAMifier subfunction viewer: the draggable dialog
that allows viewing the diagram for a composite function (activity) in
the main diagram.
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

// CLASS SubfunctionViewer
class SubfunctionViewer {
  constructor() {
    this.dialog = UI.draggableDialog('subfunction');
    UI.resizableDialog('subfunction', 'SUBFUNCTION_VIEWER');
    this.close_btn = document.getElementById('subfunction-close-btn');
    this.title = document.getElementById('subfunction-title');
    this.instruction = document.getElementById('subfunction-instruction');
    // Make toolbar buttons responsive
    this.close_btn.addEventListener('click', (event) => UI.toggleDialog(event));
    // Initialize properties
    this.paper = new Paper('subfunction');
    this.reset();
  }

  reset() {
    this.activity = null;
    this.paper.clear();
    this.visible = false;
  }

  updateDialog() {
    // Resizing dialog needs no special action, but entity may have been
    // deleted or renamed
    if(!this.activity) {
      this.title.innerHTML = 'Subfunction viewer';
      this.instruction.style.display = 'block';
      return;
    }
    this.title.innerHTML = this.activity.displayName;
    this.instruction.style.display = 'none';
    // Draw the diagram for the focal activity.
    this.paper.clear();
    // Prepare to draw all elements in the focal activity.
    const
        vl = this.activity.visibleLinks,
        dvl = this.activity.deepVisibleLinks;
    for(let i = 0; i < this.activity.sub_activities.length; i++) {
      this.paper.drawActivity(this.activity.sub_activities[i]);
    }
    // NOTE: The "deep visible links" are "virtual" link objects that
    // will be recognized as such by the link drawing routine. The are
    // drawn first because their lines will be thicker.
    for(let k in dvl) if(dvl.hasOwnProperty(k)) {
      this.paper.drawLink(dvl[k]);
    }
    for(let i = 0; i < vl.length; i++) {
      this.paper.drawLink(vl[i]);
    }
    // Draw notes last, as they are semi-transparent, and can be quite small.
    for(let i = 0; i < this.activity.notes.length; i++) {
      this.paper.drawNote(this.activity.notes[i]);
    }
    // Resize paper if necessary.
    this.paper.extend();
    // Reset container properties, or scrolling will not work properly.
    this.paper.container.style.width = 'calc(100% - 4px)';
    this.paper.container.style.height = 'calc(100% - 28px)';
  }

  update(a, shift) {
    // Display name of entity under cursor on the infoline, and details
    // in the documentation dialog.
    if(!(a && a instanceof Activity && a.sub_activities.length)) return;
    // NOTE: Update the dialog ONLY when visible and shift is pressed...
    if(shift && this.visible) {
      const oa = this.activity;
      this.activity = a;
      // ... and the activity has changed.
      if(a !== oa) this.updateDialog();
    }
  }
  
} // END of class SubfunctionViewer 
