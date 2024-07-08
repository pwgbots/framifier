/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-monitor.js) provides the GUI functionality
for the diaFRAM Monitor dialog.

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

// CLASS GUIMonitor provides the GUI for the Virtual Machine.
class GUIMonitor {
  constructor() {
    this.console = false;
    this.visible = false;
    // The "shown" flag is used to prevent re-display of the call stack
    this.call_stack_shown = false;
    // Initialize related DOM elements
    this.dialog = UI.draggableDialog('monitor');
    UI.resizableDialog('monitor', 'MONITOR');
    this.close_btn = document.getElementById('monitor-close-btn');
    this.timer = document.getElementById('monitor-timer');
    this.messages_tab = document.getElementById('monitor-msg-tab');
    this.messages_text = document.getElementById('monitor-msg');
    this.variables_tab = document.getElementById('monitor-vbl-tab');
    this.variables_text = document.getElementById('monitor-vbl');
    this.equations_tab = document.getElementById('monitor-eqs-tab');
    this.equations_text = document.getElementById('monitor-eqs');
    this.progress_bar = document.getElementById('monitor-progress-bar');

    // Make toolbar buttons responsive
    this.close_btn.addEventListener(
        'click', (event) => UI.toggleDialog(event));
    this.messages_tab.addEventListener(
        'click', () => MONITOR.updateContent('msg'));
    this.variables_tab.addEventListener(
        'click', () => MONITOR.updateContent('vbl'));
    this.equations_tab.addEventListener(
        'click', () => MONITOR.updateContent('eqs'));

    // Make close button of call stack dialog responsive
    document.getElementById('call-stack-close-btn').addEventListener(
      'click', () => MONITOR.hideCallStack());
    
    this.shown_block = 0;
    // Initially show the messages textarea
    this.tab = 'vbl';
    this.updateContent('msg');
  }
  
  reset() {
    this.shown_block = 0;
    this.last_message_block = 0;
    // Clear monitor's text areas
    this.messages_text.value = '';
    this.variables_text.value = '';
    this.equations_text.value = '';
    // Clear the progress bar
    while(this.progress_bar.firstChild) {
      this.progress_bar.removeChild(this.progress_bar.lastChild);
    }
    this.updateContent('msg');
  }

  updateMonitorTime() {
    // Displays the elapsed time since last reset as (hrs:)mins:secs
    let td = (new Date().getTime() - VM.reset_time) / 1000,
        hrs = Math.floor(td / 3600);
    if(hrs > 0) {
      td -= hrs * 3600;
      hrs += ':';
    } else {
      hrs = '';
    }
    const
        min = Math.floor(td / 60),
        sec = Math.round(td - 60*min),
        t = ('0' + min).slice(-2) + ':' + ('0' + sec).slice(-2);
    this.timer.textContent = hrs + t;
  }
  
  updateBlockNumber(bwr) {
    // Display progres as block number (with round) / number of blocks
    document.getElementById('monitor-blocks').innerText =
        bwr + '/' + VM.nr_of_blocks;
  }
  
  clearProgressBar() {
    // Clear the progress bar
    while(this.progress_bar.firstChild) {
      this.progress_bar.removeChild(this.progress_bar.lastChild);
    }
  }

  addProgressBlock(b, err, time) {
    // Adds a block to the progress bar, and updates the relative block lengths
    let total_time = 0;
    for(let i = 0; i < b; i++) {
      total_time += VM.solver_times[i];
    }
    const
        n = document.createElement('div'),
        ssecs = VM.solver_secs[b - 1];
    n.classList.add('progress-block');
    if(err) n.classList.add('error-pb');
    if(b % 2 == 0) n.classList.add('even-pb');
    n.setAttribute('title',
        `Block #${b} took ${time.toPrecision(3)} seconds` +
            (ssecs ? `\n(solver: ${ssecs} seconds)` : ''));
    n.setAttribute('data-blk', b); 
    n.addEventListener('click',
        (event) => {
            const el = event.target;
            el.classList.add('sel-pb');
            MONITOR.showBlock(el.dataset.blk);
          },
        false);
    this.progress_bar.appendChild(n);
    this.progress_bar.style.width =
        Math.floor(100 * b / VM.nr_of_blocks) + '%';
    const cn = this.progress_bar.childNodes;
    if(cn && this.shown_block > 0 && this.shown_block <= cn.length) {
      cn[this.shown_block - 1].classList.add('sel-pb');
    }
    for(let i = 0; i < cn.length; i++) {
      cn[i].style.width =
          (Math.floor(10000 * VM.solver_times[i] / total_time) / 100) + '%';
    }
  }
  
  showBlock(b) {
    this.shown_block = b;
    const cn = this.progress_bar.childNodes;
    for(let i = 0; i < cn.length; i++) {
      cn[i].classList.remove('sel-pb');
    }
    cn[b - 1].classList.add('sel-pb');
    this.updateContent(this.tab);
  }

  updateDialog() {
    // Implements default behavior for a draggable/resizable dialog
    this.updateContent(this.tab);
  }
  
  updateContent(tab) {
    this.messages_text.value = VM.no_messages;
    this.equations_text.value = VM.no_equations;
    // Legend to variables is not block-dependent.
    this.variables_text.value = '';
    // Show the text area for the selected tab.
    if(this.tab !== tab) {
      let mt = 'monitor-' + this.tab;
      document.getElementById(mt).style.display = 'none';
      document.getElementById(mt + '-tab').classList.remove('sel-tab');
      this.tab = tab;
      mt = 'monitor-' + this.tab;
      document.getElementById(mt).style.display = 'block';
      document.getElementById(mt + '-tab').classList.add('sel-tab');
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
        xlist = [];
    document.getElementById('call-stack-error').innerHTML =
        `ERROR at t=${t}: ` + VM.errorMessage(err);
    for(let i = 0; i < csl; i++) {
      const
          x = VM.call_stack[i],
          ons = x.object.displayName + '|';
      vlist.push(ons + x.attribute);
      // Trim spaces around all object-attribute separators in the expression
      xlist.push(x.text.replace(/\s*\|\s*/g, '|'));
    }
    // Highlight variables where they are used in the expressions
    const vcc = UI.chart_colors.length;
    for(let i = 0; i < xlist.length; i++) {
      for(let j = 0; j < vlist.length; j++) {
        // Ignore selectors, as these may be different per experiment
        const
            vnl = vlist[j].split('|'),
            sel = (vnl.length > 1 ? vnl.pop() : ''),
            attr = (VM.attribute_names[sel] ? '|' + sel : ''),
            vn = vnl.join() + attr,
            vnc = '<span style="font-weight: 600; color: ' +
                `${UI.chart_colors[j % vcc]}">${vn}</span>`;
        xlist[i] = xlist[i].split(vn).join(vnc);
      }
    }
    // Then also color the variables
    for(let i = 0; i < vlist.length; i++) {
      vlist[i] = '<span style="font-weight: 600; color: ' +
        `${UI.chart_colors[i % vcc]}">${vlist[i]}</span>`;
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

  logMessage(block, msg) {
    // Appends a solver message to the monitor's messages textarea
    if(this.messages_text.value === VM.no_messages) {
      // Erase the "(no messages)" if still showing
      this.messages_text.value = '';
    }
    if(this.shown_block === 0 && block !== this.last_message_block) {
      // Clear text area when starting with new block while no block selected
      this.last_message_block = block;
      this.messages_text.value = '';      
    }
    // NOTE: `msg` is appended only if no block has been selected by
    // clicking on the progress bar, or if the message belongs to the
    // selected block
    if(this.shown_block === 0 || this.shown_block === block) {
      this.messages_text.value += msg + '\n';
    }
  }
    
} // END of class GUIMonitor
