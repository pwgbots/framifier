/*
FRAMifier is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (framifier-undo.js) provides the GUI undo/redo
functionality for the FRAMifier model editor.

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

// CLASS UndoEdit
class UndoEdit {
  constructor(action) {
    this.action = action;
    // NOTE: Store present focal activity, as modeler may move to other
    // activities after an edit 
    this.activity = MODEL.focal_activity;
    this.object_id = null;
    // NOTE: the properties stored for an edit may differ, depending on
    // the action.
    this.properties = [];
    // Undo may involve restoring the `selected` property of selected items.
    this.selection = [];
    this.selected_aspect = null;
    this.selected_aspect_link = null;
    this.xml = '';
  }
  
  get fullAction() {
    // Return a string that reflects this edit action.
    // If the identifier is set, return the action followed by the class name 
    // of the object. NOTE: `obj` should then not be NULL, but check anyway
    if(this.action === 'drop' || this.action == 'lift') {
      return `Move ${pluralS(this.properties.length, 'function')} to function ` +
          MODEL.objectByID(this.object_id).displayName;
    } else if(this.object_id) {
      const
          obj = MODEL.objectByID(this.object_id),
          obt = (obj ? obj.type.toLowerCase() : 'UNKOWN ' + this.object_id);
      return this.action + ' ' + obt;
    // A REDO of "add" has as properties [class name, identifier] of the
    // added object.  
    } else if(this.action === 'add' && this.properties.length === 2) {
      return 'add ' + this.properties[0].toLowerCase();
    }
    // By default, return the action without further specification
    return this.action;
  }

  setSelection() {
    // Compile the list of IDs of selected entities.
    this.selection.length = 0;
    for(let i = 0; i < MODEL.selection.length; i++) {
      this.selection.push(MODEL.selection[i].identifier);
    }
    this.selected_aspect = MODEL.selected_aspect;
    this.selected_aspect_link = MODEL.selected_aspect_link;
  }
  
  get getSelection() {
    // Return the list of entities that were selected at the time of the
    // action.
    const ol = [];
    for(let i = 0; i < this.selection.length; i++) {
      const obj = MODEL.objectByID(this.selection[i]);
      // Guard against pushing NULL pointers in case object is not found
      if(obj) ol.push(obj);
    }
    return ol;
  }
} // END of class UndoEdit


// CLASS UndoStack
// NOTE: this object actually comprises TWO stacks -- one with undoable actions
// and one with redoable actions
class UndoStack {
  constructor() {
    this.undoables = [];
    this.redoables = [];
    this.clear();
  }
  
  clear() {
    this.undoables.length = 0;
    this.redoables.length = 0;
  }
  
  get topUndo() {
    // Return the short name of the top undoable action (if any)
    const i = this.undoables.length;
    if(i > 0) return this.undoables[i - 1].action;
    return false;    
  }

  get canUndo() {
    // Return the "display name" of the top undoable action (if any)
    const i = this.undoables.length;
    if(i > 0) return `Undo "${this.undoables[i - 1].fullAction}"`;
    return false;
  }
  
  get topRedo() {
    // Return the short name of the top undoable action (if any)
    const i = this.redoables.length;
    if(i > 0) return this.redoables[i - 1].action;
    return false;    
  }

  get canRedo() {
    // Return the "display name" of the top redoable action (if any)
    const i = this.redoables.length;
    if(i > 0) return `Redo "${this.redoables[i - 1].fullAction}"`;
    return false;
  }
  
  addXML(xml) {
    // Insert xml at the start (!) of any XML added previously to the UndoEdit
    // at the top of the UNDO stack
    const i = this.undoables.length;
    if(i === 0) return false;
    this.undoables[i-1].xml = xml + this.undoables[i-1].xml;
  }

  addOffset(dx, dy) {
    // Add (dx, dy) to the offset of the "move" UndoEdit that should be at the
    // top of the UNDO stack
    let i = this.undoables.length;
    if(i === 0) return false;
    this.undoables[i-1].properties[3] += dx;
    this.undoables[i-1].properties[4] += dy;
  }

  push(action, args=null, tentative=false) {
    // Add an UndoEdit to the undo stack, labeled with edit action that is
    // about to be performed. NOTE: the IDs of objects are stored, rather
    // than the objects themselves, because deleted objects will have different
    // memory addresses when restored by an UNDO.

    // Any action except "move" or "add note" is likely to invalidate the
    // solver result.
    if(action !== 'move' && !(args instanceof Note)) VM.reset();

    // If this edit is new (i.e., not a redo) then remove all "redoable" edits
    if(!tentative) this.redoables.length = 0;
    // If the undo stack is full then discard its bottom edit
    if(this.undoables.length == CONFIGURATION.undo_stack_size) this.undoables.splice(0, 1);
    const ue = new UndoEdit(action);
    // For specific actions, store the IDs of the selected entities
    if(['move', 'delete', 'drop', 'lift'].indexOf(action) >= 0) {
      ue.setSelection();
    }
    // Set the properties of this undoable, depending on the type of action
    if(action === 'move') {
      // `args` holds the dragged node => store its ID and position
      ue.properties = [args.identifier, args.x, args.y, 0, 0];
      // NOTE: object_id is NOT set, as dragged selection may contain
      // multiple entities
    } else if(action === 'add') {
      // `args` holds the added entity => store its ID
      ue.object_id = args.identifier;
    } else if(action === 'drop' || action === 'lift') {
      // Store ID of target activity
      ue.object_id = args.identifier;
      ue.properties = MODEL.getSelectionPositions;
    } else if(action === 'replace') {
      // Replace passes its undo information as an object
      ue.properties = args;
    }

    // NOTE: for a DELETE action, no properties are stored; the XML needed to
    // restore deleted entities will be added by the respective delete methods

    // Push the new edit onto the UNDO stack
    this.undoables.push(ue);
    // Update the GUI buttons
    UI.updateButtons();
    // NOTE: update the Finder only if needed, and with a delay because
    // the "prepare for undo" is performed before the actual change 
    if(action !== 'move') setTimeout(() => { FINDER.updateDialog(); }, 5);
//console.log('push ' + action);
//console.log(UNDO_STACK);
  }

  pop(action='') {
    // Remove the top edit (if any) from the stack if it has the specified action
    // NOTE: pop does NOT undo the action (the model is not modified)
    let i = this.undoables.length - 1;
    if(i >= 0 && (action === '' || this.undoables[i].action === action)) {
      this.undoables.pop();
      UI.updateButtons();
    }
//console.log('pop ' + action);
//console.log(UNDO_STACK);
  }

  doMove(ue) {
    // This method implements shared code for UNDO and REDO of "move" actions
    // First get the dragged node
    let obj = MODEL.objectByID(ue.properties[0]); 
    if(obj) {
      // Calculate the relative move (dx, dy)
      const
          dx = ue.properties[1] - obj.x,
          dy = ue.properties[2] - obj.y,
          tdx = -ue.properties[3],
          tdy = -ue.properties[4];
      // Update the undo edit's x and y properties so that it can be pushed onto
      // the other stack (as the dragged node ID and the selection stays the same)
      ue.properties[1] = obj.x;
      ue.properties[2] = obj.y;
      // Prepare to translate back (NOTE: this will also prepare for REDO)
      ue.properties[3] = tdx;
      ue.properties[4] = tdy;
      // Translate the entire graph (NOTE: this does nothing if dx and dy both equal 0)
      MODEL.translateGraph(tdx, tdy);
      // Restore the selection as it was at the time of the "move" action
      MODEL.selectList(ue.getSelection);
      MODEL.selected_aspect = ue.selected_aspect;
      MODEL.selected_aspect_link = ue.selected_aspect_link;
      // Move the selection back to its original position
      MODEL.moveSelection(dx - tdx, dy - tdy);
    }
  }
  
  restoreFromXML(xml) {
    // Restore deleted objects from XML and add them to the UndoEdit's
    // selection (so that they can be RE-deleted).
    // NOTES:
    // (1) Store focal activity, because this may change while initializing
    //     an activity from XML.
    // (2) Set "selected" attribute of objects to FALSE, as the selection
    //     will be restored from UndoEdit.
    // (3) Keep track of a restored aspect, because this must be selected
    //     after completing the undo.
    let ra = null,
        ral = null;
    MODEL.orphan_list.length = 0;
    const n = parseXML(MODEL.xml_header + `<edits>${xml}</edits>`);
    if(n && n.childNodes) {
      let c,
          li = [];  
      for(let i = 0; i < n.childNodes.length; i++) {
        c = n.childNodes[i];
        if(c.nodeName === 'actor') {
          MODEL.addActor(xmlDecoded(nodeContentByTag(c, 'name')), c);
        } else if(c.nodeName === 'note') {
          const obj = MODEL.addNote(c);
          obj.selected = false;
        } else if(c.nodeName === 'activity') {
          const obj = MODEL.addActivity(
              xmlDecoded(nodeContentByTag(c, 'name')),
              xmlDecoded(nodeContentByTag(c, 'owner')), c);
          obj.selected = false;
        } else if(c.nodeName === 'aspect') {
          // Add aspect without specifying a link.
          MODEL.addAspect(xmlDecoded(nodeContentByTag(c, 'name')),
              null, c);
        // ... but merely collect indices of link-related nodes to save
        // the effort to iterate over ALL childnodes again.
        } else if(c.nodeName.startsWith('link')) {
          li.push(i);
        }
      }
      // Re-establish activity hierarchy.
      MODEL.rescueOrphans();  
      for(let i = 0; i < li.length; i++) {
        c = n.childNodes[li[i]];
        // Double-check that this node relates to a link.
        if(c.nodeName === 'link') {
          const
              fc = nodeContentByTag(c, 'from-code'),
              fa = MODEL.activityByCode(fc),
              tc = nodeContentByTag(c, 'to-code'),
              ta = MODEL.activityByCode(tc);
          if(fa && ta) {
            MODEL.addLink(fa, ta, nodeParameterValue(c, 'connector'), c)
                .selected = false;
          } else {
            console.log('ERROR: Failed to add link from', fc, 'to', tc);
          }
        } else if(c.nodeName === 'link-aspect') {
          const
              a = MODEL.aspectByCode(nodeParameterValue(c, 'code')),
              l = MODEL.linkByID(nodeParameterValue(c, 'link'));
          if(a && l) {
            ra = MODEL.addAspect(a.name, l);
            ral = l;
          } else {
            console.log('ANOMALY: Failed to restore aspect on link', c);
          }
        }
      }
    }
    MODEL.clearSelection();
    // Select the link asect only now (after clearing the selection).
    if(ra && ral) MODEL.selectAspect(ra, ral);
  }
  
  undo() {
    // Undo the most recent "undoable" action
    let ue;
    if(this.undoables.length > 0) {
      UI.reset();
      // Get the action to be undone
      ue = this.undoables.pop();
      // Focus on the activity that was focal at the time of action.
      // NOTE: Do this WITHOUT calling UI.makeFocalActivity because this
      // clears the selection and redraws the graph.
      MODEL.focal_activity = ue.activity;
//console.log('undo' + ue.fullAction);
//console.log(ue);
      if(ue.action === 'move') {
        this.doMove(ue);
        // NOTE: doMove modifies the undo edit so that it can be used as redo edit
        this.redoables.push(ue);
      } else if(ue.action === 'add') {
        // UNDO add means deleting the lastly added entity
        let obj = MODEL.objectByID(ue.object_id);
        if(obj) {
          // Prepare UndoEdit for redo
          const ot = obj.type;
          // Set properties to [class name, identifier] (for tooltip display and redo)
          ue.properties = [ot, ue.object_id];
          // NOTE: `action` remains "add", but ID is set to null because otherwise
          // the fullAction method would fail
          ue.object_id = null;
          // Push the "delete" UndoEdit back onto the undo stack so that XML will
          // be added to it
          this.undoables.push(ue);
          // Mimic the exact selection state immediately after adding the entity
          MODEL.clearSelection();
          MODEL.select(obj);
          // Execute the proper delete, depending on the type of entity
          if(ot === 'Link') {
            MODEL.deleteLink(obj);
          } else if(ot === 'Note') {
            MODEL.focal_activity.deleteNote(obj);
          } else if(ot === 'Activity') {
            MODEL.deleteActivity(obj);
          }
          // Clear the model's selection, since we've bypassed the regular
          // `deleteSelection` routine
          MODEL.selection.length = 0;
          // Move the UndoEdit to the redo stack
          this.redoables.push(this.undoables.pop());
        }
      } else if(ue.action === 'delete') {
        this.restoreFromXML(ue.xml);
        // Restore the selection as it was at the time of the "delete"
        // action *unless* a link aspect has been restored. 
        if(!MODEL.selected_aspect) MODEL.selectList(ue.getSelection);
        // Clear the XML (not useful for REDO delete)
        ue.xml = '';
        this.redoables.push(ue);
      } else if(ue.action === 'drop' || ue.action === 'lift') {
        // Restore the selection as it was at the time of the action
        MODEL.selectList(ue.getSelection);
        // NOTE: first focus on the original target activity
        MODEL.focal_activity = MODEL.objectByID(ue.object_id);
        // Drop the selection "back" to the focal activity
        MODEL.dropSelectionIntoActivity(ue.parent);
        // Refocus on the original focal activity.
        MODEL.focal_activity = ue.parent;
        // NOTE: Now restore the selection in THIS activity!
        MODEL.selectList(ue.getSelection);
        // Now restore the position of the nodes.
        MODEL.setSelectionPositions(ue.properties);
        this.redoables.push(ue);
        // NOTE: A drop action will always be preceded by a move action. 
        if(ue.action === 'drop') {
          // Double-check, and if so, undo this move as well.
          if(this.topUndo === 'move') this.undo();
        }
      }
      // Update the main window
      UI.drawDiagram(MODEL);
      UI.updateButtons();
      // Update the Finder if needed
      if(ue.action !== 'move') FINDER.updateDialog();
    }
//console.log('undo');
//console.log(UNDO_STACK);
  }

  redo() {
    // Restore the model to its state prior to the last undo
    if(this.redoables.length > 0) {
      UI.reset();
      let re = this.redoables.pop();
//console.log('redo ' + re.fullAction);
//console.log(UNDO_STACK);
      // Focus on the activity that was focal at the time of action.
      // NOTE: No call to UI.makeFocalActivity because this clears the
      // selection and redraws the graph.
      MODEL.focal_activity = re.activity;
      if(re.action === 'move') {
        // NOTE: this is a mirror operation of the UNDO
        this.doMove(re);
        // NOTE: doMove modifies the RedoEdit so that it can be used as UndoEdit
        this.undoables.push(re);
        // NOTE: when next redoable action is "drop", redo this as well
        if(this.topRedo === 'drop') this.redo();
      } else if(re.action === 'add') {
//console.log('ADD redo properties:', re.properties);
        // NOTE: redo an undone "add" => mimick undoing a "delete"
        this.restoreFromXML(re.xml);
        // Clear the XML and restore the object identifier  
        re.xml = null;
        re.object_id = re.properties[1];
        this.undoables.push(re);
      } else if(re.action === 'delete') {
        // Check for deletion of an aspect.
        if(MODEL.selected_aspect && MODEL.selected_aspect_link) {
          this.undoables.push(re);
          MODEL.selected_aspect.removeFromLink(MODEL.selected_aspect_link);
        } else {
          // If not an aspect, restore the selection as it was at the
          // time of the "delete" action...
          MODEL.selectList(re.getSelection);
          this.undoables.push(re);
          // ... and then perform a delete action.
          MODEL.deleteSelection();
        }
      } else if(re.action === 'drop' || re.action === 'lift') {
        const a = MODEL.objectByID(re.object_id);
        if(a instanceof Activity) MODEL.dropSelectionIntoActivity(a);
      }
      UI.drawDiagram(MODEL);
      UI.updateButtons();
      if(re.action !== 'move') FINDER.updateDialog();
    } 
  }
} // END of class UndoStack
