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
        'click', () => ACTOR_MANAGER.modifyActor());
    this.actor_modal.cancel.addEventListener(
        'click', () => ACTOR_MANAGER.actor_modal.hide());
  }
  
  showDialog() {
    // Collect data on the actors and show the modal dialog.
    MODEL.cleanUpActors();
    this.selected_actor_id = '';
    this.actor_data = {};
    for(let k in MODEL.actors) if(MODEL.actors.hasOwnProperty(k)) {
      const a = MODEL.actors[k];
      this.actor_data[k] = {name: a.name, color: a.color, lc: a.leafCount};
    }
    this.updateDialog();
    UI.modals.actors.show();
  }
  
  updateDialog() {
    // Display the actor data.
    const html = [];
    for(let k in this.actor_data) if(this.actor_data.hasOwnProperty(k)) {
      const a = this.actor_data[k];
      html.push(`<tr onclick="ACTOR_MANAGER.showActorModal('`, k,
          `')" onmouseover="DOCUMENTATION_MANAGER.update(MODEL.actorByID('`,
          k, `'), event.shiftKey)"><td class="a-name">`, a.name,
          `</td><td><div style="background-color: ${a.color}"></div></td>`,
          `<td>${a.lc}</td></tr>`);
    }
    this.table.innerHTML = html.join('');
  }

  showActorModal(id) {
    // Display modal for actor identified by `id`.
    const
        a = this.actor_data[id],
        md = UI.modals.actor,
        ne = md.element('name');
    this.selected_actor_id = id;
    ne.value = a.name;
    // Do not allow modification of the name '(no actor)' (but this action
    // should not be possible anyway).
    if(a.name === UI.NO_ACTOR) {
      ne.disabled = true;
    } else {
      ne.disabled = false;
    }
    md.element('color').value = a.color;
    md.show();
  }
  
  modifyActor() {
    // Update the properties of the edited actor.
    const
        md = UI.modals.actor,
        n = md.element('name').value.trim(),
        obj = MODEL.objectByName(n),
        aid = this.selected_actor_id;
    if(obj && obj !== MODEL.actors[aid]) {
      UI.warningEntityExists(obj);
      return false;
    }
    // Store new name -- the actual renaming occurs only when the ACTORS
    // modal is closed with OK.
    this.actor_data[aid].name = n;
    // Change color.
    this.actor_data[aid].color = md.element('color').value;
    md.hide();
    // Redraw the actors dialog to reflect changes made.
    this.updateDialog();
  }
  
  updateActorProperties() {
    // Effectuate the changes made to actors, and redraw the diagram.
    for(let k in this.actor_data) if(this.actor_data.hasOwnProperty(k)) {
      const
          da = this.actor_data[k],
          aa = MODEL.actors[k];
      if(da && aa) {
        if(da.name !== aa.name) aa.rename(da.name);
        aa.color = da.color;
      }
    }
    UI.modals.actors.hide();
    UI.drawDiagram(MODEL);
  }

} // END of class ActorManager

