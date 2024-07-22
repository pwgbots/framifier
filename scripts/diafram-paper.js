/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-paper.js) provides the SVG diagram-drawing
functionality for the diaFRAM model editor.
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

// CLASS Shape
// A shape is a group of one or more SVG elements with a time-based ID
// number, and typically represents an entity in a diaFRAM model diagram.
class Shape {
  constructor() {
    this.id = randomID();
    if(UI.paper) {
      // Create a new SVG element, but do not add it to the main SVG object.
      this.element = UI.paper.newSVGElement('svg');
      this.element.id = this.id;
    }
  }
  
  clear() {
    // Remove all composing elements from this shape's SVG object.
    UI.paper.clearSVGElement(this.element);
  }

  appendToDOM() {
    // Append this shape's SVG element to the main SVG object.
    const el = document.getElementById(this.id);
    // Replace existing element, if it exists.
    if(el) UI.paper.svg.removeChild(el);
    // Add the new version.
    UI.paper.svg.appendChild(this.element);
  }
  
  removeFromDOM() {
    // Remove this shape's SVG element from the main SVG object.
    const el = document.getElementById(this.id);
    if(el) UI.paper.svg.removeChild(el);
    this.element = null;
  }

  addPath(path, attrs) {
    // Append a path to the SVG element for this shape.
    const el = UI.paper.newSVGElement('path');
    el.setAttribute('d', path.join(''));
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }
  
  addNumber(x, y, number, attrs) {
    // Append SVG for a numeric string centered at (x, y).
    // NOTES:
    // (1) A numeric string is scaled to a fixed width per character
    //     (0.65*font size).
    // (2) If anchor is not "middle", x is taken as the border to align
    //     against.
    // (3) Calling routines may pass a number instead of a string, so
    //     "lines" is forced to a string.
    number = '' + number;
    // Assume default font size and weight unless specified.
    const
        size = (attrs.hasOwnProperty('font-size') ?
            attrs['font-size'] : 8),
        weight = (attrs.hasOwnProperty('font-weight') ?
            attrs['font-weight'] : 400),
        fh = UI.paper.font_heights[size],
        el = UI.paper.newSVGElement('text');
    el.setAttribute('x', x);
    el.setAttribute('y', y + 0.35*fh);
    el.setAttribute('textLength',
        UI.paper.numberSize(number, size, weight).width);
    el.textContent = number;
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }

  addText(x, y, lines, attrs) {
    // Append SVG for a (multi)string centered at (x, y).
    // NOTES:
    // (1) If anchor is not "middle", x is taken as the border to align
    //     against.
    // (2) Calling routines may pass a number, a string or an array.
    if(!Array.isArray(lines)) {
      // Force `lines` into a string, and then split it at newlines.
      lines = ('' + lines).split('\n');
    }
    // Assume default font size unless specified.
    const size = (attrs.hasOwnProperty('font-size') ? attrs['font-size'] : 8);
    // Vertically align text such that y is at its center.
    // NOTE: Subtract 30% of 1 line height more, or the text is consistently
    // too low.
    const
        fh = UI.paper.font_heights[size],
        cy = y - (lines.length + 0.3) * fh/2,
        el = UI.paper.newSVGElement('text');
    el.setAttribute('x', x);
    el.setAttribute('y', cy);
    UI.paper.addSVGAttributes(el, attrs);
    for(let i = 0; i < lines.length; i++) {
      const ts = UI.paper.newSVGElement('tspan');
      ts.setAttribute('x', x);
      ts.setAttribute('dy', fh);
      ts.setAttribute('pointer-events', 'inherit');
      // NOTE: Non-breaking space must now (inside a TSPAN) be converted
      // to normal spaces, or they will be rendered as '&nbsp;' and this
      // will cause the SVG to break when it is inserted as picture into
      // an MS Word document.
      ts.textContent = lines[i].replaceAll('\u00A0', ' ');
      el.appendChild(ts);
    }
    this.element.appendChild(el);
    return el;
  }

  addRect(x, y, w, h, attrs) {
    // Add a rectangle with center point (x, y), width w, and height h.
    // NOTE: For a "roundbox", pass the corner radii rx and ry.
    const el = UI.paper.newSVGElement('rect');
    el.setAttribute('x', x - w/2);
    el.setAttribute('y', y - h/2);
    el.setAttribute('width', Math.max(0, w));
    el.setAttribute('height', Math.max(0, h));
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }

  addCircle(x, y, r, attrs) {
    // Add a circle with center point (x, y) and radius r.
    const el = UI.paper.newSVGElement('circle');
    el.setAttribute('cx', x);
    el.setAttribute('cy', y);
    el.setAttribute('r', r);
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }

  addEllipse(x, y, rx, ry, attrs) {
    // Add an ellipse with center point (x, y), and specified radii and
    // attributes.
    const el = UI.paper.newSVGElement('ellipse');
    el.setAttribute('cx', x);
    el.setAttribute('cy', y);
    el.setAttribute('rx', rx);
    el.setAttribute('ry', ry);
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }

  addSVG(x, y, attrs) {
    // Add an SVG subelement with top-left (x, y) and specified attributes.
    const el = UI.paper.newSVGElement('svg');
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    UI.paper.addSVGAttributes(el, attrs);
    this.element.appendChild(el);
    return el;
  }
  
  addConnector(x, y, cl, id, ctxl) {
    // Add a connector circle with the letter `l`.
    // NOTES:
    // (1) The ID of the owner of this shape (activity) is passed as a
    //     data attribute `id` so that the SVG element "knows" for which
    //     activity the aspect must be displayed.
    // (2) The `aspect` data attribute is likewise set to the connector
    //     letter `cl`.
    // (3) The contextual links for this connector are passed by the list
    //     `ctxl`. If this list is not empty, the connector is displayed
    //     white-on-dark gray, and a mouseover event is added.
    let fg = 'black',
        bg = 'white',
        n = ctxl.length,
        a = MODEL.activities[id],
        incx = a.incoming_expressions[cl],
        incxd = (incx && incx.defined),
        sw = 0.75,
        fw = 400,
        sc = UI.color.rim,
        ctxlids = ctxl.map((l) => l.identifier).join(';');
    if(incxd) {
      sw = 1.5;
      fw = 900;
      sc = 'black';
    }
    if(n) {
      fg = 'white';
      bg = '#9090a0';
      // Feedback link(s) are indicated by a black background.
      for(let i = 0; i < n; i++) {
        if(ctxl[i].is_feedback) {
          bg = 'black';
          break;
        }
      }
    }
    const c = this.addCircle(x, y, 6,
        {fill: bg, stroke: sc, 'stroke-width': sw,
            'font-weight': fw, 'data-id': id, 'data-aspect': cl,
            'data-bg': bg, 'data-fg': fg, 'data-ix': incxd,
            'data-lids': ctxlids});
    this.addText(x, y, cl,
        {'font-family': 'monospace', 'fill': fg, 'font-size': 9});
    // Make SVG elements responsive to cursor event.
    c.setAttribute('pointer-events', 'auto');
    // Only the Output connector can be a tail connector, but for other
    // connectors an incoming expression can be defined.
    c.setAttribute('cursor', 'pointer');
    UI.connector(c);
    if(ctxlids) {
      // Add a mouseover event that will display context links in the
      // documentation browser.
      c.addEventListener('mouseover', (event) => {
          DOCUMENTATION_MANAGER.showContextLinks(event);
        });
    }
    return this.element;
  }

  moveTo(x, y) {
    const el = document.getElementById(this.id);
    if(el) {
      el.setAttribute('x', x);
      el.setAttribute('y', y);
    }
  }
  
} // END of class Shape


// CLASS Paper (the SVG diagram)
class Paper {
  constructor() {
    this.svg = document.getElementById('svg-root');
    this.container = document.getElementById('cc');
    this.height = 100;
    this.width = 200;
    this.zoom_factor = 1;
    this.zoom_label = document.getElementById('zoom');
    // Deep links are drawn but not model entities that will be redrawn,
    // so maintain a lookup object to clear their shapes when the model
    // is redrawn.
    this.drawn_deep_links = {};
    // Initialize colors used when drawing the model diagram
    this.palette = {
      // Selected model elements are bright red
      select: '#ff0000',    
      // Activities have dark gray rim...
      rim: '#606070',
      // ... and state-dependent fill colors
      fg_fill: '#ffffff',
      bg_fill: '#e0e0f0',
      // Font colors for entities.
      actor_font: '#40a0e0', // medium blue
      connecting: '#00b0ff', // bright blue
      connecting_fill: '#80ffff', // light cyan
      active: '#40b040', // middle green
      activated: '#60b060', // brighter green
      value_fill: '#d0f0ff',
      // All notes have thin gray rim, similar to other model diagram
      // elements, that turns red when a note is selected.
      note_rim: '#909090',  // medium gray
      note_font: '#2060a0', // medium dark gray-blue
      // Notes are semi-transparent yellow (will have opacity 0.5).
      note_fill: '#ffff80',
      note_band: '#ffd860',  
      // Computation errors in expressions are signalled by displaying
      // the result in bright red, typically the general error symbol (X).
      VM_error: '#e80000',
      // Background color of GUI dialogs.
      dialog_background: '#f4f8ff'
    };
    // Standard SVG URL
    this.svg_url = 'http://www.w3.org/2000/svg';
    this.clear();
  }
  
  get opaqueSVG() {
    // Return SVG as string with nodes and arrows 100% opaque.
    // NOTE: The semi-transparent ovals behind rates on links have
    // opacity 0.8 and hence are not affected.
    return this.svg.outerHTML.replaceAll(' opacity="0.9"', ' opacity="1"');
  }
  
  clear() {
    // First, clear the entire SVG
    this.clearSVGElement(this.svg);
    // Set default style properties
    this.svg.setAttribute('font-family', this.font_name);
    this.svg.setAttribute('font-size', 8);
    this.svg.setAttribute('text-anchor', 'middle');
    this.svg.setAttribute('alignment-baseline', 'middle');
    // Add marker definitions
    const
        defs = this.newSVGElement('defs'),
        // Wedge arrow tips have no baseline
        wedge = 'M0,0 L10,5 L0,10 L0,8.5 L8.5,5 L0,1.5 z',
        // link arrows have a flat, "chevron-style" tip
        chev = 'M0,0 L10,5 L0,10 L4,5 z';

    // NOTE: standard SVG elements are defined as properties of this paper
    this.size_box = '__c_o_m_p_u_t_e__b_b_o_x__ID*';
    this.drag_line = '__d_r_a_g__l_i_n_e__ID*';
    this.drag_rect = '__d_r_a_g__r_e_c_t__ID*';
    let id = 'c_h_e_v_r_o_n__t_i_p__ID*';
    this.chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 8, this.palette.rim);
    id = 's_e_l_e_c_t_e_d__c_h_e_v_r_o_n__t_i_p__ID*';
    this.selected_chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 10, this.palette.select);
    id = 'c_o_n_n_e_c_t_i_n_g__c_h_e_v_r_o_n__t_i_p__ID*';
    this.connecting_chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 10, this.palette.connecting);
    id = 'f_e_e_d_b_a_c_k__c_h_e_v_r_o_n__t_i_p__ID*';
    this.feedback_chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 8, 'rgb(0, 0, 0)');
    id = 'g_r_e_e_n__c_h_e_v_r_o_n__t_i_p__ID*';
    this.green_chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 8, this.palette.active);
    id = 'd_e_e_p__c_h_e_v_r_o_n__t_i_p__ID*';
    this.deep_chevron = `url(#${id})`;
    this.addMarker(defs, id, chev, 10, 'rgb(128, 128, 144)');
    id = 't_e_x_t__s_h_a_d_o_w__ID*';
    this.text_shadow_filter = `filter: url(#${id})`;
    this.addShadowFilter(defs, id, 'rgb(255,255,255)', 2);
    id = 'd_o_c_u_m_e_n_t_e_d__ID*';
    this.documented_filter = `filter: url(#${id})`;
    this.addShadowFilter(defs, id, 'rgb(50,120,255)', 2);
    id = 't_a_r_g_e_t__ID*';
    this.target_filter = `filter: url(#${id})`;
    this.addShadowFilter(defs, id, 'rgb(250,125,0)', 8);
    id = 'a_c_t_i_v_a_t_e_d__ID*';
    this.activated_filter = `filter: url(#${id})`;
    this.addShadowFilter(defs, id, 'rgb(0,255,0)', 12);
    id = 'a_c_t_i_v_e__l_i_n_k__ID*';
    this.active_link_filter = `filter: url(#${id}); opacity: 1`;
    this.addShadowFilter(defs, id, 'rgb(0,255,0)', 10);
    this.svg.appendChild(defs);
    this.changeFont(CONFIGURATION.default_font_name);
  }

  newSVGElement(type) {
    // Creates and returns a new SVG element of the specified type
    const el = document.createElementNS(this.svg_url, type);
    if(!el) throw UI.ERROR.CREATE_FAILED;
    // NOTE: by default, SVG elements should not respond to any mouse events!
    el.setAttribute('pointer-events', 'none');
    return el;
  }
  
  clearSVGElement(el) {
    // Clear all sub-nodes of the specified SVG node.
    if(el) while(el.lastChild) el.removeChild(el.lastChild);
  }
  
  addSVGAttributes(el, obj) {
    // Add attributes specified by `obj` to (SVG) element `el`.
    for(let prop in obj) {
      if(obj.hasOwnProperty(prop)) el.setAttribute(prop, obj[prop]);
    }
  }
  
  addMarker(defs, mid, mpath, msize, mcolor) {
    // Defines SVG for markers used to draw arrows and bound lines
    const marker = this.newSVGElement('marker');
    let shape = null;
    this.addSVGAttributes(marker,
        {id: mid, viewBox: '0,0 10,10', markerWidth: msize, markerHeight: msize,
            refX: 5, refY: 5, orient: 'auto-start-reverse',
            markerUnits: 'userSpaceOnUse', fill: mcolor});
    if(mpath == 'ellipse') {
      shape = this.newSVGElement('ellipse');
      this.addSVGAttributes(shape,
          {cx: 5, cy: 5, rx: 4, ry: 4, stroke: 'none'});
    } else {
      shape = this.newSVGElement('path');
      shape.setAttribute('d', mpath);
    }
    shape.setAttribute('stroke-linecap', 'round');
    marker.appendChild(shape);
    defs.appendChild(marker);
  }
  
  addGradient(defs, gid, color1, color2) {
    const gradient = this.newSVGElement('linearGradient');
    this.addSVGAttributes(gradient,
        {id: gid, x1: '0%', y1: '0%', x2: '100%', y2: '0%'});
    let stop = this.newSVGElement('stop');
    this.addSVGAttributes(stop,
        {offset: '0%', style: 'stop-color:' + color1 + ';stop-opacity:1'});
    gradient.appendChild(stop);
    stop = this.newSVGElement('stop');
    this.addSVGAttributes(stop,
        {offset: '100%', style:'stop-color:' + color2 + ';stop-opacity:1'});
    gradient.appendChild(stop);
    defs.appendChild(gradient);
  }
  
  addShadowFilter(defs, fid, color, radius) {
    // Defines SVG for filters used to highlight elements
    const filter = this.newSVGElement('filter');
    this.addSVGAttributes(filter, {id: fid, filterUnits: 'userSpaceOnUse'});
    const sub = this.newSVGElement('feDropShadow');
    this.addSVGAttributes(sub,
        {dx:0, dy:0, 'flood-color': color, 'stdDeviation': radius});
    filter.appendChild(sub);
    defs.appendChild(filter);
  }
  
  addShadowFilter2(defs, fid, color, radius) {
    // Defines SVG for more InkScape compatible filters used to highlight elements
    const filter = this.newSVGElement('filter');
    this.addSVGAttributes(filter, {id: fid, filterUnits: 'userSpaceOnUse'});
    let sub = this.newSVGElement('feGaussianBlur');
    this.addSVGAttributes(sub, {'in': 'SourceAlpha', 'stdDeviation': radius});
    filter.appendChild(sub);
    sub = this.newSVGElement('feOffset');
    this.addSVGAttributes(sub, {dx: 0, dy: 0, result: 'offsetblur'});
    filter.appendChild(sub);
    sub = this.newSVGElement('feFlood');
    this.addSVGAttributes(sub, {'flood-color': color, 'flood-opacity': 1});
    filter.appendChild(sub);
    sub = this.newSVGElement('feComposite');
    this.addSVGAttributes(sub, {in2: 'offsetblur', operator: 'in'});
    filter.appendChild(sub);
    const merge = this.newSVGElement('feMerge');
    sub = this.newSVGElement('feMergeNode');
    merge.appendChild(sub);
    sub = this.newSVGElement('feMergeNode');
    this.addSVGAttributes(sub, {'in': 'SourceGraphic'});
    merge.appendChild(sub);
    filter.appendChild(merge);
    defs.appendChild(filter);
  }
  
  changeFont(fn) {
    // For efficiency, this computes for all integer font sizes up to 16 the
    // height (in pixels) of a string, and also the relative font weight factors 
    // (relative to the normal font weight 400)
    this.font_name = fn;
    this.font_heights = [0];
    this.weight_factors = [0];
    // Get the SVG element used for text size computation
    const el = this.getSizingElement();
    // Set the (new) font name
    el.style.fontFamily = this.font_name;
    el.style.fontWeight = 400;
    // Calculate height and average widths for font sizes 1, 2, ... 16 px
    for(let i = 1; i <= 16; i++) {
      el.style.fontSize = i + 'px';
      // Use characters that probably affect height the most
      el.textContent = '[hq_|';
      this.font_heights.push(el.getBBox().height);
    }
    // Approximate how the font weight will impact string length relative
    // to normal. NOTE: only for 8px font, as this is the default size
    el.style.fontSize = '8px';
    // NOTE: Use a sample of most frequently used characters (digits!)
    // to estimate width change
    el.textContent = '0123456789%+-=<>.';
    const w400 = el.getBBox().width;
    for(let i = 1; i < 10; i++) {
      el.style.fontWeight = 100*i;
      this.weight_factors.push(el.getBBox().width / w400);
    }
  }

  numberSize(number, fsize=8, fweight=400) {
    // Returns the boundingbox {width: ..., height: ...} of a numeric
    // string (in pixels)
    // NOTE: this routine is about 500x faster than textSize because it
    // does not use the DOM tree
    // NOTE: using parseInt makes this function robust to font sizes passed
    // as strings (e.g., "10px")
    fsize = parseInt(fsize);
    // NOTE: 'number' may indeed be a number, so concatenate with '' to force
    // it to become a string
    const
        ns = '' + number,
        fh = this.font_heights[fsize],
        fw = fh / 2;
    let w = 0, m = 0;
    // Approximate the width of the Unicode characters representing
    // special values
    if(ns === '\u2047') {
      w = 8; // undefined (??)
    } else if(ns === '\u25A6' || ns === '\u2BBF' || ns === '\u26A0') {
      w = 6; // computing, not computed, warning sign
    } else {
      // Assume that number has been rendered with fixed spacing
      // (cf. addNumber method of class Shape)
      w = ns.length * fw;
      // Decimal point and minus sign are narrower
      if(ns.indexOf('.') >= 0) w -= 0.6 * fw;
      if(ns.startsWith('-')) w -= 0.55 * fw;
      // Add approximate extra length for =, % and special Unicode characters
      if(ns.indexOf('=') >= 0) {
        w += 0.2 * fw;
      } else {
        // LE, GE, undefined (??), or INF are a bit wider
        m = ns.match(/%|\u2264|\u2265|\u2047|\u221E/g);
        if(m) {
          w += m.length * 0.25 * fw;
        }
        // Ellipsis (may occur between process bounds) is much wider
        m = ns.match(/\u2026/g);
        if(m) w += m.length * 0.6 * fw;
      }
    }
    // adjust for font weight
    return {width: w * this.weight_factors[Math.round(fweight / 100)],
        height: fh};
  }
  
  textSize(string, fsize=8, fweight=400) {
    // Returns the boundingbox {width: ..., height: ...} of a string (in pixels) 
    // NOTE: uses the invisible SVG element that is defined specifically
    // for text size computation
    // NOTE: text size calculation tends to slightly underestimate the
    // length of the string as it is actually rendered, as font sizes
    // appear to be rounded to the nearest available size.
    const el = this.getSizingElement();
    // Accept numbers and strings as font sizes -- NOTE: fractions are ignored!
    el.style.fontSize = parseInt(fsize) + 'px';
    el.style.fontWeight = fweight;
    el.style.fontFamily = this.font_name;
    let w = 0,
        h = 0;
    // Consider the separate lines of the string
    const
        lines = ('' + string).split('\n'),  // Add '' in case string is a number
        ll = lines.length;
    for(let i = 0; i < ll; i++) {
      el.textContent = lines[i];
      const bb = el.getBBox();
      w = Math.max(w, bb.width);
      h += bb.height;
    }
    return {width: w, height: h};
  }
  
  removeInvisibleSVG() {
    // Removes SVG elements used by the user interface (not part of the model)
    let el = document.getElementById(this.size_box);
    if(el) this.svg.removeChild(el);
    el = document.getElementById(this.drag_line);
    if(el) this.svg.removeChild(el);
    el = document.getElementById(this.drag_rect);
    if(el) this.svg.removeChild(el);
  }

  getSizingElement() {
    // Returns the SVG sizing element, or creates it if not found
    let el = document.getElementById(this.size_box);
    // Create it if not found
    if(!el) {
      // Append an invisible text element to the SVG
      el = document.createElementNS(this.svg_url, 'text');
      if(!el) throw UI.ERROR.CREATE_FAILED;
      el.id = this.size_box;
      el.style.opacity = 0;
      this.svg.appendChild(el);
    }
    return el;
  }

  fitToSize(margin=30) {
    // Adjust the dimensions of the main SVG to fit the graph plus 15px margin
    // all around
    this.removeInvisibleSVG();
    const
        bb = this.svg.getBBox(),
        w = bb.width + margin,
        h = bb.height + margin;
    if(w !== this.width || h !== this.height) {
      MODEL.translateGraph(-bb.x + margin / 2, -bb.y + margin);
      this.width = w;
      this.height = h;
      this.svg.setAttribute('width', this.width);
      this.svg.setAttribute('height', this.height);
      this.zoom_factor = 1;
      this.zoom_label.innerHTML = Math.round(100 / this.zoom_factor) + '%';
      this.extend(margin);
    }
  }

  extend(margin=30) {
    // Adjust the paper size to fit all objects WITHOUT changing the origin (0, 0)
    // NOTE: keep a minimum page size to keep the scrolling more "natural"
    this.removeInvisibleSVG();
    const
        bb = this.svg.getBBox(),
        // Let `w` and `h` be the actual width and height in pixels
        w = bb.x + bb.width + margin,
        h = bb.y + bb.height + margin,
        // Let `ccw` and `cch` be the size of the scrollable area
        ccw = w / this.zoom_factor,
        cch = h / this.zoom_factor;
    if(this.zoom_factor >= 1) {
      this.width = w;
      this.height = h;
      this.svg.setAttribute('width', this.width);
      this.svg.setAttribute('height', this.height);
      // Reduce the image by making the view box larger than the paper
      const
          zw = w * this.zoom_factor,
          zh = h * this.zoom_factor;
      this.svg.setAttribute('viewBox', ['0 0', zw, zh].join(' '));
    } else {
      // Enlarge the image by making paper larger than the viewbox...
      this.svg.setAttribute('width', ccw / this.zoom_factor);
      this.svg.setAttribute('height', cch / this.zoom_factor);
      this.svg.setAttribute('viewBox', ['0 0', ccw, cch].join(' '));
    }
    // ... while making the scrollable area smaller (if ZF > 1)
    // c.q. larger (if ZF < 1)
    this.container.style.width = (this.width / this.zoom_factor) + 'px';
    this.container.style.height = (this.height / this.zoom_factor) + 'px';
  }
  
  //
  // ZOOM functionality
  //

  doZoom(z) {
    this.zoom_factor *= Math.sqrt(z);
    document.getElementById('zoom').innerHTML =
        Math.round(100 / this.zoom_factor) + '%';
    this.extend();
  }
  
  zoomIn() {
    if(UI.buttons.zoomin && !UI.buttons.zoomin.classList.contains('disab')) {
      // Enlarging graph by more than 200% would seem not functional
      if(this.zoom_factor > 0.55) this.doZoom(0.5);
    }
  }
  
  zoomOut() {
    if(UI.buttons.zoomout && !UI.buttons.zoomout.classList.contains('disab')) {
      // Reducing graph by to less than 25% would seem not functional.
      if(this.zoom_factor <= 4) this.doZoom(2);
    }
  }
  
  cursorPosition(x, y) {
    // Return [x, y] in diagram coordinates.
    const
        rect = this.container.getBoundingClientRect(),
        top = rect.top + window.scrollY + document.body.scrollTop, 
        left = rect.left + window.scrollX + document.body.scrollLeft;
    x = Math.max(0, Math.floor((x - left) * this.zoom_factor));
    y = Math.max(0, Math.floor((y - top) * this.zoom_factor));
    return [x, y];
  }

  //
  // Metods for visual feedback while linking or selecting
  //

  dragLineToCursor(x1, y1, x2, y2) {
    // NOTE: Does not remove element; only updates path and opacity.
    let el = document.getElementById(this.drag_line);
    // Create it if not found
    if(!el) {
      el = this.newSVGElement('path');
      el.id = this.drag_line;
      el.style.opacity = 0;
      el.style.fill = 'none';
      el.style.stroke = UI.color.connecting;
      el.style.strokeWidth = 1.5;
      el.style.strokeDasharray = UI.sda.dash;
      el.style.strokeLinecap = 'round';
      el.style.markerEnd = this.connecting_chevron;
      this.svg.appendChild(el);
    }
    const
        // Control points shoud make the curve stand out, so use 25% of
        // the Euclidean distance between the end points as "stretch".
        ed = 10 + Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) / 4,
        // FROM control point should bend the curve around the FROM activity.
        fcx = x1 + ed,
        fcy = y1;
        // TO control point is endpoint, or depends on relative position
        // of the TO connector.
    let tcx = x2,
        tcy = y2;
    if(UI.to_connector && UI.to_activity) {
      const
          tasp = UI.to_connector.dataset.aspect,
          angle = 'ORPITC'.indexOf(tasp) * Math.PI / 3,
          tact = UI.to_activity,
          r = tact.width * 0.55 + ed;
      tcx = tact.x + Math.cos(angle) * r;
      tcy = tact.y + Math.sin(angle) * r;
    }
    el.setAttribute('d',
        `M${x1},${y1}C${fcx},${fcy},${tcx},${tcy},${x2},${y2}`);
    el.style.opacity = 1;
    this.adjustPaperSize(x2, y2);
  }
  
  adjustPaperSize(x, y) {
    if(this.zoom_factor < 1) return;
    const
        w = parseFloat(this.svg.getAttribute('width')),
        h = parseFloat(this.svg.getAttribute('height'));
    if(x <= w && y <= h) return;
    if(x > w) {
      this.svg.setAttribute('width', x);
      this.width = x;
      this.container.style.width = (x / this.zoom_factor) + 'px';
    }
    if(y > h) {
      this.svg.setAttribute('height', y);
      this.height = y;
      this.container.style.height = (y / this.zoom_factor) + 'px';
    }
    this.svg.setAttribute('viewBox',
        ['0 0', this.width * this.zoom_factor,
            this.height * this.zoom_factor].join(' '));
  }
  
  hideDragLine() {
    const el = document.getElementById(this.drag_line);
    if(el) el.style.opacity = 0;
  }

  dragRectToCursor(ox, oy, dx, dy) {
    // NOTE: does not remove element; only updates path and opacity
    let el = document.getElementById(this.drag_rect);
    // Create it if not found
    if(!el) {
      el = this.newSVGElement('rect');
      el.id = this.drag_rect;
      el.style.opacity = 0;
      el.style.fill = 'none';
      el.style.stroke = 'red';
      el.style.strokeWidth = 1.5;
      el.style.strokeDasharray = UI.sda.dash;
      el.setAttribute('rx', 0);
      el.setAttribute('ry', 0);
      this.svg.appendChild(el);
    }
    let lx = Math.min(ox, dx),
        ty = Math.min(oy, dy),
        rx = Math.max(ox, dx),
        by = Math.max(oy, dy);
    el.setAttribute('x', lx);
    el.setAttribute('y', ty);
    el.setAttribute('width', rx - lx);
    el.setAttribute('height', by - ty);
    el.style.opacity = 1;
    this.adjustPaperSize(rx, by);
  }
  
  hideDragRect() {
    const el = document.getElementById(this.drag_rect);
    if(el) { el.style.opacity = 0; }
  }
  
  //
  //  Auxiliary methods used while drawing shapes
  //
  
  arc(r, srad, erad) {
    // Returns SVG path code for an arc having radius `r`, start angle `srad`,
    // and end angle `erad`
    return 'a' + [r, r, 0, 0, 1, r * Math.cos(erad) - r * Math.cos(srad),
        r * Math.sin(erad) - r * Math.sin(srad)].join(',');
  }

  bezierPoint(a, b, c, d, t) {
    // Returns the point on a cubic Bezier curve from `a` to `d` with control
    // points `b` and `c`, and `t` indicating the relative distance from `a`
    // as a fraction between 0 and 1. NOTE: the four points must be represented
    // as lists [x, y]
    function interPoint(a, b, t) {
      // Local function that performs linear interpolation between two points
      // `a` = [x1, y1] and `b` = [x2, y2] when parameter `t` indicates
      // the relative distance from `a` as a fraction between 0 and 1
      return  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    // Calculate the Bezier points
    const ab = interPoint(a, b, t),
          bc = interPoint(b, c, t),
          cd = interPoint(c, d, t);
    return interPoint(interPoint(ab, bc, t), interPoint(bc, cd, t), t);
  }

  relDif(n1, n2) {
    // Returns the relative difference (n1 - n2) / |n2| unless n2 is
    // near-zero; then it returns the absolute difference n1 - n2
    const div = Math.abs(n2);
    if(div < VM.NEAR_ZERO) {
      return n1 - n2;
    }
    return (n1 - n2) / div;
  }
  
  //
  // Diagram-drawing method draws the diagram for the focal cluster
  //
  
  removeDeepLinkShapes() {
    // Remove shapes of "deep link" objects from the paper.
    for(let k in this.drawn_deep_links) {
      if(this.drawn_deep_links.hasOwnProperty(k)) {
        this.drawn_deep_links[k].shape.removeFromDOM();
      }
    }
    this.drawn_deep_links = {};
  }
  
  comprisingDeepLink(l) {
    // Return drawn deep link that comprises `l`. 
    for(let k in this.drawn_deep_links) {
      if(this.drawn_deep_links.hasOwnProperty(k)) {
        const dl = this.drawn_deep_links[k];
        for(let i = 0; i < dl.deep_links.length; i++) {
          if(dl.deep_links[i] === l) return dl;
        }
      }
    }
    return null;
  }
  
  drawModel(mdl) {
    // Draw the diagram for the focal activity.
    this.clear();
    // Prepare to draw all elements in the focal activity.
    const
        fa = mdl.focal_activity,
        vl = fa.visibleLinks,
        dvl = fa.deepVisibleLinks;
    for(let i = 0; i < fa.sub_activities.length; i++) {
      this.drawActivity(fa.sub_activities[i]);
    }
    // NOTE: The "deep visible links" are "virtual" link objects that
    // will be recognized as such by the link drawing routine. The are
    // drawn first because their lines will be thicker.
    for(let k in dvl) if(dvl.hasOwnProperty(k)) {
      this.drawLink(dvl[k]);
    }
    for(let i = 0; i < vl.length; i++) {
      this.drawLink(vl[i]);
    }
    // Draw notes last, as they are semi-transparent, and can be quite small.
    for(let i = 0; i < fa.notes.length; i++) {
      this.drawNote(fa.notes[i]);
    }
    // Resize paper if necessary.
    this.extend();
    // Display model name in browser.
    document.title = mdl.name || 'diaFRAM';
  }
  
  drawSelection(mdl, dx=0, dy=0) {
    // NOTE: Clear this global, as Bezier curves move from under the cursor.
    // without a mouseout event.
    this.link_under_cursor = null;
        // Draw the selected entities and associated links.
    for(let i = 0; i < mdl.selection.length; i++) {
      const obj = mdl.selection[i];
      // Links are drawn separately, so do not draw those contained in
      // the selection .
      if(!(obj instanceof Link)) UI.drawObject(obj, dx, dy);
    }
    // First redraw all deep links that are visible in the focal activity.
    this.removeDeepLinkShapes();
    const dvl = mdl.focal_activity.deepVisibleLinks;
    for(let k in dvl) if(dvl.hasOwnProperty(k)) {
      this.drawLink(dvl[k], dx, dy);
    }
    // Then also redraw all links that are visible in the focal activity.
    const vl = mdl.focal_activity.visibleLinks;
    for(let i = 0; i < vl.length; i++) {
      this.drawLink(vl[i], dx, dy);
    }
    this.extend(); 
  }
  
  drawLink(l, dx=0, dy=0) {
    // Draws link `l` on the paper.
    let stroke_color,
        stroke_width,
        chev,
        ady;
    // Clear previous drawing.
    l.shape.clear();
    const
        // Link is dashed when it has no assiciated aspects.
        sda = (l.aspects.length ? 'none' : UI.sda.dash),
        activated = l.containsActivated(MODEL.t),
        active_color = l.activeColor(MODEL.t),
        vn = l.visibleNodes;
    // Double-check: do not draw unless both activities are visible.
    if(!vn[0] || !vn[1]) {
      const cdl = this.comprisingDeepLink(l);
      if(cdl) {
        l = cdl;
      } else {
        console.log('ANOMALY: no cdl found for link', l.displayName);
        return;
      }
    }
    if(l.selected || l.containsSelected) {
      // Draw arrow line thick and in red.
      stroke_color = this.palette.select;
      stroke_width = 1.75;
      chev = this.selected_chevron;
      ady = 4;
    } else {
      stroke_width = 1.25;
      if(activated || active_color !== this.palette.rim) {
        if(activated) {
          stroke_color = this.palette.activated;
        } else {
          stroke_color = active_color;
        }
        // NOTE: Only one shade of green for the chevron tip.
        chev = this.green_chevron;
      } else if(l.is_feedback || l.containsFeedback) {
        stroke_color = 'black';
        chev = this.feedback_chevron;
      } else {
        stroke_color = this.palette.rim;
        chev = this.chevron;
      }
      ady = 3;
    }
    const
        fa = l.from_activity,
        ta = l.to_activity,
        tc = l.to_connector,
        pi3 = Math.PI / 3,
        angle = 'ORPITC'.indexOf(tc) * pi3,
        hsr3 = Math.sqrt(3) / 2,
        cx1 = fa.x + dx + fa.width * 0.55,
        cy1 = fa.y + dy,
        r = ta.width * 0.55,
        cosa = Math.cos(angle),
        sina = Math.sin(angle),
        cx2 = ta.x + dx + cosa * r,
        cy2 = ta.y + dy + sina * r,
        dcx = cx2 - cx1,
        dcy = cy2 - cy1,
        dr = 10 + Math.sqrt(dcx * dcx + dcy * dcy) / 8;
    // Declare variables for the arrow point coordinates.
    let x1, y1, x2, y2, fcx, fcy, tcx, tcy;
    // Control point for (O) connector follows the straight line to the
    // other connector up to +/- 30 degrees.
    const
        fpm60 = Math.abs(dcy) <= Math.abs(dcx) / hsr3 * 0.5,
        fcpa = (dcx > 0 && fpm60 ? Math.atan(dcy / dcx) :
            Math.sign(dcy) * pi3 * 0.5),
        fcpsin = Math.sin(fcpa),
        fcpcos = Math.cos(fcpa); 
    x1 = cx1 + 7 * fcpcos;
    y1 = cy1 + 7 * fcpsin;
    fcx = cx1 + dr * fcpcos;
    // NOTE: Pull more up or down when TO lies left of FROM; otherwise
    // stay a bit more horizontal so that line becomes a bit curved.
    const udy = (dcx < 0 ? Math.sign(dcy) * (dr + 50) : - 0.5 * dr * fcpsin);
    fcy = cy1 + dr * fcpsin + udy;
    // Likewise, the control point for the TO connector follows the
    // straight line up to +/- 60 degrees of its default angle.
    const
        slatan = (dcx ? Math.atan(-dcy / dcx) : Math.PI / 2),
        slangle = (dcx > 0 ? Math.PI - slatan :
            (dcy < 0 ? -slatan : 2 * Math.PI - slatan)),
        da = angle - slangle,
        to_i = tc === 'I',
        part = (to_i && dcx > 0 ? 0.1 : 1),
        tpm60 = Math.abs(da) < pi3 * part,
        rot = ('TC'.indexOf(tc) >= 0 ? -1 :  1),
        tcpa = (tpm60 ? slangle :
            angle + (to_i ? Math.sign(dcy) * part : Math.sign(dcx)) * pi3 * rot),
        tcpsin = Math.sin(tcpa),
        tcpcos = Math.cos(tcpa),
        ccx2 = ((tc === 'R' && dcx > 0 && dcy > 0) ||
            (tc === 'C' && dcx > 0 && dcy < 0) ? -100 : 0);
    x2 = cx2 + tcpcos * 10;
    y2 = cy2 + tcpsin * 10;
    tcx = cx2 + tcpcos * (dr + 3 / part) + ccx2;
    tcy = cy2 + tcpsin * dr + (to_i && dcx < 0 ? dr - Math.sign(dcy) * 50 : 0);
    // First draw a thick but near-transparent line so that the mouse
    // events is triggered sooner.
    const
        le = l.shape.addPath(
            [`M${x1},${y1}C${fcx},${fcy},${tcx},${tcy},${x2},${y2}`],
            {fill: 'none', stroke: 'white', 'stroke-width': 9,
                'stroke-linecap': 'round', opacity: 0.01}),
        ndl = l.deep_links.length,
        luc = (ndl === 1 ? l.deep_links[0] : l),
        // Permit selecting a single deep link...
        sluc = (ndl < 2 ?
            () => { UI.setLinkUnderCursor(luc); } :
            // ... and make multiple deep links appear on the status line.
            () => { UI.showDeepLinksUnderCursor(l); });
    le.setAttribute('pointer-events', 'auto');
    le.addEventListener('mouseover', sluc);
    le.addEventListener('mouseout',
        () => { UI.setLinkUnderCursor(null); });
/*
    // Display control points (for testing & debugging).
    l.shape.addCircle(fcx, fcy, 2, {fill: 'red'});
    l.shape.addCircle(tcx, tcy, 2, {fill: 'blue'});
*/
    // Add shape to list of drawn deep links if applicable.
    if(ndl) this.drawn_deep_links[l.identifier] = l;
    // Then draw the line in its appropriate style.
    let opac = 1;
    if(ndl > 1) {
      // NOTE: Deep links representing multiple links cannot be selected,
      // so they are always depicted in gray.
      stroke_width = 2.5;
      stroke_color = (activated ? UI.color.active : UI.color.rim);
      chev = this.deep_chevron;
      opac = 0.75;
    }
    const tl = l.shape.addPath(
        [`M${x1},${y1}C${fcx},${fcy},${tcx},${tcy},${x2},${y2}`],
        {fill: 'none', stroke: stroke_color, 'stroke-width': stroke_width,
            'stroke-dasharray': sda, 'stroke-linecap': 'round',
            'marker-end': chev, opacity: opac});
    if(activated) {
      // Highlight arrow if FROM acitivy was activated in the previous
      // cycle.
      tl.setAttribute('style', this.active_link_filter);
    }
    if(l.aspects.length) {
      const
          firstRealLinkWithAspect = (a) => {
              if(ndl) {
                for(let i = 0; i < ndl; i++) {
                  const dl = l.deep_links[i];
                  if(dl.aspects.indexOf(a) >= 0) return dl;
                }
              }
              return l;
            },
          sauc = (event) => { UI.setAspectUnderCursor(event); },
          cauc = () => { UI.clearAspectUnderCursor(); },
          n = l.aspects.length,
          step = 0.4 / n;
      let p = 0.5 - (n - 1) * step;
      for(let i = 0; i < n; i++) {
        const
            a = l.aspects[i],
            frlwa = firstRealLinkWithAspect(a),
            aid = a.identifier,
            bp = this.bezierPoint(
                [x1, y1], [fcx, fcy], [tcx, tcy], [x2, y2], p),
            le = l.shape.addText(bp[0], bp[1], a.name_lines,
                {'font-size': 9, 'pointer-events': 'auto'}),
            nimbus = (a.comments && DOCUMENTATION_MANAGER.visible ?
                ', 0 0 3.5px rgb(0,80,255)' : '');
        // Use italic font when aspect is time-dependent.
        if(a.expression.defined && !a.expression.isStatic) {
          le.setAttribute('font-style', 'italic');
        }
        // Use bold-face red when aspect is selected by the modeler.
        if(a === MODEL.selected_aspect) {
          le.setAttribute('fill', UI.color.select);
          le.setAttribute('font-weight', 700);
        }
        le.setAttribute('style',
            'text-shadow: 0.5px 0.5px rgb(255, 255, 255, 0.6), ' +
                '-0.5px -0.5px rgb(255, 255, 255, 0.6), ' +
                '0.5px -0.5px rgb(255, 255, 255, 0.6), ' +
                '-0.5px 0.5px rgb(255, 255, 255, 0.6)' + nimbus);
        // Add identifying data attribute...
        le.setAttribute('data-id', aid);
        // ... also for the link...
        le.setAttribute('data-linkid', frlwa.identifier);
        // ... and for a deep link the index in the drawn list, because
        // this will permit redrawing this link after selecting and/or
        // editing this aspect.
        if(ndl) le.setAttribute('data-ddlid', l.identifier);
        // Make aspect text responsive to cursor events...
        le.setAttribute('pointer-events', 'auto');
        le.addEventListener('mouseover', sauc);
        le.addEventListener('mouseout', cauc);
        // ... and make it show this by changing the cursor.
        le.setAttribute('cursor', 'pointer');
        if(a.expression.defined &&
            (fa.isActive(MODEL.t - 1) || a.isLasting(MODEL.t))) {
          // When model has been solved, show value of aspect if the
          // FROM activity was active in the previous cycle, or its
          // output aspect is lasting due to some UNTIL.
          const
              x = a.expression,
              r = x.result(MODEL.t),
              rp = r === VM.PENDING,
              // When AFTER or UNTIL are in play, show their setpoint.
              aup = (rp ? x.after_points[MODEL.t] : x.until_points[MODEL.t]),
              extra = (!aup && aup !== 0 ? '' : (rp ? '' : '\u25D4') +
                  UI.clockTime(aup)),
              s = VM.sig4Dig(r),
              nbb = this.numberSize(s + extra, 9),
              nobb = this.numberSize(s, 9),
              bw = nbb.width + 4,
              bh = nbb.height + 2,
              bx = bp[0] + (a.width + bw) / 2,
              by = bp[1];
          l.shape.addRect(bx, by, bw, bh,
              {stroke: '#80a0ff', 'stroke-width': 0.5, fill: '#d0f0ff'});
          if(r <= VM.ERROR || r >= VM.EXCEPTION) {
            l.shape.addNumber(bx, by, s + extra,
                {'font-size': 9, 'fill': this.palette.VM_error});
          } else {
            l.shape.addNumber(bx - bw / 2 + 2 + nobb.width / 2, by, s,
                {'font-size': 9, 'fill': '#0000a0', 'font-weight': 700});
            l.shape.addText(bx + nobb.width, by, extra,
                {'font-size': 9, 'fill': '#f07000'});
          }
        }
        p += 2 * step;
      }
    }
    // Highlight shape if it has comments.
    l.shape.element.setAttribute('style',
        (DOCUMENTATION_MANAGER.visible && l.comments ?
            this.documented_filter : ''));
    l.shape.appendToDOM();
  }

  drawActivity(act, dx=0, dy=0) {
    // Clear previous drawing.
    act.shape.clear();
    // Do not draw process unless in focal activity.
    if(MODEL.focal_activity.sub_activities.indexOf(act) < 0) return;
    // Set local constants and variables.
    const
        background = act.isBackground,
        x = act.x + dx,
        y = act.y + dy,
        hw = act.width / 2,
        hh = act.height / 2,
        qw = hw / 2,
        active = act.isActive(MODEL.t);
    let stroke_width = 1,
        stroke_color = this.palette.rim,
        fill_color = (background ? this.palette.bg_fill :
            this.palette.fg_fill);
    // Active states have a dark green rim.
    if(active) {
      stroke_width = 1.5;
      stroke_color = act.activeColor(MODEL.t);
    }
    // Being selected overrules special border properties except SDA
    if(act.selected) {
      stroke_color = this.palette.select;
      stroke_width = 2.5;
    }
    // Draw frame using colors as defined above.
    act.shape.addPath(['M', x - hw, ',', y, 'l', qw, ',-', hh,
        'l', hw, ',0l', qw, ',', hh, 'l-', qw, ',', hh, 'l-', hw, ',0Z'],
        {fill: fill_color, stroke: stroke_color,
            'stroke-width': stroke_width});
    if(background) {
      act.shape.addPath(['M', x, ',', y, 'l', qw, ',',
          (act.isExit ? '-' : ''), hh - 0.5, 'l-', hw, ',0Z'],
          {fill: 'white', opacity: 0.6});
    }
    // Draw inner shadow if activity has sub_activities.
    if(!act.isLeaf) {
      act.shape.addPath(['M', x - (hw-2.5), ',', y, 'l', (qw-1), ',-', (hh-2),
          'l', (hw-2.5), ',0l', (qw-1), ',', (hh-2), 'l-', (qw-1), ',', (hh-2),
          'l-', (hw-2.5), ',0Z'],
              {fill: 'none', stroke: stroke_color, 'stroke-width': 5,
                  opacity: 0.4});
    }
    // Add actor color unless it is white.
    if(act.actor.color !== '#ffffff') {
      let cd = 3,
          cd2 = 6;
      if(act.isLeaf) {
        cd = 1.24;
        cd2 = 2.5;
      }
      act.shape.addPath(['M', x - (hw-cd2), ',', y, 'l', (qw-cd), ',-', (hh-cd2),
          'l', (hw-cd2), ',0l', (qw-cd), ',', (hh-cd2), 'l-', (qw-cd), ',', (hh-cd2),
          'l-', (hw-cd2), ',0Z'],
              {fill: 'none', stroke: act.actor.color, 'stroke-width': 4});      
    }
    // Add the six aspect circles.
    const
        letters = 'ORPITC',
        aid = act.identifier,
        // Get lookup object for contextual links for this activity.
        cl = act.contextualLinks;
    for(let i = 0; i < 6; i++) {
      const
          c = letters.charAt(i),
          a = Math.PI * i / 3,
          ax = x + Math.cos(a) * hw * 1.1,
          ay = y + Math.sin(a) * hw * 1.1;
      act.shape.addConnector(ax, ay, c, aid, cl[c]);
    }
    // Always draw process name plus actor name (if any).
    const
        th = act.name_lines.split('\n').length * this.font_heights[10] / 2,
        cy = (act.hasActor ? y - 8 : y - 2);
    act.shape.addText(x, cy, act.name_lines, {'font-size': 10});
    if(act.hasActor) {
      act.shape.addText(x, cy + th + 6, act.actor.name,
          {'font-size': 10, fill: this.palette.actor_font,
              'font-style': 'italic'});
    }
    // Highlight shape if needed.
    let filter = '';
    if(act.activated(MODEL.t)) {
      filter = this.activated_filter;
    } else if(act === UI.target_activity) {
      filter = this.target_filter;
    } else if(DOCUMENTATION_MANAGER.visible && act.comments) {
      filter = this.documented_filter;
    }
    act.shape.element.firstChild.setAttribute('style', filter);
    // Make shape slightly transparent.
    act.shape.element.setAttribute('opacity', 0.9);
    act.shape.appendToDOM();    
  }
  
  drawNote(note, dx=0, dy=0) {
    // NOTE: call resize if text contains fields, as text determines size
    note.resize();
    const
        x = note.x + dx,
        y = note.y + dy,
        w = note.width,
        h = note.height;
    let stroke_color, stroke_width;
    if(note.selected) {
      stroke_color = this.palette.select;
      stroke_width = 1.6;
    } else {
      stroke_color = this.palette.note_rim;
      stroke_width = 0.6;
    }
    note.shape.clear();
    note.shape.addRect(x, y, w, h,
        {fill: this.palette.note_fill, opacity: 0.75, stroke: stroke_color,
            'stroke-width': stroke_width, rx: 4, ry: 4});
    note.shape.addRect(x, y, w-2, h-2,
        {fill: 'none', stroke: this.palette.note_band, 'stroke-width': 1.5,
            rx: 3, ry: 3});
    note.shape.addText(x - w/2 + 4, y, note.lines,
        {fill: this.palette.note_font, 'text-anchor': 'start'});
    note.shape.appendToDOM();
  }
  
} // END of class Paper

