/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-vm.js) defines the classes and functions that
implement the arithmetical expressions for entity attributes, and the Virtual
Machine (VM) that executes a diaFRAM model.
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

// CLASS Expression
class Expression {
  constructor(obj, text) {
    // Expressions are defined for system aspects.
    this.object = obj;
    this.text = text;
     // A stack for local time step (to allow lazy evaluation).
    this.step = [];
    // An operand stack for computation (elements must be numeric).
    this.stack = []; 
    // NOTE: code = NULL indicates: not compiled yet.
    this.code = null;
    // Error message when last compiled.
    this.compile_issue = '';
    // Error message when last computed.
    this.compute_issue = '';
    // NOTE: Use a semaphore to prevent cyclic recursion.
    this.compiling = false;
    // While compiling, check whether any operand depends on time.
    this.is_static = true;
    // NOTE: VM expects result to be an array, even when expression is static.
    this.vector = [VM.NOT_COMPUTED];
    // Special instructions can store results as cache properties to save
    // (re)computation time; cache is cleared when expression is reset.
    this.cache = {};
  }
  
  get variableName() {
    // Return the name of the variable computed by this expression.
    if(this.object) return this.object.displayName;
    return 'Unknown variable (no object)';
  }

  get referencedEntities() {
    // Return a list of entities referenced in this expression.
    return MODEL.entitiesInString(this.text);
  }

  update(parser) {
    // Must be called after successful compilation by the expression parser.
    this.text = parser.expr;
    this.code = parser.code;
    this.is_static = parser.is_static;
    this.reset();
  }

  reset(default_value=VM.NOT_COMPUTED) {
    // Clear result of previous computation (if any).
    this.method_object = null;
    this.compile_issue = '';
    this.compute_issue = '';
    this.step.length = 0;
    this.stack.length = 0;
    this.compile(); // if(!this.compiled)  REMOVED to ensure correct isStatic!! 
    // Static expressions only need a vector with one element (having index 0)
    if(this.is_static) {
      // NOTE: Empty expressions (i.e., no text) may default to different
      // values: typically 0 for lower bounds, infinite for upper process
      // bounds, etc., so this value must be passed as parameter.
      this.vector.length = 1;
      if(this.text.length === 0) {
        this.vector[0] = default_value;
      } else {
        // Initial values must be computed *lazily* just like any other value 
        this.vector[0] = VM.NOT_COMPUTED;
      }
    } else {
      // An array of appropriate length initialized as "not computed"
      MODEL.cleanVector(this.vector, VM.NOT_COMPUTED);
    }
  }

  compile() {
    // Do not compile recursively.
    if(this.compiling) return;
    // Set the "compiling" flag to prevent cyclic recursion.
    this.compiling = true;
    // Clear the VM instruction list.
    this.code = null;
    const xp = new ExpressionParser(this.text, this.object);
    if(xp.error === '') {
      this.update(xp);
    } else {
      this.compile_issue = xp.error;
      this.is_static = true;
      this.vector.length = 0;
      this.vector[0] = VM.INVALID;
      // Report error on-screen to modeler
      UI.alert(`Syntax error in ${this.variableName}: ${xp.error}`);
    }
    // Clear the "compiling" flag for this expression
    this.compiling = false;
  }

  get asXML() {
    // Returns XML-encoded expression. 
    let text = this.text;
    return xmlEncoded(text);
  }
  
  get defined() {
    // Returns TRUE if the expression string is not empty.
    return this.text !== '';
  }
  
  get compiled() {
    // Returns TRUE if there is code for this expression.
    // NOTE: The expression parser sets `code` to NULL when compiling an
    // empty string. 
    return this.code !== null;
  }

  get isStatic() {
    // Returns is_static property AFTER compiling if not compiled yet.
    // NOTE: To prevent cylic recursion, return FALSE if this expression is
    // already being compiled.
    if(this.compiling) return false;
    if(!this.compiled) this.compile();
    return this.is_static;
  }
  
  trace(action) {
    // Adds step stack (if any) and action to the trace.
    if(DEBUGGING) {
      // Show the "time step stack" for --START and --STOP
      if(action.startsWith('--') || action.startsWith('"')) {
        const s = [];
        for(let i = 0; i < this.step.length; i++) {
          s.push(this.step[i]); 
        }
        action = `[${s.join(', ')}] ${action}`;
      }
      console.log(action);
    }
  }
  
  compute(t, number=false) {
    // Executes the VM code for this expression for time step `t`.
    // NOTE: `number` is passed only if context for # is defined.
    if(!this.compiled) this.compile();
    // Return FALSE if compilation resulted in error.
    if(!this.compiled) return false;
    // Compute static expressions as if t = 0.
    if(t < 0 || this.isStatic) t = 0;
    // Select the vector to use.
    const v = this.vector;
    // Check for potential error (that should NOT occur).
    if(!Array.isArray(v) || v.length === 0 || t >= v.length) {
      const msg = 'ERROR: Undefined value during expression evaluation';
      UI.alert(msg);
      console.log(this.variableName, ':', this.text, '#', number, '@', t, v);
      // Throw exception to permit viewing the function call stack.
      throw msg;
    }
    // When called while already computing for time step t, signal this
    // as an error value.
    if(v[t] === VM.COMPUTING) v[t] = VM.CYCLIC;
    // Compute a value only once.
    if(v[t] !== VM.NOT_COMPUTED) {
      if(DEBUGGING) console.log('Already computed', this.variableName,
          ':', this.text, '@', t, v[t]);
      return true;
    }
    // Push this expression onto the call stack.
    VM.call_stack.push(this);
    // Push time step in case a VMI instruction for another expression
    // references this same variable.
    this.trace(`--START: ${this.variableName}`);
    this.step.push(t);
    // NOTE: Trace expression AFTER pushing the time step.
    this.trace(`"${this.text}"`);
    v[t] = VM.COMPUTING;
    // Execute the instructions.
    let vmi = null,
        ok = true,
        cl = this.code.length;
    this.trace(pluralS(cl, 'VM instruction'));
    this.program_counter = 0;
    this.stack.length = 0;
    while(ok && this.program_counter < cl && v[t] === VM.COMPUTING) {
      vmi = this.code[this.program_counter];
      // Instructions are 2-element arrays [function, [arguments]].
      // The function is called with this expression as first parameter,
      // and the argument list as second parameter.
      vmi[0](this, vmi[1]);
      this.program_counter++;
    }
    // Stack should now have length 1. If not, report error unless the
    // length is due to some other error.
    if(this.stack.length > 1) {
      if(v[t] > VM.ERROR) v[t] = VM.OVERFLOW;
    } else if(this.stack.length < 1) {
      if(v[t] > VM.ERROR) v[t] = VM.UNDERFLOW;
    } else {
      v[t] = this.stack.pop();
    }
    this.trace('RESULT = ' + VM.sig4Dig(v[t]));
    // Store wildcard result also in "normal" vector
    this.vector[t] = v[t];
    // Pop the time step.
    this.step.pop();
    this.trace('--STOP: ' + this.variableName);
    // If error, display the call stack (only once).
    // NOTE: "undefined", "not computed" and "still computing" are NOT
    // problematic unless they result in an error (stack over/underflow).
    if(v[t] <= VM.ERROR) {
      // NOTE: Record the first issue that is detected.
      if(!this.compute_issue) this.compute_issue = VM.errorMessage(v[t]);      
      MONITOR.showCallStack(t);
      VM.logCallStack(t);
    }
    // Always pop the expression from the call stack.
    VM.call_stack.pop(this);
    return true;
  }

  result(t) {
    // Compute (only if needed) and then return result for time step t.
    // Select the vector to use.
    const v = this.vector;
    if(!Array.isArray(v)) {
      console.log('ANOMALY: No vector for result(t)');
      return VM.UNDEFINED;
    }
    // NOTE: For t < 1 return the value for t = 1, since expressions have
    // no "initial value" (these follow from the variables used in the
    // expression).
    if(t < 0 || this.isStatic) t = 0;
    if(t >= v.length) return VM.UNDEFINED;
    if(v[t] === VM.NOT_COMPUTED || v[t] === VM.COMPUTING) {
      v[t] = VM.NOT_COMPUTED;
      this.compute(t);
    }
    return v[t];
  }
  
  get asAttribute() {
    // Return the result for the current time step if the model has been
    // solved (with special values as human-readable string), or the
    // expression as text.
    if(!(MODEL.solved || this.isStatic)) return this.text;
    const sv = VM.specialValue(this.result(MODEL.t))[1];
    // NOTE: ?? is replaced by empty string to facilitate copy/paste to
    // Excel-like spreadsheets, where an empty cell indicates "undefined".
    if(sv === '\u2047') return '';
    return sv;
  }
  
  push(value) {
    // Push a numeric value onto the computation stack.
    if(this.stack.length >= VM.MAX_STACK) {
      this.trace('STACK OVERFLOW');
      this.stack.push(VM.OVERFLOW);
      this.computed = true;
      return false;
    }
    this.stack.push(value);
    return true;
  }
  
  top(no_check=false) {
    // Return the top element of the stack, or FALSE if the stack was empty.
    if(this.stack.length < 1) {
      this.trace('TOP: UNDERFLOW');
      this.stack = [VM.UNDERFLOW];
      this.computed = true;
      return false;
    }
    const top = this.stack[this.stack.length - 1]; 
    // Check for errors, "undefined", "not computed", and "still computing".
    if(top < VM.MINUS_INFINITY || top > VM.EXCEPTION) {
      // If error or exception, ignore UNDEFINED if `no_check` is TRUE.
      if(no_check && top <= VM.UNDEFINED) return top;
      // Otherwise, leave the special value on top of the stack, and
      // return FALSE so that the VM instruction will not alter it.
      this.trace(
          VM.errorMessage(top) + ' at top of stack: ' + this.stack.toString());
      return false;
    }
    return top;
  }

  pop(no_check=false) {
    // Return the two top elements A and B as [A, B] after popping the
    // top element B from the stack, or FALSE if the stack contains fewer
    // than 2 elements, or if A and/or B are error values.
    if(this.stack.length < 2) {
      this.trace('POP: UNDERFLOW');
      this.stack.push(VM.UNDERFLOW);
      this.computed = true;
      return false;
    }
    // Get the top two numbers on the stack as a list.
    const dyad = this.stack.slice(-2);
    // Pop only the top one.
    this.stack.pop();
    // Check whether either number is an error code.
    let check = Math.min(dyad[0], dyad[1]);
    if(check < VM.MINUS_INFINITY &&
        // Exception: "array index out of bounds" error may also be
        // ignored by using the | operator.
        !(no_check && check === VM.ARRAY_INDEX)) {
      // If error, leave the most severe error on top of the stack.
      this.retop(check);
      this.trace(VM.errorMessage(check) + ' in dyad: ' + dyad.toString());
      return false;
    }
    // Now check for "undefined", "not computed", and "still computing".
    check = dyad[0];
    if(no_check) {
      // For VMI_replace_undefined, ignore that A is "undefined" or even
      // "array index out of bounds" unless B is also "undefined".
      if(check === VM.UNDEFINED || check === VM.ARRAY_INDEX) {
        dyad[0] = VM.UNDEFINED; // Treat "out of bounds" as "undefined".
        check = dyad[1];
      }
    } else {
      check = Math.max(check, dyad[1]);
    }
    if(check > VM.EXCEPTION) {
      this.retop(check);
      this.trace(VM.errorMessage(check) + ' in dyad: ' + dyad.toString());
      return false;
    }
    // No issue(s)? Then return the dyad.
    return dyad;
  }

  retop(value) {
    // Replace the top element of the stack by the new value.
    // NOTE: Do not check the stack length, as this instruction typically
    // follows a TOP or POP instruction.
    this.stack[this.stack.length - 1] = value;
    return true;
  }
  
  replaceAttribute(re, a1, a2) {
    // Replace occurrences of attribute `a1` by `a2` for all variables
    // that match the regular expression `re`.
    let n = 0;
    const matches = this.text.match(re);
    if(matches) {
      // Match is case-insensitive, so check each for matching case of
      // attribute.
      for(let i = 0; i < matches.length; i++) {
        const
            m = matches[i],
            e = m.split('|');
        // Let `ao` be attribute + offset (if any) without right bracket.
        let ao = e.pop().slice(0, -1),
            // Then also trim offset and spaces.
            a = ao.split('@')[0].trim();
        // Check whether `a` (without bracket and without spaces) indeed
        // matches `a1`.
        if(a === a1) {
          // If so, append new attribute plus offset plus right bracket...
          e.push(ao.replace(a, a2) + ']');
          // ... and replace the original match by the ensemble.
          this.text = this.text.replace(m, e.join('|'));
          n += 1;
        }
      }
    }
    return n;
  }

} // END of Expression class


// CLASS ExpressionParser
// Instances of ExpressionParser compile expressions into code, i.e.,
// an array of VM instructions.

class ExpressionParser {
  constructor(text, owner=null, connector='') {
    // Setting TRACE to TRUE will log parsing information to the console.
    this.TRACE = false;
    // `owner` is the aspect for which the expression is parsed.
    this.owner = owner;
    // `connector` is the aspect letter (CRPIT) in case an incoming
    // expression is parsed.
    this.connector = connector;
    // `text` is the expression string to be parsed.
    this.expr = text;
    this.expansions = [];
    // Immediately compile; this may generate warnings.
    this.compile();
  }

  get ownerName() {
    // FOR TRACING & DEBUGGING: Returns the owner of this equation (if any).
    if(!this.owner) return '(no owner)';
    let n = this.owner.displayName;
    return n;
  }

  log(msg) {
    // NOTE: This method is used only to profile dynamic expressions.
    if(true) return;
    // Set the above IF condition to FALSE to profile dynamic expressions.
    console.log(`Expression for ${this.ownerName}: ${this.expr}\n${msg}`);
  }
  
  incomingExpression(c) {
    // Return incoming expression for connector `c` of the owner's parent
    // activity if the owner is an aspect, otherwise NULL.
    const
        valid = {
          'c': 'C',
          'control': 'C',
          'o': 'O',
          'output': 'O',
          'r': 'R',
          'resource': 'R',
          'p': 'P',
          'precondition': 'P',
          'i': 'I',
          'input': 'I',
          't': 'T',
          'time': 'T'
        },
        con = valid[c],
        obj = this.owner;
    if(con) {
      if(con === 'O') {
        this.error = 'Outputs must be specified as [aspect name]';
      } else if(obj instanceof Activity) {
        this.error = 'Expressions for \u24CD cannot refer to any \u24CE';
      } else {
        // If no expression defined, return a dummy expression.
        return obj.parent.incoming_expressions[con] || new Expression(obj, '');
      }
    }
    return null;
  }
  
  // The method parseVariable(name) checks whether `name` fits this pattern:
  //   aspect@offset_1:offset_2
  // allowing spaces around @ and :
  // The aspect is mandatory, statistic$ is optional, and offset has a
  // default value.
  // It returns array [object, anchor_1, offset_1, anchor_2, offset_2] if
  // the pattern matches and no statistic, or the 6-element array
  // [statistic, object list, anchor, offset, anchor_2, offset_2]
  // if a valid statistic is specified; otherwise it returns FALSE.
  // The object is either a vector or an expression.
  // NOTE: this array is used as argument for the virtual machine instructions
  // VMI_push_var, VMI_push_statistic and VMI_push_run_result.
  parseVariable(name) {
    // Remove non-functional whitespace.
    name = name.replace(/\s+/g, ' ').trim();
    
    // For debugging, TRACE can be used to log to the console for
    // specific expressions and/or variables, for example:
    // this.TRACE = name.endsWith('losses') || this.ownerName.endsWith('losses');

    if(this.TRACE) console.log(
        `TRACE: Parsing variable "${name}" in expression for`,
        this.ownerName, ' -->  ', this.expr);

    // Only aspects in scope can be used.
    const aspects = (this.owner instanceof Aspect ?
        this.owner.parent.aspectsInScope :
        this.owner.incomingAspects(this.connector));

    // Initialize possible components.
    let obj = null,
        anchor1 = '',
        offset1 = 0,
        anchor2 = '',
        offset2 = 0,
        msg = '',
        s = name.split('@');
    if(s.length > 1) {
      // [variable@offset] where offset has form (anchor1)number1(:(anchor2)number 2)   
      // Offsets make expression dynamic (for now, ignore exceptional cases)
      this.is_static = false;
      this.log('dynamic because of offset');
      // String contains at least one @ character, then split at the last (pop)
      // and check that @ sign is followed by an offset (range if `:`)
      // NOTE: offset anchors are case-insensitive
      const offs = s.pop().replace(/\s+/g, '').toLowerCase().split(':');
      // Re-assemble the other substrings, as name itself may contain @ signs
      name = s.join('@').trim();
      const re = /(^[\+\-]?[0-9]+|[\#cfijklnprst]([\+\-][0-9]+)?)$/;
      if(!re.test(offs[0])) {
        msg = `Invalid offset "${offs[0]}"`;
      } else if(offs.length > 1 && !re.test(offs[1])) {
        msg = `Invalid second offset "${offs[1]}"`;
      }
      if(msg === '') {
        if('t'.includes(offs[0].charAt(0))) {
          anchor1 = offs[0].charAt(0);
          offset1 = safeStrToInt(offs[0].substring(1)); 
        } else {
          offset1 = safeStrToInt(offs[0]); 
        }
        if(offs.length > 1) {
          if('t'.includes(offs[1].charAt(0))) {
            anchor2 = offs[1].charAt(0);
            offset2 = safeStrToInt(offs[1].substring(1));
          } else {
            offset2 = safeStrToInt(offs[1]); 
          }
        } else {
          // If only 1 offset specified, then set second equal to first
          anchor2 = anchor1;
          offset2 = offset1;
        }
      }
    }
    // If reached this stage, variable must be like this:
    // [(statistic$)aspect name pattern]

    // Check whether a statistic is specified.
    let args = [],
        pat = name.split('$');
    if(pat.length > 1 &&
        VM.statistic_operators.indexOf(pat[0].toUpperCase()) >= 0) {
      // For statistics, the default anchor is 't'.
      if(!anchor1) anchor1 = 't';
      if(!anchor2) anchor2 = 't';
      // Consider only the first $ as statistic separator. 
      const stat = pat.shift().toUpperCase();
      // Reassemble pattern string, which may itself contain $.
      pat = pat.join('$');
      // By default, consider all entity types.
      let et = VM.entity_letters,
          patstr = pat;
      // Selection may be limited to specific entity types by prefix "...?"
      // where ... is one or more entity letters (A for actor, etc.).
      if(/^[AFLS]+\?/i.test(pat)) {
        pat = pat.split('?');
        et = pat[0].toUpperCase();
        pat = pat.slice(1).join('=');
      }
      // Get the name pattern.
      pat = patternList(pat);
      // Get list of all matching aspects within scope.
      const list = [];
      for(let i = 0; i < aspects.length; i++) {
        const a = aspects[i];
        if(patternMatch(a.name, pat)) list.push(a);
      }
      if(list.length > 0) {
        args = [stat, list, anchor1, offset1, anchor2, offset2];
        if(this.TRACE) console.log('TRACE: Variable is a statistic:', args);
        // NOTE: Compiler will recognize 6-element list as a
        // sign to use the VMI_push_statistic instruction.
        return args;
      }
      this.error = `No aspects (within scope) that match pattern "${patstr}"`;
      return false;
    }
    
    //
    // NOTE: For statistics, the method will ALWAYS have returned a result,
    // so what follows does not apply to statistics results, but only to
    // "plain" variables like [aspect name].
    //
    
    if(!anchor1) anchor1 = 't';
    if(!anchor2) anchor2 = 't';
    // First handle this special case: no name.
    // Variables like [@t-1] are interpreted as a self-reference. This is
    // meaningful when a *negative* offset is specified to denote "use the
    // value of this expression for some earlier time step".
    // NOTE: This makes the expression dynamic.
    if(!name) {
      this.is_static = false;
      this.log('dynamic because of self-reference');
      if(anchor1 === 't' && offset1 < 0 && anchor2 === 't' && offset2 < 0) {
        if(this.TRACE) console.log('TRACE: Variable is a self-reference.');
        // The `xv` attribute will be recognized by VMI_push_var to denote
        // "use the vector of the expression for which this VMI is code".
        return [{xv: true, dv: 0}, anchor1, offset1, anchor2, offset2];
      }
      msg = 'Expression can reference only previous values of itself';
    }
    const id = UI.nameToID(name); 
    for(let i = 0; !obj && i < aspects.length; i++) {
      const a = aspects[i];
      if(a.identifier === id) obj = a;
    }
    if(obj === null) msg = `Unknown aspect "${name}"`;
    if(msg) {
      this.error = msg;
      return false;
    }
    if(!anchor1) anchor1 = 't';
    if(!anchor2) anchor2 = 't';
    this.is_static = this.is_static && obj.expression.isStatic;
    args = [obj.expression, anchor1, offset1, anchor2, offset2];
    if(msg) {
      this.error = msg;
      return false;
    }
    // Now `args` should be a valid argument for a VM instruction that
    // pushes an operand on the evaluation stack.
    return args;
  }

  getSymbol() {
    // Get the next substring in the expression that is a valid symbol
    // while advancing the position-in-text (`pit`) and length-of-symbol
    // (`los`), which are used to highlight the position of a syntax error
    // in the expression editor.
    let c, f, i, l, v;
    this.prev_sym = this.sym;
    this.sym = null;
    // Skip whitespace.
    while(this.pit <= this.eot && this.expr.charAt(this.pit) <= ' ') {
      this.pit++;
    }
    if(this.pit > this.eot) return;
    c = this.expr.charAt(this.pit);
    if(c === '[') {
      // Left bracket denotes start of a variable name
      i = indexOfMatchingBracket(this.expr, this.pit);
      if(i < 0) {
        this.pit++;
        this.los = 1;
        this.error = 'Missing closing bracket \']\'';
      } else {
        v = this.expr.substring(this.pit + 1, i);
        this.pit = i + 1;
        // NOTE: Enclosing brackets are also part of this symbol
        this.los = v.length + 2;
        // Push the array [identifier, anchor1, offset1, anchor2, offset2],
        // or FALSE if variable name is not valid.
        this.sym = this.parseVariable(v);
        // NOTE: parseVariable may set is_static to FALSE
      }
    } else if(c === '(' || c === ')') {
      this.sym = c;
      this.los = 1;
      this.pit++;
    } else if(OPERATOR_CHARS.indexOf(c) >= 0) {
      this.pit++;
      // Check for compound operators (!=, <>, <=, >=) and if so, append
      // the second character
      if(this.pit <= this.eot &&
          COMPOUND_OPERATORS.indexOf(c + this.expr.charAt(this.pit)) >= 0) {
        c += this.expr.charAt(this.pit);
        this.pit++;
      }
      this.los = c.length;
      // Instead of the operator symbol, the corresponding VM instruction
      // should be pushed onto the symbol stack
      this.sym = OPERATOR_CODES[OPERATORS.indexOf(c)];
    } else {
      // Take any text up to the next operator, parenthesis,
      // opening bracket, quote or space
      this.los = 0;
      let pl = this.pit + this.los,
          cpl = this.expr.charAt(pl),
          pcpl = '',
          digs = false;
      // NOTE: + and - operators are special case, since they may also
      // be part of a floating point number, hence the more elaborate check
      while(pl <= this.eot && (SEPARATOR_CHARS.indexOf(cpl) < 0 ||
          ('+-'.indexOf(cpl) >= 0 && digs && pcpl.toLowerCase() === 'e'))) {
        digs = digs || '0123456789'.indexOf(cpl) >= 0;
        this.los++;
        pl++;
        pcpl = cpl;
        cpl = this.expr.charAt(pl);
      }
      // Include trailing spaces in the source text...
      while(this.pit + this.los <= this.eot &&
          this.expr.charAt(this.pit + this.los) === ' ') {
        this.los++;
      }
      // ... but trim spaces from the symbol
      v = this.expr.substring(this.pit, this.pit + this.los).trim();
      // Ignore case
      l = v.toLowerCase();
      if(l === '#') {
        // # symbolizes the tail number of an entity name, so check
        // whether # can be inferred from the owner.
        if(this.owner.numberContext) {
          this.sym = VMI_push_contextual_number;
        } else {
          this.error = '# is undefined in this context';
        }
      } else if('0123456789'.indexOf(l.charAt(0)) >= 0) {
        // If symbol starts with a digit, check whether it is a valid number
        if(/^\d+((\.|\,)\d*)?(e[\+\-]?\d+)?$/.test(l)) {
          f = safeStrToFloat(l, l);
        } else {
          f = NaN;
        }
        // If not, report error
        if(isNaN(f) || !isFinite(f)) {
          this.error = `Invalid number "${v}"`;
        } else {
          // If a valid number, keep it within the +/- infinity range
          this.sym = Math.max(VM.MINUS_INFINITY, Math.min(VM.PLUS_INFINITY, f));
        }
      } else {
        // Symbol does not start with a digit
        const ax = this.incomingExpression(l);
        if(ax) {
          // NOTE: No offsets (yet) for incoming expression operands.
          this.sym = [ax, 't',0, 't', 0];
          this.is_static = this.is_static && ax.isStatic;
        } else if(!this.error) {
          i = ACTUAL_SYMBOLS.indexOf(l);
          if(i < 0) {
            this.error = `Invalid symbol "${v}"`;
          } else {
            this.sym = SYMBOL_CODES[i];
            // NOTE: Using time symbols or `random` makes the expression dynamic! 
            if(DYNAMIC_SYMBOLS.indexOf(l) >= 0) this.is_static = false;
          }
        }
      }
      this.pit += this.los;
    }
    // A minus is monadic if at the start of the expression, or NOT preceded
    // by a "constant symbol", a number, or a closing parenthesis `)`.
    // Constant symbols are time 't', block start 'b', block length 'n',
    // look-ahead 'l', 'random', 'true', 'false', 'pi', and 'infinity'
    if(DYADIC_CODES.indexOf(this.sym) === DYADIC_OPERATORS.indexOf('-') &&
        (this.prev_sym === null ||
            !(Array.isArray(this.prev_sym) ||
            typeof this.prev_sym === 'number' ||
            this.prev_sym === ')' ||
            CONSTANT_CODES.indexOf(this.prev_sym) >= 0))) {
      this.sym = VMI_negate;
    }
  }

  codeOperation(op) {
    // Adds operation (which is an array [function, [arguments]]) to the
    // code, and "pops" the operand stack only if the operator is dyadic
    if(op === VMI_if_then) {
      if(this.if_stack.length < 1) {
        this.error = 'Unexpected ?';
      } else {
        // A ? operator is "coded" when it is popped from the operator
        // stack, typically chased by :, and possibly by ) or ; or EOT,
        // and this means that all VM code for the THEN part has been
        // added, so `code.length` will be the index of the first
        // instruction coding the ELSE part (if present). This index
        // is the target for the most recently added JUMP-IF-FALSE
        let target = this.code.length;
        // NOTE: when ? is chased by :, this means that the THEN part
        // must end with a JUMP instruction BUT this JUMP instruction
        // has not been coded yet (as this is done AFTER popping the
        // operator stack); hence check whether the "chasing" operator
        // (this.sym) is a :, and if so, add 1 to the target address 
        if(this.sym === VMI_if_else) target++;
        this.code[this.if_stack.pop()][1] = target;
      }
    } else if (op === VMI_if_else) {
      if(this.then_stack.length < 1) {
        this.error = 'Unexpected :';
      } else {
        // Similar to above: when a : operator is "coded", the ELSE part
        // has been coded, so the end of the code array is the target for
        // the most recently added JUMP
        this.code[this.then_stack.pop()][1] = this.code.length;
      }
    } else {
      // All other operations require VM instructions that operate on the
      // expression stack
      this.code.push([op, null]);
      if(op === VMI_concat) {
        this.concatenating = true;
      } else {
        const randcode = RANDOM_CODES.indexOf(op) >= 0;
        if(REDUCING_CODES.indexOf(op) >= 0) {
          if(randcode && !this.concatenating) {
            // NOTE: probability distributions MUST have a parameter list but
            // MIN and MAX will also accept a single argument
            console.log('OPERATOR:', op);
            this.error = 'Missing parameter list';
          }
          this.concatenating = false;
        }
        if(randcode) this.is_static = false;
      }
    }
    if(DYADIC_CODES.indexOf(op) >= 0) this.sym_stack--;
    if(this.sym_stack <= 0) this.error = 'Missing operand';
  }

  compile() {
    // Compile expression into array of VM instructions `code`.
    // NOTE: Always create a new code array instance, as it will typically
    // become the code attribute of an expression object.
    if(DEBUGGING) console.log('COMPILING', this.ownerName, ':\n', this.expr);
    this.code = [];
    // Position in text.
    this.pit = 0;
    // Length of symbol.
    this.los = 0;
    // Error message also serves as flag: stop compiling if not empty.
    this.error = '';
    // `is_static` becomes FALSE when a time-dependent operand is detected.
    this.is_static = true;
    // `concatenating` becomes TRUE when a concatenation operator
    // (semicolon) is pushed, and FALSE when a reducing operator (min, max,
    // normal, weibull, triangular) is pushed.
    this.concatenating = false;
    // An empty expression should return the "undefined" value.
    if(this.expr.trim() === '') {
      this.code.push([VMI_push_number, VM.UNDEFINED]);
      return; 
    }
    // Parse the expression using Edsger Dijkstra's shunting-yard algorithm.
    // vmi = virtual machine instruction (a function).
    let vmi;
    // eot = end of text (index of last character in string).
    this.eot = this.expr.length - 1;
    this.sym = null; // current symbol
    this.prev_sym = null; // previous symbol
    this.sym_stack = 0; // counts # of operands on stack
    this.op_stack = []; // operator stack
    this.if_stack = []; // stack of indices of JUMP-IF-FALSE instructions
    this.then_stack = []; // stack of indices of JUMP instructions
    this.custom_stack = []; // stack for custom operator objects
    while(this.error === '' && this.pit <= this.eot) {
      this.getSymbol();
      if(this.error !== '') break;
      if(this.sym === '(') {
        // Opening parenthesis is ALWAYS pushed onto the stack.
        this.op_stack.push(this.sym);
      } else if(this.sym === ')') {
        // Closing parenthesis => pop all operators until its matching
        // opening parenthesis is found.
        if(this.op_stack.indexOf('(') < 0) {
          this.error = 'Unmatched \')\'';
        } else if(this.prev_sym === '(' ||
          OPERATOR_CODES.indexOf(this.prev_sym) >= 0) {
          // Parenthesis immediately after an operator => missing operand.
          this.error = 'Missing operand';
        } else {
          // Pop all operators up to and including the matching parenthesis.
          vmi = null;
          while(this.op_stack.length > 0 &&
            this.op_stack[this.op_stack.length - 1] !== '(') {
            // Pop the operator.
            vmi = this.op_stack.pop();
            this.codeOperation(vmi);
          }
          // Also pop the opening parenthesis.
          this.op_stack.pop();
        }
      } else if(this.sym === VMI_if_else &&
        this.op_stack.indexOf(VMI_if_then) < 0) {
        // : encountered without preceding ?
        this.error = '\':\' (else) must be preceded by \'?\' (if ... then)';
      } else if(OPERATOR_CODES.indexOf(this.sym) >= 0) {
        let topop = (this.op_stack.length > 0 ?
              this.op_stack[this.op_stack.length - 1] : null),
            topprio = PRIORITIES[OPERATOR_CODES.indexOf(topop)],
            symprio = PRIORITIES[OPERATOR_CODES.indexOf(this.sym)];
        // Pop all operators having a higher or equal priority than the
        // one to be pushed EXCEPT when this priority equals 9, as monadic
        // operators bind right-to-left.
        while(this.op_stack.length > 0 && OPERATOR_CODES.indexOf(topop) >= 0 &&
          topprio >= symprio && symprio !== 9) {
          // The stack may be emptied, but if it contains a (, this
          // parenthesis is unmatched.
          if(topop === '(') {
            this.error = 'Missing \')\'';
          } else {
            vmi = this.op_stack.pop();
            this.codeOperation(vmi);
            if(this.op_stack.length >= 0) {
              topop = this.op_stack[this.op_stack.length - 1];
              topprio = PRIORITIES[OPERATOR_CODES.indexOf(topop)];
            } else {
              topop = null;
              topprio = 0;
            }
          }
        }
        
        if(this.sym === VMI_if_then) {
          // Push index of JUMP-IF-FALSE instruction on if_stack so that
          // later its dummy argument (NULL) can be replaced by the
          // index of the first instruction after the THEN part.
          this.if_stack.push(this.code.length);
          this.code.push([VMI_jump_if_false, null]);
        } else if(this.sym === VMI_if_else) {
          this.then_stack.push(this.code.length);
          this.code.push([VMI_jump, null]);
          // NOTE: If : is not omitted, the code for the ELSE part must
          // start by popping the FALSE result of the IF condition.
          this.code.push([VMI_pop_false, null]);
        }
        // END of new code for IF-THEN-ELSE

        this.op_stack.push(this.sym);
      } else if(this.sym !== null) {
        // Symbol is an operand.
        if(CONSTANT_CODES.indexOf(this.sym) >= 0) {
          this.code.push([this.sym, null]);
        } else if(Array.isArray(this.sym)) {
          // Either a statistic or a variable.
          if(this.sym.length === 6) {
            // 6 arguments indicates a statistic.
            this.code.push([VMI_push_statistic, this.sym]);
          } else {
            this.code.push([VMI_push_var, this.sym]);
          }
        } else {
          this.code.push([VMI_push_number, this.sym]);
        }
        this.sym_stack++;
      }
    }  // END of main WHILE loop
    // End of expression reached => code the unprocessed operators
    while(this.error === '' && this.op_stack.length > 0) {
      if(this.op_stack[this.op_stack.length - 1] === '(') {
        this.error = 'Missing \')\'';
      } else {
        vmi = this.op_stack.pop();
        this.codeOperation(vmi);
      }
    }
    if(this.error === '') {
      if(this.sym_stack < 1) {
        this.error = 'Missing operand';
      } else if(this.sym_stack > 1) {
        this.error = 'Missing operator';
      } else if(this.concatenating) {
        this.error = 'Invalid parameter list';
      }
    }
    if(this.TRACE || DEBUGGING) console.log('PARSED', this.ownerName, ':',
        this.expr, this.code);
  }

} // END of class ExpressionParser


// CLASS VirtualMachine
class VirtualMachine {
  constructor() {
    this.messages = [];
    
    // Default texts to display for (still) empty results.
    this.no_messages = '(no messages)';
    
    this.call_stack = [];
    this.issue_list = [];

    // Floating-point constants used in calculations
    // Meaningful solver results are assumed to lie wihin reasonable bounds.
    // Extreme absolute values (10^25 and above) are used to signal particular
    // outcomes.
    this.SOLVER_PLUS_INFINITY = 1e+25;
    this.SOLVER_MINUS_INFINITY = -1e+25;
    this.BEYOND_PLUS_INFINITY = 1e+35;
    this.BEYOND_MINUS_INFINITY = -1e+35;
    // The VM properties "PLUS_INFINITY" and "MINUS_INFINITY" are used
    // when evaluating expressions. These propeties may be changed for
    // diagnostic purposes -- see below.
    this.PLUS_INFINITY = 1e+25;
    this.MINUS_INFINITY = -1e+25;
    // Expression results having an infinite term may be less than infinity,
    // but still exceptionally high, and this should be shown.
    this.NEAR_PLUS_INFINITY = this.PLUS_INFINITY / 200;
    this.NEAR_MINUS_INFINITY = this.MINUS_INFINITY / 200;
    // As of version 1.8.0, Linny-R imposes no +INF bounds on processes
    // unless diagnosing an unbounded problem. For such diagnosis, the
    // (relatively) low value 9.999999999e+9 is used.
    this.DIAGNOSIS_UPPER_BOUND = 9.999999999e+9;
    // NOTE: Below the "near zero" limit, a number is considered zero
    // (this is to timely detect division-by-zero errors).
    this.NEAR_ZERO = 1e-10;
    // Use a specific constant smaller than near-zero to denote "no cost"
    // to differentiate "no cost" form cost prices that really are 0.
    this.NO_COST = 0.987654321e-10;

    // NOTE: Allow for an accuracy margin: stocks may differ 0.1%  from
    // their target without displaying them in red or blue to signal
    // shortage or surplus.
    this.SIG_DIF_LIMIT = 0.001;
    // Numbers near zero are displayed as +0 or -0.
    this.SIG_DIF_FROM_ZERO = 5e-5;
    // ON/OFF threshold is used to differentiate between level = 0 and
    // still "ON" (will be displayed as +0).
    this.ON_OFF_THRESHOLD = 1.5e-4;
    // Limit for upper bounds beyond which binaries cannot be computed
    // correctly. Modeler is warned when this occurs (typically when
    // ON/OFF variables are needed for a process having infinite bounds.
    this.MEGA_UPPER_BOUND = 1e6;
    // Limit slack penalty to one order of magnitude below +INF.
    this.MAX_SLACK_PENALTY = 0.1 * this.PLUS_INFINITY;
  
    // VM constants for specifying the type of cash flow operation.
    this.CONSUME = 0;
    this.PRODUCE = 1;
    this.ONE_C = 2;
    this.TWO_X = 3;
    this.THREE_X = 4;
    this.SPIN_RES = 5;
    this.PEAK_INC = 6;
    // Array of corrsponding strings for more readable debugging information.
    this.CF_CONSTANTS = ['CONSUME', 'PRODUCE', 'ONE_C', 'TWO_X',
        'THREE_X', 'SPIN_RES'];
    
    // Link multiplier type numbers.
    // NOTE: Do *NOT* change existing values, as this will cause legacy issues!
    this.LM_LEVEL = 0; // No symbol
    this.LM_THROUGHPUT = 1; // Symbol: two parallel right-pointing arrows
    this.LM_INCREASE = 2; // Symbol: Delta
    this.LM_SUM = 3; // Symbol: Sigma
    this.LM_MEAN = 4; // Symbol: mu
    this.LM_STARTUP = 5; // Symbol: thick chevron up
    this.LM_POSITIVE = 6; // Symbol: +
    this.LM_ZERO = 7; // Symbol: 0
    this.LM_SPINNING_RESERVE = 8; // Symbol: left-up curved arrow
    this.LM_FIRST_COMMIT = 9; // Symbol: hollow asterisk
    this.LM_SHUTDOWN = 10; // Symbol: thick chevron down
    this.LM_PEAK_INC = 11; // Symbol: plus inside triangle ("peak-plus")
    this.LM_AVAILABLE_CAPACITY = 12; // Symbol: up-arrow with baseline
    // List of link multipliers that require binary ON/OFF variables
    this.LM_NEEDING_ON_OFF = [5, 6, 7, 8, 9, 10];
    this.LM_SYMBOLS = ['', '\u21C9', '\u0394', '\u03A3', '\u03BC', '\u25B2',
        '+', '0', '\u2934', '\u2732', '\u25BC', '\u2A39', '\u21A5'];
    this.LM_LETTERS = ' TDSMU+0RFDPA';
    
    // VM max. expression stack size.
    this.MAX_STACK = 200;

    // Base penalty of 10 is high relative to the (scaled) coefficients of
    // the cash flows in the objective function (typically +/- 1).
    this.BASE_PENALTY = 10;
    // Peak variable penalty is added to make solver choose the *smallest*
    // value that is greater than or equal to X[t] for all t as "peak value".
    // NOTE: The penalty is expressed in the currency unit, so it will be
    // divided by the cash scalar so as not to interfere with the optimal
    // solution (highest total cash flow).
    this.PEAK_VAR_PENALTY = 0.1;
  
    // NOTE: The VM uses numbers >> +INF to denote special computation results.
    this.EXCEPTION = 1e+36; // to test for any exceptional value
    this.UNDEFINED = 1e+37; // to denote "unspecified by the user"
    this.NOT_COMPUTED = 1e+38; // initial value for VM variables (to distinguish from UNDEFINED)
    this.COMPUTING = 1e+39; // used by the VM to implement lazy evaluation
  
    // NOTES:
    // (1) Computation errors are signalled by NEGATIVE values << -10^35.
    // (2) JavaScript exponents can go up to +/- 308 (IEEE 754 standard).
    // (3) when adding/modifying these values, ALSO update the VM methods
    //     for representing these values as human-readable strings!
    
    this.ERROR = -1e+40; // Any lower value indicates a computation error
    this.CYCLIC = -1e+41;
    this.DIV_ZERO = -1e+42;
    this.BAD_CALC = -1e+43;
    this.ARRAY_INDEX = -1e+44;
    this.BAD_REF = -1e+45;
    this.UNDERFLOW = -1e+46;
    this.OVERFLOW = -1e+47;
    this.INVALID = -1e+48;
    this.PARAMS = -1e+49;
    this.UNKNOWN_ERROR = -1e+50; // Most severe error must have lowest value
  
    this.error_codes = [
      this.ERROR, this.CYCLIC, this.DIV_ZERO, this.BAD_CALC, this.ARRAY_INDEX,
      this.BAD_REF, this.UNDERFLOW, this.OVERFLOW, this.INVALID, this.PARAMS,
      this.UNKNOWN_ERROR, this.UNDEFINED, this.NOT_COMPUTED, this.COMPUTING];
    
    // Prefix for warning messages that are logged in the monitor.
    this.WARNING = '-- Warning: ';

    // Solver constants indicating constraint type.
    // NOTE: These correspond to the codes used in the LP format. When
    // generating MPS files, other constants are used.
    this.FR = 0;
    this.LE = 1;
    this.GE = 2;
    this.EQ = 3;
    this.ACTOR_CASH = 4;
    
    this.constraint_codes = ['FR', 'LE', 'GE', 'EQ'];
    this.constraint_symbols = ['', '<=', '>=', '='];
    this.constraint_letters = ['N', 'L', 'G', 'E'];

    // Standard time unit conversion to hours (NOTE: ignore leap years).
    this.time_unit_values = {
      'year': 8760, 'week': 168, 'day': 24,
      'hour': 1, 'minute': 1/60, 'second': 1/3600
    };
    // More or less standard time unit abbreviations.
    // NOTE: Minute is abbreviated to `m` to remain consistent with the
    // constants that can be used in expressions. There, `min` already
    // denotes the "minimum" operator.
    this.time_unit_shorthand = {
      'year': 'yr', 'week': 'wk', 'day': 'd',
      'hour': 'h', 'minute': 'm', 'second': 's'
    };
    // Number of rounds limited to 31 because JavaScript performs bitwise
    // operations on 32 bit integers, and the sign bit may be troublesome.
    this.max_rounds = 31;
    this.round_letters = '?abcdefghijklmnopqrstuvwxyzABCDE';
    // Standard 1-letter codes for diaFRAM entities.
    this.entity_names = {
      A: 'actor',
      F: 'activity',
      L: 'link',
      S: 'aspect',
    };
    this.entity_letters = 'AFLS';
    // Statistics that can be calculated for sets of variables.
    this.statistic_operators =
      ['MAX', 'MEAN', 'MIN', 'N', 'SD', 'SUM', 'VAR',
       'MAXNZ', 'MEANNZ', 'MINNZ', 'NNZ', 'SDNZ', 'SUMNZ', 'VARNZ'];
    // Statistics that can be calculated for outcomes and experiment run
    // results.
    this.outcome_statistics =
      ['LAST', 'MAX', 'MEAN', 'MIN', 'N', 'NZ', 'SD', 'SUM', 'VAR'];
  }
  
  reset() {
    // Reset the virtual machine so that it can execute the model again.
    // First reset the expression attributes of all model entities.
    MODEL.resetExpressions();
    // Clear the expression call stack -- used only for diagnostics.
    this.call_stack.length = 0;
    // The out-of-bounds properties are set when the ARRAY_INDEX error
    // occurs to better inform the modeler.
    this.out_of_bounds_array = '';
    this.out_of_bounds_msg = '';
    MODEL.set_up = false;
    // Let the model know that it should no longer display results in
    // the model diagram. 
    MODEL.solved = false;
    // NOTE: time etc. still has to be implemented.
    this.nr_of_time_steps = 100;

    // Initialize error counters (error count will be reset to 0 for each
    // block).
    this.error_count = 0;
    this.block_issues = 0;
    // Clear issue list with warnings and hide issue panel.
    this.issue_list.length = 0;
    this.issue_index = -1;
    UI.updateIssuePanel();
    this.messages.length = 0;
    // Reset the (graphical) controller.
    MONITOR.reset();
    // Solver license expiry date will be set to ['YYYYMMDD'], or to []
    // if none.
    this.license_expires = [];
    this.t = 0;
    // Prepare for halt.
    this.halted = false;
    UI.readyToSolve();
  }
  
  errorMessage(n) {
    // VM errors are very big NEGATIVE numbers, so start comparing `n`
    // with the most negative one to return the correct message.
    if(n <= this.UNKNOWN_ERROR) return 'Unknown error';
    if(n <= this.PARAMS) return 'Invalid (number of) parameters';
    if(n <= this.INVALID) return 'Invalid expression';
    if(n <= this.OVERFLOW) return 'Stack overflow';
    if(n <= this.UNDERFLOW) return 'Stack underflow';
    if(n <= this.BAD_REF) return 'Reference to unknown entity';
    if(n <= this.ARRAY_INDEX) return 'Array index out of bounds';
    if(n <= this.BAD_CALC) return 'Invalid mathematical operation';
    if(n <= this.DIV_ZERO) return 'Division by zero';
    if(n <= this.CYCLIC) return 'Cyclic reference';
    if(n <= this.ERROR) return 'Unspecified error';
    // Large positive values denote exceptions.
    if(n >= this.COMPUTING) return 'Cyclic reference while computing';
    if(n >= this.NOT_COMPUTED) return 'Variable or expression not computed';
    if(n >= this.UNDEFINED) return 'Undefined variable or expression';
    if(n === undefined) return 'Undefined Javascript value';
    return n;
  }
  
  specialValue(n) {
    // Return [FALSE, n] if number n is a NOT a special value,
    // otherwise [TRUE, string] with string a readable representation
    // of Virtual Machine error values and other special values.
    // VM errors are very big NEGATIVE numbers, so start comparing `n`
    // with the most negative error code.
    if(n <= this.UNKNOWN_ERROR) return [true, '#ERROR?'];
    if(n <= this.PARAMS) return [true, '#PARAMS'];
    if(n <= this.INVALID) return [true, '#INVALID'];
    if(n <= this.OVERFLOW) return [true, '#STACK+'];
    if(n <= this.UNDERFLOW) return [true, '#STACK-'];
    if(n <= this.BAD_REF) return [true, '#REF?'];
    if(n <= this.ARRAY_INDEX) return [true, '#INDEX!'];
    if(n <= this.BAD_CALC) return [true, '#VALUE!'];
    if(n <= this.DIV_ZERO) return [true, '#DIV/0!'];
    if(n <= this.CYCLIC) return [true, '#CYCLE!'];
    // Any other number less than or equal to 10^30 is considered as
    // minus infinity.
    if(n <= this.NEAR_MINUS_INFINITY) return [true, '-\u221E'];
    // Other special values are very big POSITIVE numbers, so start
    // comparing `n` with the highest value.
    if(n >= this.COMPUTING) return [true, '\u25A6']; // Checkered square
    // NOTE: The prettier circled bold X 2BBF does not display on macOS !!
    if(n >= this.NOT_COMPUTED) return [true, '\u2297']; // Circled X
    if(n >= this.UNDEFINED) return [true, '\u2047']; // Double question mark ??
    if(n >= this.NEAR_PLUS_INFINITY) return [true, '\u221E'];
    if(n === this.NO_COST) return [true, '\u00A2']; // c-slash (cent symbol)
    return [false, n];
  }
  
  sig2Dig(n) {
    // Return number `n` formatted so as to show 2-3 significant digits
    // NOTE: as `n` should be a number, a warning sign will typically
    // indicate a bug in the software.
    if(n === undefined || isNaN(n)) return '\u26A0'; // Warning sign
    const sv = this.specialValue(n);
    // If `n` has a special value, return its representation.
    if(sv[0]) return sv[1];
    const a = Math.abs(n);
    // Signal small differences from true 0 by leading + or - sign.
    if(n !== 0 && a <= this.ON_OFF_THRESHOLD) return n > 0 ? '+0' : '-0';
/* 
    if(a >= 9999.5) return n.toPrecision(2);
    if(Math.abs(a-Math.round(a)) < 0.05) return Math.round(n);
    if(a < 1) return Math.round(n*100) / 100;
    if(a < 10) return Math.round(n*10) / 10;
    if(a < 100) return Math.round(n*10) / 10;
    return Math.round(n);
*/
    let s = n.toString();
    const prec = n.toPrecision(2);
    if(prec.length < s.length) s = prec;
    const expo = n.toExponential(1);
    if(expo.length < s.length) s = expo;
    return s;
  }
  
  sig4Dig(n, tiny=false) {
    // Return number `n` formatted so as to show 4-5 significant digits.
    // NOTE: As `n` should be a number, a warning sign will typically
    // indicate a bug in the software.
    if(n === undefined || isNaN(n)) return '\u26A0';
    const sv = this.specialValue(n); 
    // If `n` has a special value, return its representation.
    if(sv[0]) return sv[1];
    const a = Math.abs(n);
    if(a === 0) return 0;
    // Signal small differences from exactly 0 by a leading + or - sign
    // except when the `tiny` flag is set.
    if(a <= this.ON_OFF_THRESHOLD && !tiny) return n > 0 ? '+0' : '-0';
/*
    if(a >= 9999.5) return n.toPrecision(4);
    if(Math.abs(a-Math.round(a)) < 0.0005) return Math.round(n);
    if(a < 1) return Math.round(n*10000) / 10000;
    if(a < 10) return Math.round(n*1000) / 1000;
    if(a < 100) return Math.round(n*100) / 100;
    if(a < 1000) return Math.round(n*10) / 10;
    return Math.round(n);
*/
    let s = n.toString();
    const prec = n.toPrecision(4);
    if(prec.length < s.length) s = prec;
    const expo = n.toExponential(2);
    if(expo.length < s.length) s = expo;
    if(s.indexOf('e') < 0) s = parseFloat(s).toString();
    return s;
  }
  
  logCallStack(t) {
    // Similar to showCallStack, but simpler, and output only to console.
    console.log('Call stack:', this.call_stack.slice());
    const csl = this.call_stack.length;
    console.log(`ERROR at t=${t}: ` +
        this.errorMessage(this.call_stack[csl - 1].vector[t]));
    // Make separate lists of variable names and their expressions.
    const
        vlist = [],
        xlist = [];
    for(let i = 0; i < csl; i++) {
      const x = this.call_stack[i];
      vlist.push(x.object.displayName + '|' + x.attribute);
      // Trim spaces around all object-attribute separators in the
      // expression as entered by the modeler.
      xlist.push(x.text.replace(/\s*\|\s*/g, '|'));
    }
    // Start without indentation.
    let pad = '';
    // First log the variable being computed.
    console.log('Computing:', vlist[0]);
    // Then iterate upwards over the call stack.
    for(let i = 0; i < vlist.length - 1; i++) {
      // Log the expression, followed by the next computed variable.
      console.log(pad + xlist[i] + '\u279C' + vlist[i+1]);
      // Increase indentation
      pad += '   ';
    }
    // Log the last expression.
    console.log(pad + xlist[xlist.length - 1]);
  }

  logTrace(trc) {
    // Log the trace string to the browser console when debugging.
    if(DEBUGGING) console.log(trc);
  }

  logMessage(block, msg) {
    // Add a solver message to the list.
    // NOTE: block number minus 1, as array is zero-based.
    if(this.messages[block - 1] === this.no_messages) {
      this.messages[block - 1] = '';
    }
    this.messages[block - 1] += msg + '\n';
    if(msg.startsWith(this.WARNING)) {
      this.error_count++;
      this.issue_list.push(msg);
    }
    // Show message on console or in Monitor dialog.
    MONITOR.logMessage(block, msg);
  }
  
  startTimer() {
    // Record time of this timer reset.
    this.reset_time = new Date().getTime();
    this.time_stamp = this.reset_time;
    // Activate the timer.
    this.timer_id = setInterval(() => MONITOR.updateMonitorTime(), 1000);
  }

  stopTimer() {
    // Deactivate the timer.
    clearInterval(this.timer_id);
  }

  get elapsedTime() {
    // Return seconds since previous "elapsed time" check.
    const ts = this.time_stamp;
    this.time_stamp = new Date().getTime();
    return (this.time_stamp - ts) / 1000;
  }
  
  checkForInfinity(n) {
    // Return floating point number `n`, or +INF or -INF if the absolute
    // value of `n` is relatively (!) close to the VM infinity constants
    // (since the solver may return imprecise values of such magnitude).
      if(n > 0.5 * VM.PLUS_INFINITY && n < VM.BEYOND_PLUS_INFINITY) {
      return VM.PLUS_INFINITY;
    } 
    if(n < 0.5 * VM.MINUS_INFINITY && n > VM.BEYOND_MINUS_INFINITY) {
      return VM.MINUS_INFINITY;
    }
    return n;
  }

  severestIssue(list, result) {
    // Returns severest exception code or +/- INFINITY in `list`, or the
    // result of the computation that involves the elements of `list`.
    let issue = 0;
    for(let i = 0; i < list.length; i++) {
      if(list[i] <= VM.MINUS_INFINITY) {
        issue = Math.min(list[i], issue);
      } else if(list[i] >= VM.PLUS_INFINITY) {
        issue = Math.max(list[i], issue);
      }
    }
    if(issue) return issue;
    return result;
  }
  
  solveModel() {
    // Perform successive "cycles" until no more changes occur.
    // First establish the most logical function sequence.
    const seq = MODEL.triggerSequence;
    console.log('HERE seq');
    for(let k in seq) if(seq.hasOwnProperty(k)) {
      const s = seq[k];
      for(let i = 0; i < s.length; i++) {
        console.log('HERE', s[i].displayName);
      }
    }
  }
  
  calculateDependentVariables(block) {
    // Calculate the values of all model variables that depend on the
    // values of the decision variables output by the solver.
    // NOTE: Add a blank line to separate from next round (if any).
    this.logMessage(block,
        `Calculating dependent variables took ${this.elapsedTime} seconds.\n`);
  }
  
  showSetUpProgress(next_start, abl) {
    if(this.show_progress) {
      // Display 1 more segment progress so that the bar reaches 100%
      UI.setProgressNeedle((next_start + this.tsl) / abl);
    }
    setTimeout((t, n) => { VM.addTableauSegment(t, n); }, 0, next_start, abl);
  }

  hideSetUpOrWriteProgress() {
    this.show_progress = false;
    UI.setProgressNeedle(0);
  }
  
  logCode() {
    // Print VM instructions to console.
    const arg = (a) => {
        if(a === null) return '';
        if(typeof a === 'number') return a + '';
        if(typeof a === 'string') return '"' + a + '"';
        if(typeof a === 'boolean') return (a ? 'TRUE' : 'FALSE');
        if(a instanceof Expression) return a.text;
        if(!Array.isArray(a)) {
          const n = a.displayName;
          if(n) return '[' + n + ']';
          return a.constructor.name;
        }
        let l = [];
        for(let i = 0; i < a.length; i++) l.push(arg(a[i]));
        return '(' + l.join(', ') + ')';
      };
    for(let i = 0; i < this.code.length; i++) {
      const vmi = this.code[i];
      let s = arg(vmi[1]);
      if(!s.startsWith('(')) s = '(' + s + ')';
      console.log((i + '').padStart(3, '0') + ':  ' + vmi[0].name + s);
    }
  }
  
  showMPSProgress(next_col, ncol) {
    if(VM.halted) {
      this.hideSetUpOrWriteProgress();
      this.stopSolving();
      return;
    }
    if(this.show_progress) {
      // NOTE: Display 1 block more progress, or the bar never reaches 100%.
      UI.setProgressNeedle((next_col + this.cbl) / ncol);
    }
    setTimeout((c, n) => VM.writeMPSColumns(c, n), 0, next_col, ncol);
  }
  
  stopSolving() {
    this.stopTimer();
    UI.stopSolving();
  }

  halt() {
    // Abort solving process. This prevents submitting the next block.
    UI.waitToStop();
    this.halted = true;
  }

}  // END of class VirtualMachine


// Functions implementing Virtual Machine Instructions (hence prefix VMI)

// diaFRAM features one type of virtual machine: a stack automaton for
// calculation of arithmetical expressions
  
// All Virtual Machine instructions (VMI) are 2-element arrays
// [function, argument list]

// STACK AUTOMATON INSTRUCTIONS
// Properties of diaFRAM entities are either numbers (constant values)
// or expressions. To allow lazy evaluation of expressions, each expression
// has its own stack automaton. This automaton computes the expression
// result by consecutively executing the instructions in the expression's
// code array. Execution of instruction [f, a] means calling f(x, a),
// where x is the computing expression instance. Hence, each VMI stack
// automaton instruction has parameters x and a, where x is the computing
// expression and a the argument, which may be a single number or a list
// (array) of objects. When no arguments need to be passed, the second
// parameter is omitted.

function VMI_push_number(x, number) {
  // Push a numeric constant on the VM stack.
  if(DEBUGGING) console.log('push number = ' + number);
  x.push(number);
}

function VMI_push_time_step(x) {
  // Push the current time step.
  // NOTE: This is the "local" time step for expression `x` (which always
  // starts at 1), adjusted for the first time step of the simulation period.
  const t = x.step[x.step.length - 1]; 
  if(DEBUGGING) console.log('push cycle number c = ' + t);
  x.push(t);
}

function VMI_push_clock_time(x) {
  // Push the simulated clock time (in hours).
  const t = MODEL.clock_time; 
  if(DEBUGGING) console.log('push clock time t = ' + t);
  x.push(t);
}

function VMI_push_random(x) {
  // Push a random number from the interval [0, 1).
  const r = Math.random();
  if(DEBUGGING) console.log('push random =', r);
  x.push(r);
}

function VMI_wait_until(x) {
  // Advance the simulated clock time to the stack top, and return the
  // new time, or 0 if X is less than the current time.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log(`WAIT UNTIL ${d} (clock time: ${MODEL.clock_time})`);
    if(d < MODEL.clock_time) {
      x.retop(0);      
    } else {
      MODEL.clock_time = d;
      x.retop(MODEL.clock_time);
    }
  }
}

function VMI_wait(x) {
  // Advance the simulated clock time by the value on the stack top (if >= 0),
  // and return the new time, or 0 if X has a negative value.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log(`WAIT ${d} (clock time: ${MODEL.clock_time})`);
    if(d < 0) {
      x.retop(0);      
    } else {
      MODEL.clock_time += d;
      x.retop(MODEL.clock_time);
    }
  }
}

function VMI_push_pi(x) {
  // Push the goniometric constant pi.
  if(DEBUGGING) console.log('push pi');
  x.push(Math.PI);
}

function VMI_push_true(x) {
  // Push the Boolean constant TRUE.
  if(DEBUGGING) console.log('push TRUE');
  x.push(1);
}

function VMI_push_false(x) {
  // Push the Boolean constant FALSE.
  if(DEBUGGING) console.log('push FALSE');
  x.push(0);
}

function VMI_push_infinity(x) {
  // Push the constant representing infinity for the solver.
  if(DEBUGGING) console.log('push +INF');
  x.push(VM.PLUS_INFINITY);
}

function VMI_push_year(x) {
  // Push the number of hours in one year.
  if(DEBUGGING) console.log('push h/yr = 8760');
  x.push(8760);
}

function VMI_push_week(x) {
  // Push the number of hourss in one week.
  if(DEBUGGING) console.log('push h/wk = 168');
  x.push(168);
}

function VMI_push_day(x) {
  // Push the number of hours in one day.
  if(DEBUGGING) console.log('push h/d = 24');
  x.push(24);
}

function VMI_push_hour(x) {
  // Push the number of hours in one hour.
  if(DEBUGGING) console.log('push h/h = 1');
  x.push(1);
}

function VMI_push_minute(x) {
  // Push the number of hours in one minute.
  if(DEBUGGING) console.log('push h/m = 1/60');
  x.push(1 / 60);
}

function VMI_push_second(x) {
  // Push the number of hours in one second.
  if(DEBUGGING) console.log('push h/s = 1/3600');
  x.push(1 / 3600);
}

function VMI_push_contextual_number(x) {
  // Push the numeric value of the context-sensitive number #.
  const n = valueOfNumberSign(x);
  if(DEBUGGING) {
    console.log('push contextual number: # = ' + VM.sig2Dig(n));
  }
  x.push(n);
}

/* VM instruction helper functions */

function valueOfNumberSign(x) {
  // Push the numeric value of the # sign for the context of expression `x`.
  // NOTE: This must be the number context of an entity, i.e., the number
  // its name ends on.
  const
      d = endsWithDigits(x.object.name),
      n = (d ? parseInt(d) : VM.UNDEFINED);
  if(DEBUGGING) {
    console.log(`context for # in expression for ${x.variableName}
- expression: ${x.text}
- inferred value of # is ${n}`, x.code);
  }
  return n;
}

function relativeTimeStep(t, anchor, offset, dtm, x) {
  // Return the relative time step, given t, anchor, offset,
  // delta-t-multiplier and the expression being evaluated (to provide
  // context for anchor #).
  // NOTE: t = 1 corresponds with first time step of simulation period.
  // Anchors are checked for in order of *expected* frequency of occurrence.
  if(anchor === 't') {
    // Offset relative to current time step (most likely to occur).
    return Math.floor(t + offset);
  }
  if(anchor === '#') {
    // Index: offset is added to the inferred value of the # symbol.
    return valueOfNumberSign(x) + offset;
  }
  // Fall-through: offset relative to the initial value index (0).
  return offset;
}

function twoOffsetTimeStep(t, a1, o1, a2, o2, dtm, x) {
  // Return the list [rt, ao1, ao2] where `rt` is the time step, and
  // `ao1` and `ao2` are anchor-offset shorthand for the debugging message,
  // given `t`, the two anchors plus offsets, and the delta-t-multiplier.
  // NOTES:
  // (1) `dtm` will differ from 1 only for experiment results.
  // (2) Expression `x` is passed to provide context for evaluation of #.
  let t1 = relativeTimeStep(t, a1, o1, dtm, x),
      ao1 = [' @ ', a1, (o1 > 0 ? '+' : ''), (o1 ? o1 : ''),
          ' = ', t1].join(''),
      ao2 = '';
  if(o2 !== o1 || a2 !== a1) {
    // Two different offsets => use the midpoint as time (NO aggregation!).
    const t2 = relativeTimeStep(t, a2, o2, dtm, x);
    ao2 = [' : ', a2, (o2 > 0 ? '+' : ''), (o2 ? o2 : ''), ' = ', t2].join('');
    t1 = Math.floor((t1 + t2) / 2);
    ao2 += ' => midpoint = ' + t1;
  }
  return [t1, ao1, ao2];
}

/* VM instructions (continued) */

function VMI_push_var(x, args) {
  // Push the value of the variable specified by `args`, being the list
  // [obj, anchor1, offset1, anchor2, offset2] where `obj` must be an
  // expression.
  const
      obj = args[0],
      // NOTE: Use the "local" time step for expression `x`.
      tot = twoOffsetTimeStep(x.step[x.step.length - 1],
          args[1], args[2], args[3], args[4], 1, x);
  let t = tot[0];
  // Negative time step is evaluated as t = 0 (initial value), while t
  // beyond the optimization period is evaluated as its last time step
  // UNLESS t is used in a self-referencing variable.
  const xv = obj.hasOwnProperty('xv');
  if(!xv) {
    t = Math.max(0, Math.min(
        MODEL.end_period - MODEL.start_period + MODEL.look_ahead + 1, t));
  }
  // Trace only now that time step t has been computed.
  if(DEBUGGING) {
    console.log('push var:', (xv ? '[SELF]' :
        (obj instanceof Expression ? obj.text : '[' + obj.toString() + ']')),
        tot[1] + ' ' + tot[2]);
  }
  if(obj instanceof Expression) {
    x.push(obj.result(t));
  } else if(typeof obj === 'number') {
    // Object is a number.
    x.push(obj);
  } else {
    console.log('ERROR: VMI_push_var object =', obj);
    x.push(VM.UNKNOWN_ERROR);
  }
}

function VMI_push_statistic(x, args) {
  // Pushes the value of the statistic over the list of variables specified by
  // `args`, being the list [stat, list, anchor, offset] where `stat` can be one
  // of MAX, MEAN, MIN, N, SD, SUM, and VAR, and `list` is a list of vectors
  // NOTE: each statistic may also be "suffixed" by NZ to denote that only
  // non-zero numbers should be considered
  let stat = args[0],
      list = args[1];
  if(!list) {
    // Special case: null or empty list => push zero
    if(DEBUGGING) {
      console.log('push statistic: 0 (no variable list)');
    }
    x.push(0);
    return;
  }
  const
      anchor1 = args[2],
      offset1 = args[3],
      anchor2 = args[4],
      offset2 = args[5],
      wdict = args[6] || false;
  // If defined, the wildcard dictionary provides subsets of `list`
  // to be used when the wildcard number of the expression is set.
  if(wdict && x.wildcard_vector_index !== false) {
    list = wdict[x.wildcard_vector_index] || [];
  }
  // If no list specified, the result is undefined
  if(!Array.isArray(list) || list.length === 0) {
    x.push(VM.UNDEFINED);
    return;          
  }
  // Get the "local" time step range for expression x
  let t = x.step[x.step.length - 1],
      t1 = relativeTimeStep(t, anchor1, offset1, 1, x),
      t2 = t1,
      ao1 = [' @ ', anchor1, offset1 > 0 ? '+' : '', offset1 ? offset1 : '',
          ' = ', t1].join(''),
      ao2 = '';
  if(anchor2 !== anchor1 || offset2 !== offset1) {
    t = relativeTimeStep(t, anchor2, offset2, 1, x);
    ao2 = [' : ', anchor2, offset2 > 0 ? '+' : '', offset2 ? offset2 : '',
        ' = ', t].join('');
    if(t < t1) {
      t2 = t1;
      t1 = t;
    } else {
      t2 = t;
    }
  }
  // Negative time step is evaluated as t = 0 (initial value) t beyond
  // optimization period is evaluated as its last time step
  const tmax = VM.nr_of_time_steps;
  t1 = Math.max(0, Math.min(tmax, t1));
  t2 = Math.max(0, Math.min(tmax, t2));
  // Trace only now that time step range has been computed
  if(DEBUGGING) {
    const trc = ['push statistic: [', stat, ': N = ', list.length, ']',
        ao1, ao2, ' (t = ', t1, '-', t2, ')'];
    console.log(trc.join(''));
  }
  // Establish whether statistic pertains to non-zero values only
  const nz = stat.endsWith('NZ');
  // If so, trim the 'NZ'
  if(nz) stat = stat.slice(0, -2);
  // Now t1 ... t2 is the range of time steps to iterate over for each variable
  let obj,
      vlist = [];
  for(let t = t1; t <= t2; t++) {
    // Get the list of values
    // NOTE: variables may be vectors or expressions
    for(let i = 0; i < list.length; i++) {
      obj = list[i];
      if(Array.isArray(obj)) {
        // Object is a vector
        if(t < obj.length) {
          v = obj[t];
        } else {
          v = VM.UNDEFINED;
        }
      } else {
        // Object is an expression
        v = obj.result(t);
      }
      // Push value unless it is zero and NZ is TRUE, or if it is undefined
      // (this will occur when a variable has been deleted)
      if(v <= VM.PLUS_INFINITY && (!nz || Math.abs(v) > VM.NEAR_ZERO)) {
        vlist.push(v);
      }
    }
  }
  const
      n = vlist.length,
      // NOTE: count is the number of values used in the statistic 
      count = (nz ? n : list.length * (t2 - t1 + 1));
  if(stat === 'N') {
    x.push(count);
    return;
  }
  // If no non-zero values remain, all statistics are zero (as ALL values were zero)
  if(n === 0) {
    x.push(0);
    return;          
  }
  // Check which statistic, starting with the most likely to be used
  if(stat === 'MIN') {
    x.push(Math.min(...vlist));
    return;
  }
  if(stat === 'MAX') {
    x.push(Math.max(...vlist));
    return;
  }
  // For all remaining statistics, the sum must be calculated
  let sum = 0;
  for(let i = 0; i < n; i++) {
    sum += vlist[i];
  }
  if(stat === 'SUM') {
    x.push(sum);
    return;
  }
  // Now statistic must be either MEAN, SD or VAR, so start with the mean
  // NOTE: no more need to check for division by zero
  const mean = sum / count;
  if(stat === 'MEAN') {
    x.push(mean);
    return;
  }
  // Now calculate the variance
  let sumsq = 0;
  for(let i = 0; i < n; i++) {
    sumsq += Math.pow(vlist[i] - mean, 2);
  }
  if(stat === 'VAR') {
    x.push(sumsq / count);
    return;
  }
  if(stat === 'SD') {
    x.push(Math.sqrt(sumsq / count));
    return;
  }
  // Fall-through: unknown statistic
  x.push(VM.UNDEFINED);
}

function VMI_replace_undefined(x) {
  // Replace one of the two top numbers on the stack by the other if the
  // one is undefined.
  // NOTE: pop(TRUE) denotes that "undefined" should be ignored as issue.
  const d = x.pop(true);
  if(d !== false) {
    if(DEBUGGING) console.log('REPLACE UNDEFINED (' + d.join(', ') + ')');
    x.retop(d[0] === VM.UNDEFINED ? d[1] : d[0]);
  }
}

// NOTE: When the VM computes logical OR, AND and NOT, any non-zero number
// is interpreted as TRUE.

function VMI_or(x) {
  // Perform a logical OR on the two top numbers on the stack.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('OR (' + d.join(', ') + ')');
    x.retop(d[0] !== 0 || d[1] !== 0 ? 1 : 0);
  }
}

function VMI_and(x) {
  // Perform a logical AND on the two top numbers on the stack.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('AND (' + d.join(', ') + ')');
    x.retop(d[0] === 0 || d[1] === 0 ? 0 : 1);
  }
}

function VMI_not(x) {
  // Perform a logical NOT on the top number of the stack.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('NOT ' + d);
    x.retop(d === 0 ? 1 : 0);
  }
}

function VMI_abs(x) {
  // Replace the top number of the stack by its absolute value.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('ABS ' + d);
    x.retop(Math.abs(d));
  }
}

function VMI_eq(x) {
  // Test equality of the two top numbers on the stack.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('EQ (' + d.join(', ') + ')');
    x.retop(d[0] === d[1] ? 1 : 0);
  }
}

function VMI_ne(x) {
  // Test inequality of the two top numbers on the stack.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('NE (' + d.join(', ') + ')');
    x.retop(d[0] !== d[1] ? 1 : 0);
  }
}

function VMI_lt(x) {
  // Test whether second number on the stack is less than the top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('LT (' + d.join(', ') + ')');
    x.retop(d[0] < d[1] ? 1 : 0);
  }
}

function VMI_gt(x) {
  // Test whether second number on the stack is greater than the top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('GT (' + d.join(', ') + ')');
    x.retop(d[0] > d[1] ? 1 : 0);
  }
}

function VMI_le(x) {
  // Test whether second number on the stack is less than, or equal to,
  // the top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('LE (' + d.join(', ') + ')');
    x.retop(d[0] <= d[1] ? 1 : 0);
  }
}

function VMI_ge(x) {
  // Test whether second number on the stack is greater than, or equal to,
  // the top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('LE (' + d.join(', ') + ')');
    x.retop(d[0] >= d[1] ? 1 : 0);
  }
}

function VMI_add(x) {
  // Pop the top number on the stack, and add it to the new top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('ADD (' + d.join(', ') + ')');
    x.retop(d[0] + d[1]);
  }
}

function VMI_sub(x) {
  // Pop the top number on the stack, and subtract it from the new
  // top number.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('SUB (' + d.join(', ') + ')');
    x.retop(d[0] - d[1]);
  }
}

function VMI_mul(x) {
  // Pop the top number on the stack, and multiply it with the new
  // top number
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('MUL (' + d.join(', ') + ')');
    x.retop(d[0] * d[1]);
  }
}

function VMI_div(x) {
  // Pop the top number on the stack, and divide the new top number
  // by it. In case of division by zero, replace the top by #DIV/0!
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('DIV (' + d.join(', ') + ')');
    if(Math.abs(d[1]) <= VM.NEAR_ZERO) {
      x.retop(VM.DIV_ZERO);
    } else {
      x.retop(d[0] / d[1]);
    }
  }
}

function VMI_mod(x) {
  // Perform a "floating point MOD operation" as explained below.
  // Pop the top number on the stack. If zero, push error code #DIV/0!.
  // Otherwise, proceed: divide the new top number by the divisor, take
  // the fraction part, and multiply this with the divisor.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('DIV (' + d.join(', ') + ')');
    if(Math.abs(d[1]) <= VM.NEAR_ZERO) {
      x.retop(VM.DIV_ZERO);
    } else {
      x.retop(d[0] % d[1]);  // % is the modulo operator in JavaScript.
    }
  }
}

function VMI_negate(x) {
  // Perform a negation on the top number of the stack.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('NEG ' + d);
    x.retop(-d);
  }
}

function VMI_power(x) {
  // Pop the top number on the stack, and raise the new top number
  // to its power.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('POWER (' + d.join(', ') + ')');
    x.retop(Math.pow(d[0], d[1]));
  }
}

function VMI_sqrt(x) {
  // Replace the top number of the stack by its square root, or by
  // error code #VALUE! if the top number is negative.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('SQRT ' + d);
    if(d < 0) {
      x.retop(VM.BAD_CALC);
    } else {
      x.retop(Math.sqrt(d));
    }
  }
}

function VMI_sin(x) {
  // Replace the top number X of the stack by sin(X).
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('SIN ' + d);
    x.retop(Math.sin(d));
  }
}

function VMI_cos(x) {
  // Replace the top number X of the stack by cos(X).
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('COS ' + d);
    x.retop(Math.cos(d));
  }
}

function VMI_atan(x) {
  // Replace the top number X of the stack by atan(X).
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('ATAN ' + d);
    x.retop(Math.atan(d));
  }
}

function VMI_ln(x) {
  // Replace the top number X of the stack by ln(X), or by error
  // code #VALUE! if X is negative.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('LN ' + d);
    if(d < 0) {
      x.retop(VM.BAD_CALC);
    } else {
      x.retop(Math.log(d));
    }
  }
}

function VMI_exp(x) {
  // Replace the top number X of the stack by exp(X).
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('EXP ' + d);
    x.retop(Math.exp(d));
  }
}

function VMI_log(x) {
  // Pop the top number B from the stack, and replace the new top
  // number A by A log B. NOTE: x = A log B  <=>  x = ln(B) / ln(A)
  let d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('LOG (' + d.join(', ') + ')');
    try {
      d = Math.log(d[1]) / Math.log(d[0]);
    } catch(err) {
      d = VM.BAD_CALC;
    }
    x.retop(d);
  }
}

function VMI_round(x) {
  // Replace the top number X of the stack by round(X).
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('ROUND ' + d);
    x.retop(Math.round(d));
  }
}

function VMI_int(x) {
  // Replace the top number X of the stack by its integer part.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('INT ' + d);
    x.retop(Math.trunc(d));
  }
}

function VMI_fract(x) {
  // Replace the top number X of the stack by its fraction part.
  const d = x.top();
  if(d !== false) {
    if(DEBUGGING) console.log('FRACT ' + d);
    x.retop(d - Math.trunc(d));
  }
}

function VMI_exponential(x) {
  // Replace the top number X of the stack by a random number from the
  // negative exponential distribution with parameter X (so X is the lambda,
  // and the mean will be 1/X).
  const d = x.top();
  if(d !== false) {
    const a = randomExponential(d);
    if(DEBUGGING) console.log(`EXPONENTIAL ${d} = ${a}`);
    x.retop(a);
  }
}

function VMI_poisson(x) {
  // Replace the top number X of the stack by a random number from the
  // poisson distribution with parameter X (so X is the mean value lambda).
  const d = x.top();
  if(d !== false) {
    const a = randomPoisson(d);
    if(DEBUGGING) console.log('POISSON ' + d + ' = ' + a);
    x.retop(a);
  }
}

function VMI_binomial(x) {
  // Replace the top list (!) A of the stack by Bin(A[0], A[1]), i.e.,
  // a random number from the binomial distribution with n = A[0] and
  // p = A[1].
  const d = x.top();
  if(d !== false) {
    if(d instanceof Array && d.length === 2) {
      a = randomBinomial(...d);
      if(DEBUGGING) console.log('BINOMIAL (' + d.join(', ') + ') = ' + a);
      x.retop(a);
    } else {
      if(DEBUGGING) console.log('BINOMIAL: invalid parameter(s) ' + d);
      x.retop(VM.PARAMS);
    }
  }
}

function VMI_normal(x) {
  // Replace the top list (!) A of the stack by N(A[0], A[1]), i.e.,
  // a random number from the normal distribution with mu = A[0] and
  // sigma = A[1].
  const d = x.top();
  if(d !== false) {
    if(d instanceof Array && d.length === 2) {
      a = randomNormal(...d);
      if(DEBUGGING) console.log('NORMAL (' + d.join(', ') + ') = ' + a);
      x.retop(a);
    } else {
      if(DEBUGGING) console.log('NORMAL: invalid parameter(s) ' + d);
      x.retop(VM.PARAMS);
    }
  }
}

function VMI_weibull(x) {
  // Replace the top list (!) A of the stack by Weibull(A[0], A[1]), i.e.,
  // a random number from the Weibull distribution with lambda = A[0]
  // and k = A[1].
  const d = x.top();
  if(d !== false) {
    if(d instanceof Array && d.length === 2) {
      const a = randomWeibull(...d);
      if(DEBUGGING) console.log('WEIBULL (' + d.join(', ') + ') = ' + a);
      x.retop(a);
    } else {
      if(DEBUGGING) console.log('WEIBULL: invalid parameter(s) ' + d);
      x.retop(VM.PARAMS);
    }
  }
}

function VMI_triangular(x) {
  // Replaces the top list (!) A of the stack by Tri(A[0], A[1]), A[2]),
  // i.e., a random number from the triangular distribution with a = A[0],
  // b = A[1], and c = A[2]. NOTE: if only 2 parameters are passed, c is
  // assumed to equal (a + b) / 2.
  const d = x.top();
  if(d !== false) {
    if(d instanceof Array && (d.length === 2 || d.length === 3)) {
      const a = randomTriangular(...d);
      if(DEBUGGING) console.log('TRIANGULAR (' + d.join(', ') + ') = ' + a);
      x.retop(a);
    } else {
      if(DEBUGGING) console.log('TRIANGULAR: invalid parameter(s) ' + d);
      x.retop(VM.PARAMS);
    }
  }
}

function VMI_min(x) {
  // Replace the top list (!) A of the stack by the lowest value in this
  // list. If A is not a list, A is left on the stack.
  const d = x.top();
  if(d !== false && d instanceof Array) {
    if(DEBUGGING) console.log('MIN (' + d.join(', ') + ')');
    x.retop(Math.min(...d));
  } else if(DEBUGGING) {
    console.log('MIN (' + d + ')');
  }
}

function VMI_max(x) {
  // Replace the top list (!) A of the stack by the highest value in this
  // list. If A is not a list, A is left on the stack.
  const d = x.top();
  if(d !== false && d instanceof Array) {
    if(DEBUGGING) console.log('MAX (' + d.join(', ') + ')');
    x.retop(Math.max(...d));
  } else if(DEBUGGING) {
    console.log('MAX (' + d + ')');
  }
}

function VMI_concat(x) {
  // Pop the top number B from the stack, and then replace the new top
  // element A by [A, B] if A is a number, or add B to A if A is a list
  // of numbers (!), or concatenate if A and B both are lists.
  const d = x.pop();
  if(d !== false) {
    if(DEBUGGING) console.log('CONCAT (' + d.join(', ') + ')');
    const a = d[0], b = d[1];
    if(a instanceof Array) {
      if(b instanceof Array) {
        x.retop(a.concat(b));
      } else {
        a.push(b);
        x.retop(a);
      }
    } else {
      x.retop([a, b]);
    }
  }
}

function VMI_jump(x, index) {
  // Set the program counter of the VM to `index` minus 1, as the
  // counter is ALWAYS increased by 1 after calling a VMI function.
  if(DEBUGGING) console.log('JUMP ' + index);
  x.program_counter = index - 1;
}

function VMI_jump_if_false(x, index) {
  // Test the top number A on the stack, and if A is FALSE (zero or
  // VM.UNDEFINED) set the program counter of the VM to `index` minus 1,
  // as the counter is ALWAYS increased by 1 after calling a VMI function.
  const r = x.top(true);
  if(DEBUGGING) console.log(`JUMP-IF-FALSE (${r}, ${index})`);
  if(r === 0 || r === VM.UNDEFINED || r === false) {
    // Only jump on FALSE, leaving the stack "as is", so that in case
    // of no THEN, the expression result equals the IF condition value.
    // NOTE: Also do this on a stack error (r === false).
    x.program_counter = index - 1;
  } else {
    // Remove the value from the stack.
    x.stack.pop();
  }
}

function VMI_pop_false(x) {
  // Remove the top value from the stack, which should be 0 or
  // VM.UNDEFINED (but this is not checked).
  const r = x.stack.pop();
  if(DEBUGGING) console.log(`POP-FALSE (${r})`);
}

function VMI_if_then(x) {
  // NO operation -- as of version 1.0.14, this function only serves as
  // placeholder in operator symbol arrays. The parser should no longer
  // code this, so its execution would indicate an error.
  console.log('WARNING: IF-THEN instruction is obsolete', x);
}

function VMI_if_else(x) {
  // NO operation -- as of version 1.0.14, this function only serves as
  // placeholder in operator symbol arrays. The parser should no longer
  // code this, so its execution would indicate an error.
  console.log('WARNING: IF-ELSE instruction is obsolete', x);
}

//
// Functions that implement random numbers from specific distribution.
//

function randomExponential(lambda) {
  // Return a random number drawn from a Exp(lambda) distribution.
  return -Math.log(Math.random()) / lambda;
}

function randomWeibull(lambda, k) {
  // Return a random number drawn from a Weibull(lambda, k) distribution.
  if(Math.abs(k) < VM.NEAR_ZERO) return VM.DIV_ZERO;
  return lambda * Math.pow(-Math.log(Math.random()), 1.0 / k);
}

function randomTriangular(a, b, c=0.5*(a + b)) {
  // Return a random number drawn from a Triangular(a, b, c) distribution.
  const u = Math.random(), b_a = b - a, c_a = c - a;
  if(u < c_a / b_a) {
    return a + Math.sqrt(u * b_a * c_a);
  } else {
    return b - Math.sqrt((1 - u) * b_a * (b - c)); 
  }
}

function randomNormal(mean, std) {
  // Return a random number drawn from a N(mean, standard deviation)
  // distribution.
  const
    a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969,
    a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924,
    b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887,
    b4 = 66.8013118877197, b5 = -13.2806815528857,
    c1 = -7.78489400243029E-03, c2 = -0.322396458041136,
    c3 = -2.40075827716184, c4 = -2.54973253934373, c5 = 4.37466414146497,
    c6 = 2.93816398269878,
    d1 = 7.78469570904146E-03, d2 = 0.32246712907004, d3 = 2.445134137143,
    d4 = 3.75440866190742,
    p = Math.random(), p_low = 0.02425, p_high = 1 - p_low;
  let q, r, zn = 0, zd = 1;
  if(p >= p_low && p <= p_high) {
    q = p - 0.5;
    r = q * q;
    zn = (((((a1*r + a2)*r + a3)*r + a4)*r + a5)*r + a6)*q;
    zd = ((((b1*r + b2)*r + b3)*r + b4)*r + b5)*r + 1;
  } else {
    q = Math.sqrt(-2 * Math.log(p < p_low ? p : 1 - p));
    zn = ((((c1*q + c2)*q + c3)*q + c4)*q + c5)*q + c6;
    zd = (((d1*q + d2)*q + d3)*q + d4)* q + 1;
    if(p > p_high) zn = -zn;
  }
  return mean + std * zn / zd;
}

function randomBinomial(n, p) {
  const pp = (p > 0.5 ? 1.0 - p : p),
        log_q = Math.log(1.0 - pp);
  let x = 0, sum = 0;
  while(true) {
    sum += Math.log(Math.random()) / (n - x);
    if(sum < log_q) return (pp === p ? x : n - x);
    x++;
  }
}

// Function that computes the cumulative probability P(X <= x) when X
// has a N(mu, sigma) distribution. Accuracy is about 1e-6.
function normalCumulativeProbability(mu, sigma, x) {
	const
      t = 1 / (1 + 0.2316419 * Math.abs(x)),
	    d = 0.3989423 * Math.exp(-0.5 * x * x),
	    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 +
          t * (-1.821256 + T * 1.330274))));
	if(x > 0) return 1 - p;
	return p;
}   

// Global array as cache for computation of factorial numbers.
const FACTORIALS = [0, 1];

function factorial(n) {
  // Fast factorial function using pre-calculated values up to n = 100.
  const l = FACTORIALS.length;
  if(n < l) return FACTORIALS[n];
  let f = FACTORIALS[l - 1];
  for(let i = l; i <= n; i++) {
    f *= i;
    FACTORIALS.push(f);
  }
  return f;
}

function randomPoisson(lambda) {
  if(lambda < 30) {
    // Use Knuth's algorithm.
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do {
      k++;
      p *= Math.random();
    } while(p > L);
    return k - 1;
  } else {
    // Use "method PA" from Atkinson, A.C. (1979). The Computer Generation
    // of Poisson Random Variables, Journal of the Royal Statistical Society
    // Series C (Applied Statistics), 28(1): 29-35.
    const c = 0.767 - 3.36 / lambda,
          beta = Math.PI / Math.sqrt(3.0 * lambda),
          alpha = beta * lambda,
          k = Math.log(c) - lambda - Math.log(beta);
    let n, u, v, x, y, lhs, rhs; 
    while(true) {
      u = Math.random();
      x = (alpha - Math.log((1.0 - u) / u)) / beta;
      n = Math.floor(x + 0.5);
      if(n < 0) continue;
      v = Math.random();
      y = alpha - beta * x;
      lhs = y + Math.log(Math.pow(v / (1.0 + Math.exp(y)), 2));
      rhs = k + n * Math.log(lambda) - Math.log(factorial(n));
      if(lhs <= rhs) return n;
    }
  }
}

const
  // Valid symbols in expressions
  PARENTHESES = '()',
  OPERATOR_CHARS = ';?:+-*/%=!<>^|',
  // Opening bracket, space and single quote indicate a separation
  SEPARATOR_CHARS = PARENTHESES + OPERATOR_CHARS + "[ '",
  COMPOUND_OPERATORS = ['!=', '<>', '>=', '<='],
  CONSTANT_SYMBOLS = [
      'c', 'now', 'random', 'true', 'false', 'pi', 'infinity', '#',
      'yr', 'wk', 'd', 'h', 'm', 's'],
  CONSTANT_CODES = [
      VMI_push_time_step, VMI_push_clock_time,
      VMI_push_random, VMI_push_true, VMI_push_false,
      VMI_push_pi, VMI_push_infinity, VMI_push_contextual_number,
      VMI_push_year, VMI_push_week, VMI_push_day, VMI_push_hour,
      VMI_push_minute, VMI_push_second],
  DYNAMIC_SYMBOLS = ['c', 'now', 'random', 'wait', 'waituntil'],
  MONADIC_OPERATORS = [
      '~', 'not', 'abs', 'sin', 'cos', 'atan', 'ln',
      'exp', 'sqrt', 'round', 'int', 'fract', 'min', 'max',
      'binomial', 'exponential', 'normal', 'poisson', 'triangular',
      'weibull', 'waituntil', 'wait'],
  MONADIC_CODES = [
      VMI_negate, VMI_not, VMI_abs, VMI_sin, VMI_cos, VMI_atan, VMI_ln,
      VMI_exp, VMI_sqrt, VMI_round, VMI_int, VMI_fract, VMI_min, VMI_max,
      VMI_binomial, VMI_exponential, VMI_normal, VMI_poisson, VMI_triangular,
      VMI_weibull, VMI_wait_until, VMI_wait],
  DYADIC_OPERATORS = [
      ';', '?', ':', 'or', 'and',
      '=', '<>', '!=',
      '>', '<', '>=', '<=', '+', '-', '*', '/',
      '%', '^', 'log', '|'],
  DYADIC_CODES = [
      VMI_concat, VMI_if_then, VMI_if_else, VMI_or, VMI_and,
      VMI_eq, VMI_ne, VMI_ne, VMI_gt, VMI_lt, VMI_ge, VMI_le,
      VMI_add, VMI_sub, VMI_mul, VMI_div, VMI_mod,
      VMI_power, VMI_log, VMI_replace_undefined],

  // Compiler checks for random codes as they make an expression dynamic
  RANDOM_CODES = [VMI_binomial, VMI_exponential, VMI_normal, VMI_poisson,
      VMI_triangular, VMI_weibull],
  
  // Compiler checks for reducing codes to unset its "concatenating" flag
  REDUCING_CODES = [VMI_min, VMI_max, VMI_binomial, VMI_normal,
      VMI_triangular, VMI_weibull],
  
  OPERATORS = DYADIC_OPERATORS.concat(MONADIC_OPERATORS), 
  OPERATOR_CODES = DYADIC_CODES.concat(MONADIC_CODES),
  PRIORITIES = [1, 2, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 6, 6, 7, 7, 7, 8, 8, 10,
      9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
  ACTUAL_SYMBOLS = CONSTANT_SYMBOLS.concat(OPERATORS),
  SYMBOL_CODES = CONSTANT_CODES.concat(OPERATOR_CODES);


