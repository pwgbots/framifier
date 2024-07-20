/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-expression-editor.js) provides the GUI
functionality for the diaFRAM Expression Editor dialog.
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

// CLASS ExpressionEditor
class ExpressionEditor {
  constructor() {
    this.edited_object = null;
    this.edited_expression = null;
    // Dialog DOM elements.
    const md = UI.modals.expression;
    this.type = md.element('type');
    this.scope = md.element('scope');
    this.aspect_div = md.element('aspect-div');
    this.aspect = md.element('aspect');
    this.incoming_div = md.element('incoming-div');
    this.incoming_aspect = md.element('incoming-aspect');
    this.activity = md.element('activity');
    this.text = md.element('text');
    this.status = md.element('status');
    this.help = md.element('help');
    this.insert = md.element('insert');
    this.variables = md.element('variables');
    // The quick guide to diaFRAM expressions.
    this.help.innerHTML = `
<p><span style="font-size: 13px; font-weight: bold">diaFRAM expressions</span> &ndash;
<em>Move cursor over a</em> <code>symbol</code> <em>for explanation.</em>
<p>
<h4>Variables</h4>
<p>Names of system aspects must be enclosed by brackets, e.g.,
  <code>[some aspect]</code>, to distinguish them from pre-defined variables
  (<code title="Cycle number (starts at 1)">c</code>,
  <code title="Simulated clock time (in hours)">now</code>,
  <code title="A random number from the uniform distribution U(0, 1)">random</code>)
  and constants
  (<code title="Mathematical constant &pi; = ${Math.PI}">pi</code>,
  <code title="Logical constant true = 1
NOTE: any non-zero value evaluates as true">true</code>,
  <code title="Logical constant false = 0">false</code>,
  <code title="Number of hours in 1 year">yr</code>,
  <code title="Number of hours in 1 week">wk</code>,
  <code title="Number of hours in 1 day">d</code>,
  <code title="Number of hours in 1 hour (1)">h</code>,
  <code title="Number of hours in 1 minute">m</code>,
  <code title="Number of hours in 1 second">s</code>).
</p>
<h4>Operators</h4>
<p><em>Monadic:</em>
  <code title="-X evaluates as minus X">-</code>, 
  <code title="not X evaluates as 1 if X equals 0 (otherwise 0)">not</code>,
  <code title="abs X evaluates as the absolute value of X">abs</code>,
  <code title="int X evaluates as the integer part of X">int</code>,
  <code title="fract X evaluates as the decimal fraction of X">fract</code>,
  <code title="round X evaluates as X rounded to the nearest integer">round</code>,
  <code title="sqrt X evaluates as the square root of X">sqrt</code>,
  <code title="ln X evaluates as the natural logarithm of X">ln</code>,
  <code title="exp X evaluates as \u{1D452} raised to the power of X">exp</code>,
  <code title="sin X evaluates as the sine of X">sin</code>,
  <code title="cos X evaluates as the cosine of X">cos</code>,
  <code title="atan X evaluates as the inverse tangent of X">atan</code>,
  <code title="max(X1;&hellip;;Xn) evaluates as the highest value of X1, &hellip;, Xn">max</code>,
  <code title="min(X1;&hellip;;Xn) evaluates as the lowest value of X1, &hellip;, Xn">min</code>,
  <code title="binomial X evaluates as a random number from the Binomial(N, p) distribution">binomial</code>,
  <code title="exponential X evaluates as a random number from the Exponential(&lambda;) distribution">exponential</code>,
  <code title="normal(X;Y) evaluates as a random number from the Normal(&mu;,&sigma;) distribution">normal</code>,
  <code title="poisson(X) evaluates as a random number from the Poisson(&lambda;) distribution">poisson</code>,
  <code title="triangular(X;Y;Z) evaluates as a random number from the Triangular(a,b,c) distribution
NOTE: When omitted, the third parameter c defaults to (a+b)/2">triangular</code>,
  <code title="weibull(X;Y) evaluates as a random number from the Weibull(&lambda;,k) distribution">weibull</code><br>

  <em>Arithmetic:</em>
  <code title="X + Y = sum of X and Y">+</code>,
  <code title="X &minus; Y = difference between X and Y">-</code>,
  <code title="X * Y = product of X and Y">*</code>,
  <code title="X / Y = division of X by Y">/</code>,
  <code title="X % Y = the remainder of X divided by Y">%</code>,
  <code title="X ^ Y = X raised to the power of Y">^</code>,
  <code title="X log Y = base X logarithm of Y">log</code><br>

  <em>Comparison:</em>
  <code title="X = Y evaluates as 1 if X equals Y (otherwise 0)">=</code>,
  <code title="X &lt;&gt; Y evaluates as 1 if X does NOT equal Y (otherwise 0)">&lt;&gt;</code>
  or <code title="Alternative notation for X &lt;&gt; Y">!=</code>, 
  <code title="X &lt; Y evaluates as 1 if X is less than Y (otherwise 0)">&lt;</code>, 
  <code title="X &lt;= Y evaluates as 1 if X is less than or equal to Y (otherwise 0)">&lt;=</code>, 
  <code title="X &gt;= Y evaluates as 1 if X is greater than or equal to Y (otherwise 0)">&gt;=</code>, 
  <code title="X &gt; Y evaluates as 1 if X is greater than Y (otherwise 0)">&gt;</code><br> 

  <em>Logical:</em>
  <code title="X and Y evaluates as 1 if X and Y are both non-zero (otherwise 0)">and</code>, 
  <code title="X or Y evaluates as 1 unless X and Y are both zero (otherwise 0)">or</code><br>

  <em>Conditional:</em>
  <code title="X ? Y : Z evaluates as Y if X is non-zero, and otherwise as Z">X ? Y : Z</code>
  (can be read as <strong>if</strong> X <strong>then</strong> Y <strong>else</strong> Z)<br>

  <em>Resolving undefined values:</em>
  <code title="X | Y evaluates as Y if X is undefined, and otherwise as X">X | Y</code>
  (can be read as <strong>if</strong> X = &#x2047; <strong>then</strong> Y <strong>else</strong> X)<br>

  <em>Grouping:</em>
  <code title="X ; Y evaluates as a group or &ldquo;tuple&rdquo; (X, Y)
NOTE: Grouping groups results in a single group, e.g., (1;2);(3;4;5) evaluates as (1;2;3;4;5)">X ; Y</code>
  (use only in combination with <code>max</code>, <code>min</code> and probabilistic operators)<br>
  <em>Clock time:</em> <code>waituntil(</code>X<code>)</code> sets the simulation clock time to X hours
  and evaluates as the new time X, or as 0 (<code>false</code>) if X < <code>now</code>;
  <code>wait(</code>X<code>)</code> is shorthand for <code>waituntil(now + </code>X<code>)</code>. 
</p>
<p>
  Monadic operators take precedence over dyadic operators.
  Use parentheses to override the default evaluation precedence.
</p>`;
    // Add listeners to the GUI elements.
    md.ok.addEventListener('click', () => X_EDIT.parseExpression());
    md.cancel.addEventListener('click', () => X_EDIT.cancel());
    // NOTE: This modal also has an information button in its header.
    md.info.addEventListener(
        'click', () => X_EDIT.toggleExpressionInfo());
    // The "insert aspect" button shows variables within scope (if any).
    this.insert.addEventListener(
        'mouseover', () => X_EDIT.showVariables());
    // List with variables in scope disappears when cursor moves out.
    this.variables.addEventListener(
        'mouseout', () => X_EDIT.hideVariables());
    // Ensure that list disappears when cursor moves into other controls.
    this.text.addEventListener(
        'mouseover', () => X_EDIT.hideVariables());
    this.status.addEventListener(
        'mouseover', () => X_EDIT.hideVariables());
  }

  editExpression(obj, con='') {
    // Open the dialog for the expression for aspect `obj`, or when the
    // connector letter `con` is specified, the incoming expression of
    // activity `obj`.
    this.edited_object = obj;
    this.edited_connector = con;
    if(obj instanceof Activity && con) {
      this.edited_expression = obj.incoming_expressions[con];
      this.scope.innerHTML = '';
      this.aspect.value = '';
      this.type.innerText = circledLetter(con) + ' expression';
      this.incoming_aspect.innerText = UI.aspect_type[con];
      this.activity.innerText = obj.displayName;
      this.incoming_div.style.display = 'block';
      this.aspect_div.style.display = 'none';
    } else {
      this.edited_expression = obj.expression;
      this.type.innerText = 'system aspect';
      this.scope_connector = '';
      this.scope.innerHTML =
          `(<em>scope:</em> ${obj.parent.displayName})`;
      this.aspect.value = obj.displayName;
      this.aspect_div.style.display = 'block';
      this.incoming_div.style.display = 'none';
    }
    this.text.value = this.edited_expression.text.trim();
    
    this.updateVariables();
    this.clearStatusBar();
    UI.modals.expression.show('text');
  }
 
  cancel() {
    // Close the expression editor dialog.
    this.edited_expression = null;
    UI.edited_object = null;
    UI.modals.expression.hide();
  }

  parseExpression() {
    // NOTE: The name of the edited aspect may have been changed.
    // @@TO DO: prepare for undo
    const
        md = UI.modals.expression,
        obj = this.edited_object;
    // Rename object if it is an aspect and its name has changed.
    if(obj instanceof Aspect) {
      let nn = md.element('aspect').value.trim(),
          nasp = obj.rename(nn);
      // NOTE: When rename returns FALSE, a warning is already shown.
      if(nasp !== true && nasp !== false) {
        this.warningEntityExists(nasp);
        return false;
      }
    }
    // Only now parse the contents of the expression editor.
    let xt = this.text.value.trim();
    // Remove all non-functional whitespace from variable references. 
    xt = monoSpacedVariables(xt);
    // Update the text shown in the editor, otherwise the position of
    // errors in the text may be incorrect.
    this.text.value = xt;
    const xp = new ExpressionParser(xt, this.edited_object,
        this.edited_connector);
    let ok;
    if(xp.error) {
      this.status.innerHTML = xp.error;
      this.status.style.backgroundColor = 'Yellow';
      SOUNDS.warning.play();
      this.text.focus();
      this.text.selectionStart = xp.pit - xp.los;
      this.text.selectionEnd = xp.pit;
      ok = false;
    } else {
      // Changing an expression invalidates model results.
      const reset = this.edited_expression.text !== xp.expr;
      this.edited_expression.text = xp.expr;
      if(reset) UI.resetModel();
      UI.modals.expression.hide();
      UI.edited_object = false;
      ok = true;
    }
    if(obj instanceof Aspect) {
      // For aspect expressions, the diagram must be updated because
      // aspects may be renamed, and the expression may have changed
      // from static to dynamic or vice versa.
      let l = MODEL.linksWithAspect(obj);
      for(let i = 0; i < l.length; i++) {
        UI.paper.drawLink(l[i]);
      }
    }
    return ok;
  }
  
  clearStatusBar() {
    this.status.style.backgroundColor = UI.color.dialog_background;
    this.status.innerHTML = '&nbsp;';
  }
  
  get aspectNames() {
    // Returns a list of names of all defined aspects.
    // NOTE: `edited_object` is an aspect on a link => parent is that
    // link, and FROM activty of that link defines the scope.
    const
        ais = (this.edited_object instanceof Aspect ?
            this.edited_object.parent.aspectsInScope :
            this.edited_object.incomingAspects(this.edited_connector)),
        list = [];
    for(let i = 0; i < ais.length; i++) {
      list.push(ais[i].displayName);
    }
    return list;
  }  
  
  updateVariables() {
    // Compile list of variables in scope.
    const
      tbl = this.variables,
      html = [],
      vis = this.aspectNames.sort(
          (a, b) => UI.compareFullNames(a, b));
    this.variables_in_scope = vis;
    for(let i = 0; i < vis.length; i++) {
      html.push(`<tr class="list">
          <td onclick="X_EDIT.insertVariable(${i})">${vis[i]}</td>
        </tr>`);
    }
    tbl.innerHTML = '<table>' + html.join('') + '</table>';
    if(vis.length) {
      this.insert.classList.remove('disab');
      this.insert.classList.add('enab');
    } else {
      this.insert.classList.remove('enab');
      this.insert.classList.add('disab');
    }
    this.status.title = pluralS(vis.length, 'variable') +
        ` within scope of ${this.scopeName}`;
    // Initially hide the variable list.
    this.variables.style.display = 'none';
  }
  
  get scopeName() {
    if(this.edited_object instanceof Aspect) {
      return `function "${this.edited_object.parent.displayName}"`;
    }
    return `${UI.aspect_type[this.edited_connector]} of function ` +
        `"${this.edited_object.displayName}"`; 
  }
  
  showVariables() {
    this.variables.style.display = 'block';
  }
  
  hideVariables() {
    const e = event || window.event;
    e.preventDefault();
    e.stopPropagation();
    // Only hide when the mouse leaves the complete list.
    if(e.target.nodeName === 'DIV') this.variables.style.display = 'none';    
  }
  
  insertVariable(nr) {
    // Hide variable list and insert name of selected variable.
    this.variables.style.display = 'none';
    const name = this.variables_in_scope[nr];
    if(name) {
      let p = this.text.selectionStart;
      const
          v = this.text.value,
          tb = v.substring(0, p),
          ta = v.substring(p, v.length);
      this.text.value = `${tb}[${name}]${ta}`;
      p += name.length + 2;
      this.text.setSelectionRange(p, p);
    }
    this.text.focus();
  }
  
  toggleExpressionInfo() {
    // Show/hide information pane with information on expression notation,
    // meanwhile changing the dialog buttons: when guide is showing, only
    // display a "close" button, otherwise info, OK and cancel
    const md = UI.modals.expression;
    if(window.getComputedStyle(this.help).display !== 'none') {
      this.help.style.display = 'none';
      md.ok.style.display = 'block';
      md.cancel.style.display = 'block';
      md.info.src = 'images/info.png';
    } else {
      this.help.style.display = 'block';
      md.ok.style.display = 'none';
      md.cancel.style.display = 'none';
      md.info.src = 'images/close.png';
    }
  }
  
} // END of class ExpressionEditor
