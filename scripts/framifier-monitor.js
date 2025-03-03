/*
FRAMifier is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (framifier-monitor.js) provides the functionality
for the FRAMifier Monitor dialog.

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

// CLASS Monitor provides the GUI for the Virtual Machine.
class Monitor {
  constructor() {
    this.console = false;
    this.visible = false;
    // The "shown" flag is used to prevent re-display of the call stack.
    this.call_stack_shown = false;
    // Initialize related DOM elements.
    this.dialog = UI.draggableDialog('monitor');
    UI.resizableDialog('monitor', 'MONITOR');
    this.close_btn = document.getElementById('monitor-close-btn');
    this.timer = document.getElementById('monitor-timer');
    this.messages = document.getElementById('monitor-msg');
    // Make toolbar buttons responsive.
    this.close_btn.addEventListener(
        'click', (event) => UI.toggleDialog(event));
    // Make close button of call stack dialog responsive.
    document.getElementById('call-stack-close-btn').addEventListener(
      'click', () => MONITOR.hideCallStack());
    this.updateDialog();
  }
  
  reset() {
    this.shown_tick = 0;
    this.last_message_tick = 0;
    // Clear message text area.
    this.messages.value = '';  
    this.updateDialog();
    UI.setProgressNeedle(0);
  }

  updateMonitorTime() {
    // Display the elapsed time since last reset as (hrs:)mins:secs.
    let td = (new Date().getTime() - VM.reset_time) / 1000,
        hrs = td / 3600;
    this.timer.innerText = UI.clockTime(hrs);
  }
  
  updateTickNumber(t) {
    // Display progres as tick number / run length.
    document.getElementById('monitor-ticks').innerText =
        `Cycle #${t} (of ${MODEL.run_length})`;
  }
  
  updateDialog() {
    // Show Virtual Machine messages for the selected tick.
    this.messages.value = '(no messages)';
    if(MODEL && VM) {
      const t = (MODEL.solved ? MODEL.t : VM.t);
      this.messages.value = (VM.messages[t] || '(no messages)');
      this.updateTickNumber(t);
    }
  }
  
  showCallStack(t) {
    // Show the error message in the dialog header
    // NOTE: prevent showing again when VM detects multiple errors
    if(this.call_stack_shown) return;
    const
        csl = VM.call_stack.length,
        top = VM.call_stack[csl - 1],
        err = top.vector[t],
        // Make separate lists of variable names and their expressions
        vlist = [],
        xlist = [],
        tlist = [];
    document.getElementById('call-stack-error').innerHTML =
        `ERROR at t=${t}: ` + VM.errorMessage(err);
    for(let i = 0; i < csl; i++) {
      const x = VM.call_stack[i];
      vlist.push(x.object.displayName);
      xlist.push(x.text);
    // @@TO DO: collect name of activity for aspect in scope to display.
      tlist.push('???');
    }
    // Highlight variables where they are used in the expressions
    const
        cc = UI.chart_colors,
        ncc = cc.length;
    for(let i = 0; i < xlist.length; i++) {
      for(let j = 0; j < vlist.length; j++) {
        // Ignore selectors, as these may be different per experiment
        const
            vn = vlist[j],
            vnc = `<span title="Aspect defined for: ${tlist[j]}" style=` +
                `"font-weight: 600; color: ${cc[j % ncc]}">${vn}</span>`;
        xlist[i] = xlist[i].split(vn).join(vnc);
      }
    }
    // Then also color the variables
    for(let i = 0; i < vlist.length; i++) {
      vlist[i] = `<span  title="Aspect defined for: ${tlist[i]}" style=` +
          `"font-weight: 600; color: ${cc[i % ncc]}">${vlist[i]}</span>`;
    }
    // Start without indentation
    let pad = 0;
    // First show the variable being computed
    const tbl = ['<div>', vlist[0], '</div>'];
    // Then iterate upwards over the call stack
    for(let i = 0; i < vlist.length - 1; i++) {
      // Show the expression, followed by the next computed variable
      tbl.push(['<div class="call-stack-row" style="padding-left: ',
        pad, 'px"><div class="call-stack-expr">', xlist[i],
        '</div><div class="call-stack-vbl">&nbsp;\u2937', vlist[i+1],
        '</div></div>'].join(''));
      // Increase indentation
      pad += 8;
    }
    // Show the last expression, highlighting the array-out-of-bounds (if any)
    let last_x = xlist[xlist.length - 1],
        anc = '';
    if(VM.out_of_bounds_array) {
      anc = '<span style="font-weight: 600; color: red">' +
          VM.out_of_bounds_array + '</span>';
      last_x = last_x.split(VM.out_of_bounds_array).join(anc);
    }
    tbl.push('<div class="call-stack-expr" style="padding-left: ' +
        `${pad}px">${last_x}</div>`);
    // Add index-out-of-bounds message if appropriate
    if(anc) {
      tbl.push('<div style="color: gray; margin-top: 8px; font-size: 10px">',
          VM.out_of_bounds_msg.replace(VM.out_of_bounds_array, anc), '</div>');
    }
    // Dump the code for the last expression to the console
    console.log('Code for', top.text, top.code);
    // Show the call stack dialog
    document.getElementById('call-stack-table').innerHTML = tbl.join('');
    document.getElementById('call-stack-modal').style.display = 'block';
    this.call_stack_shown = true;    
  }

  hideCallStack() {
    document.getElementById('call-stack-modal').style.display = 'none';
    this.call_stack_shown = false;    
  }

} // END of class Monitor
