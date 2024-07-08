/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-config.js) defines global constants that specify
the URLs for the solver, and for the sound files that are played when error,
warning or information messages are displayed.
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

// The configuration properties may be altered according to user preferences
const CONFIGURATION = {
    // When decimal comma = TRUE, data copied to clipboard from the chart manager
    // will be written with decimal comma instead of decimal point
    // NOTE: May be overruled by model settings
    decimal_comma: false,
    // Font properties for SVG diagram
    // NOTE: When a font name comprises multiple words, it must be enclosed
    // like so: &quot;Times New Roman&quot;
    default_font_name: 'Arial',
    // Undo stack size limits the number of user actions that can be undone 
    undo_stack_size: 20,
    // The progress needle interval affects the update frequency of the progress
    // needle during tableau construction and while writing the model file that
    // is passed to the solver. On faster machines, the value of this constant
    // can be increased
    progress_needle_interval: 100,
    // Allow some control over the size of activity hexagon
    min_hexagon_size: 80,
  };

// NOTE: Debugging is defined as a global *variable* to permit setting it
// locally to TRUE to trace only in selected parts of the code. When debugging,
// the VM will log a trace of its execution on the browser's console.
// NOTE: for longer runs and larger models, this will slow down the browser,
// the text and objects shown in the browser's console will use large amounts
// of computer memory!
let DEBUGGING = false;

