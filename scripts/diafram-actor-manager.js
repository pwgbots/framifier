/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-actor-manager.js) provides the GUI
functionality for the diaFRAM actor manager: the modal dialog that
allows renaming actors an changing their color.
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

// CLASS ActorManager (modal dialog!)
class ActorManager {
  constructor() {
    // Make the Actors modal buttons responsive
    UI.modals.actors.ok.addEventListener(
        'click', () => ACTOR_MANAGER.updateActorProperties());
    UI.modals.actors.cancel.addEventListener(
        'click', () => UI.modals.actors.hide());
    this.dialog = document.getElementById('actors-dlg');
    this.table = document.getElementById('actors-table');
    // Modal related to this dialog
    this.actor_modal = new ModalDialog('actor');
    this.actor_modal.ok.addEventListener(
        'click', () => ACTOR_MANAGER.setColor());
    this.actor_modal.cancel.addEventListener(
        'click', () => ACTOR_MANAGER.color_modal.hide());
    this.actor_name = document.getElementById('actor-name');
  }
  
  showDialog() {
    // Display the "actor list view" modal
    let html = [];
    MODEL.cleanUpActors();
    for(let k in MODEL.actors) if(MODEL.actors.hasOwnProperty(k)) {
      const a = MODEL.actors[k];
      html.push(`<tr class="variable" onclick="ACTOR_MANAGER.editActor('`, k,
          `')" onmouseover="DOCUMENTATION_MANAGER.update(MODEL.actorByID('`,
          k, `'), event.shiftKey)"><td class="a-name">`, a.name,
          `</td><td style="background-color: ${a.color}">&nbsp;</td></tr>`);
    }
    this.table.innerHTML = html.join('');
    UI.modals.actors.show();
  }

  showActorModal(id) {
    // Display modal for actor identified by `id`.
    const
        a = MODEL.actorByID(id),
        md = UI.modals.actor,
        ne = md.element('name');
    ne.value = a.name;
    // Do not allow modification of the name '(no actor)'
    if(a.name === UI.NO_ACTOR) {
      ne.disabled = true;
    } else {
      ne.disabled = false;
    }
    // Set the color picker.
    md.show();
  }
  
  modifyActor() {
    // Update the properties of the edited actor.
    const
        md = UI.modals.actor,
        n = md.element('name').value.trim();
    if(n !== UI.NO_ACTOR) {
      // NOTE: prohibit colons in actor names to avoid confusion with
      // prefixed entities
      if(!UI.validName(n) || n.indexOf(':') >= 0) {
        UI.warn(UI.WARNING.INVALID_ACTOR_NAME);
        return false;
      }
    }
    // Rename actor.
    // Change color.
    md.hide();
  }

} // END of class ActorManager

