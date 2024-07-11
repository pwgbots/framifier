/*
diaFRAM is an executable graphical editor in support of the Functional
Resonance Analysis Method developed originally by Erik Hollnagel.
This tool is developed by Pieter Bots at Delft University of Technology.

This JavaScript file (diafram-model.js) defines the object classes that
represent the diaFRAM model and its composing entities.
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

// CLASS diaFRAMModel
class diaFRAMModel {
  constructor(name, author) {
    this.name = name;
    this.author = author;
    this.comments = '';
    this.reset();
    this.xml_header = '<?xml version="1.0" encoding="ISO-8859-1"?>';
  }

  reset() { 
    // Reset model properties to their default values.
    const d = new Date();
    this.time_created = d;
    this.last_modified = d;
    this.version = DIAFRAM_VERSION;
    this.actors = {};
    this.activities = {};
    this.aspects = {};
    this.links = {};
    this.next_activity_number = 1;
    this.next_aspect_number = 1;
    this.focal_activity = null;
    this.top_activity = this.addActivity(UI.TOP_ACTIVITY_NAME, UI.NO_ACTOR);
    this.focal_activity = this.top_activity;
    
    this.actor_list = [];
    this.orphan_list = [];
    
    // Model settings.
    this.grid_pixels = 20;
    this.align_to_grid = true;
    this.show_block_arrows = true;
    this.last_zoom_factor = 1;
    
    // Diagram editor related properties.
    this.selected_aspect = null;
    this.selected_aspect_link = null;
    this.selection = [];
    // Set the indicator that the model has not been executed yet.
    this.set_up = false;
    this.solved = false;
    // t is the time step ("tick") shown.
    this.t = 1;
    this.run_length = 100;
  }
  
  // NOTE: A model can also be the entity for the documentation manager,
  // and hence should have the methods `type` and `displayName`.
  get type() {
    return 'Model';
  }

  get displayName() {
    return (this.name || '(no name)') +
        ' (' + (this.author || 'unknown author') + ')';
  }

  /* METHODS THAT LOOKUP ENTITIES, OR INFER PROPERTIES */

  get simulationTimeStep() {
    // Return actual model time step, rather than `t`, which is relative
    // to the start of the simulation period.
    return this.t;
  }
  
  get newActivityCode() {
    // Return the next unused activity code.
    const n = this.next_activity_number;
    this.next_activity_number++;
    // Activity codes are decimal number STRINGS.
    // NOTE: Activities are numbered zero-based, but displayed as 1, 2, etc.
    return '' + (n + 1);
  }
  
  get newAspectCode() {
    // Return the next unused link aspect code.
    const n = this.next_aspect_number;
    this.next_aspect_number++;
    // Aspect codes have format #lll where lll is a base-26 number with
    // A = 0, B = 1, ..., Z = 25, AA = 26, AB = 27, etc.
    return letterCode(n);
  }
  
  noteByID(id) {
    // NOTE: Note object identifiers have syntax #activity name#time stamp#
    const parts = id.split('#');
    // check whether the identifier matches this syntax 
    if(parts.length === 4 && this.activities.hasOwnProperty(parts[1])) {
      // if so, get the activity
      const c = this.activities[parts[1]];
      // then look in this activity for a note having the specified identifier
      for(let i = 0; i < c.notes.length; i++) {
        if(c.notes[i].identifier === id) return c.notes[i];
      }
    }
    return null;
  }

  aspectByID(id) {
    if(this.aspects.hasOwnProperty(id)) return this.aspects[id];
    return null;
  }
  
  aspectByCode(code) {
    for(let k in this.aspects) if(this.aspects.hasOwnProperty(k)) {
      const a = this.aspects[k];
      if(a.code === code) return a;
    }
    return null;
  }
  
  activityByID(id) {
    if(this.activities.hasOwnProperty(id)) return this.activities[id];
    return null;
  }
  
  activityByCode(code) {
    for(let k in this.activities) if(this.activities.hasOwnProperty(k)) {
      const a = this.activities[k];
      if(a.code === code) return a;
    }
    return null;
  }
  
  nodeBoxByID(id) {
    if(this.activities.hasOwnProperty(id)) return this.activities[id];
    if(this.aspects.hasOwnProperty(id)) return this.aspects[id];
    return null;
  }
  
  linkByID(id) {
    if(this.links.hasOwnProperty(id)) return this.links[id];
    return null;
  }

  actorByID(id) {
    if(this.actors.hasOwnProperty(id)) return this.actors[id];
    return null;
  }
  
  namedObjectByID(id) {
    // NOTE: not only entities, but also equations are "named objects", meaning
    // that their name must be unique in a model (unlike the titles of charts
    // and experiments)
    let obj = this.nodeBoxByID(id);
    if(obj) return obj;
    return this.actorByID(id);
  }
  
  objectByID(id) {
    let obj = this.namedObjectByID(id);
    if(obj) return obj;
    obj = this.linkByID(id);
    if(obj) return obj;
    return this.noteByID(id);
  }

  objectByName(name) {
    // Looks up a named object based on its display name.
    // NOTE: Top activity is uniquely identified by its name.
    if(name === UI.TOP_ACTIVITY_NAME) {
      return this.activities[UI.nameToID(UI.TOP_ACTIVITY_NAME)];
    }
    // Other names must be converted to an ID
    if(name.indexOf(UI.LINK_ARROW) >= 0) {
      // NOTE: link IDs are based on node codes, not node names
      const nn = name.split(UI.LINK_ARROW),
          // NOTE: recursive calls to objectByName
          fn = this.objectByName(nn[0]),
          // NOTE: Link names have connector symbol after arrow...
          tnc = [...nn[1]],
          // ... so this has to be removed...
          c = tnc.shift(),
          // ... before we can look up the activity name.
          tn = this.objectByName(tnc.join(''));
      if(i === 0) {
        // NOTE: three underscores denote the link arrow
        if(fn && tn) return this.linkByID(fn.code + '___' + c + tn.code);
        return null;
      }
    }
    // No link? Then standard conversion to ID.
    return this.namedObjectByID(UI.nameToID(name));
  }
  
  linksWithAspect(a) {
    // Return list of links having aspect `a`.
    const list = [];
    for(let k in this.links) if(this.links.hasOwnProperty(k)) {
      const l = this.links[k];
      if(l.aspects.indexOf(a) >= 0) list.push(l);
    }
    return list;
  }
  
  setByType(type) {
    // Return a "dictionary" object with entities of the specified types
    if(type === 'Function') return this.activities;
    if(type === 'Link') return this.links;
    if(type === 'Agent') return this.actors;
    if(type === 'Aspect') return this.aspects;
    return {};
  }
  
  get allEntities() {
    // Return a "dictionary" of all entities in the model.
    return Object.assign({},
        this.activities, this.links, this.aspects, this.actors);
  }
  
  allMatchingEntities(re) {
    // Return list of enties with a display name that matches RegExp `re`.
    // NOTE: This routine is computationally intensive as it performs
    // matches on the display names of entities while iterating over all
    // relevant entity sets.
    const
        me = [],
        res = re.toString();
        
    function scan(dict) {
      // Try to match all entities in `dict`.
      // NOTE: Ignore method identifiers.
      for(let k in dict) if(dict.hasOwnProperty(k)) {
        const
            e = dict[k],
            m = [...e.displayName.matchAll(re)];
        if(m.length > 0) {
          // If matches, ensure that the groups have identical values
          const n = parseInt(m[0][1]);
          let same = true;
          for(let i = 1; same && i < m.length; i++) {
            same = parseInt(m[i][1]) === n;
          }
          // If so, add the entity to the set.
          if(same) me.push(e);
        }
      }  
    }
    
    // Links limit the search.
    if(res.indexOf(UI.LINK_ARROW) >= 0) {
      scan(this.links);
    } else {
      scan(this.actors);
      scan(this.activities);
      scan(this.aspects);
      scan(this.links);
    }
    return me;
  }
  
  entitiesEndingOn(s, attr='') {
    // Return a list of entities (of any type) having a display name that
    // ends on string `s`.
    // NOTE: The current implementation will overlook links having a FROM
    // node that ends on `s`.
    const re = new RegExp(escapeRegex(s) + '$', 'gi');
    return this.allMatchingEntities(re, attr);
  }

  entitiesInString(s) {
    // Return a list of entities referenced in string `s`.
    if(s.indexOf('[') < 0) return [];
    const
        el = [],
        ml = [...s.matchAll(/\[(\{[^\}]+\}){0,1}([^\]]+)\]/g)];
    for(let i = 0; i < ml.length; i++) {
      const n = ml[i][2].trim();
      let sep = n.lastIndexOf('|');
      if(sep < 0) sep = n.lastIndexOf('@');
      const
          en = (sep < 0 ? n : n.substring(0, sep)).trim(),
          e = this.objectByName(en);
      if(e) addDistinct(e, el);
    }
    return el;
  }
  
  inferPrefix(obj) {
    // Return the inferred (!) prefixes of `obj` as a list
    if(obj) {
      const pl = UI.prefixesAndName(obj.displayName);
      if(pl.length > 1) {
        pl.pop();
        return pl;
      }
    }
    return [];
  }
  
  inferParentActivity(l) {
    // Find the best "parent" activity for link `l`.
    return l.from_activity;
  }

  //
  //  Methods that add an entity to the model
  //

  addActor(name, node=null) {
    name = UI.cleanName(name);
    if(name === '') return this.actors[UI.nameToID(UI.NO_ACTOR)];
    const id = UI.nameToID(name);
    if(!this.actors.hasOwnProperty(id)) {
      this.actors[id] = new Actor(name);
      if(node) {
        this.actors[id].initFromXML(node);
      }
    }
    return this.actors[id];
  }

  addNote(node=null) {
    // Add a note to the focal activity.
    let n = new Note(this.focal_activity);
    if(node) n.initFromXML(node);
    this.focal_activity.notes.push(n);
    return n;
  }

  addActivity(name, actor_name, node=null) {
    const actor = this.addActor(actor_name);
    name = UI.cleanName(name);
    if(!UI.validName(name)) {
      UI.warningInvalidName(name);
      return null;
    }
    const n = name + (actor.name != UI.NO_ACTOR ? ` (${actor.name})` : '');
    let nb = this.namedObjectByID(UI.nameToID(n));
    if(nb) {
      // If activity by this name already exists, return it.
      if(nb instanceof Activity) {
        return nb;
      }
      // Otherwise, warn the modeler.
      UI.warningEntityExists(nb);
      return null;
    }
    const a = new Activity(this.focal_activity, name, actor);
    if(node) a.initFromXML(node);
    a.setCode();
    this.activities[a.identifier] = a;
    if(this.focal_activity) this.focal_activity.sub_activities.push(a);
    a.resize();
    return a;
  }

  addAspect(name, link=null, node=null) {
    name = UI.cleanName(name);
    if(!UI.validName(name)) {
      UI.warningInvalidName(name);
      return null;
    }
    let nb = this.namedObjectByID(UI.nameToID(name));
    if(nb) {
      // If activity by this name already exists, add it to the link
      // (if specified) and return it.
      if(nb instanceof Aspect) {
        if(link) addDistinct(nb, link.aspects);
        return nb;
      }
      // Otherwise, warn the modeler.
      UI.warningEntityExists(nb);
      return null;
    }
    const a = new Aspect(name, link ? link.from_activity : null);
    if(node) a.initFromXML(node);
    a.setCode();
    // Add aspect to link if specified.
    if(link) addDistinct(a, link.aspects);
    this.aspects[a.identifier] = a;
    a.resize();
    return a;
  }

  addLink(from_a, to_a, to_c, node=null) {
    // NOTE: A link ID has THREE underscores between its node IDs.
    const id = from_a.code + '___' + circledLetter(to_c) + to_a.code;
    let l = this.linkByID(id);
    if(l !== null) {
      if(node) l.initFromXML(node);
      return l;
    }
    l = new Link(from_a, to_a, to_c);
    if(node) l.initFromXML(node);
    this.links[l.identifier] = l;
    from_a.connections.O.push(l);
    to_a.connections[to_c].push(l);
    this.makePredecessorLists();
    l.is_feedback = (from_a.predecessors.indexOf(to_a) >= 0);
    return l;
  }
  
  //
  // Methods related to the model diagram layout
  //

  alignToGrid() {
    // Move all positioned model elements to the nearest grid point.
    if(!this.align_to_grid) return;
    let move = false;
    const fc = this.focal_activity;
    // NOTE: Do not align notes to the grid. This will permit more
    // precise positioning, while aligning will not improve the layout
    // of the diagram because notes are not connected to arrows.
    // However, when notes relate to nearby nodes, preserve their relative
    // position to this node.
    for(let i = 0; i < fc.notes.length; i++) {
      const
          note = fc.notes[i],
          nbn = note.nearbyNode;
      note.nearby_pos = (nbn ? {node: nbn, oldx: nbn.x, oldy: nbn.y} : null);
    }
    for(let i = 0; i < fc.sub_activities.length; i++) {
      move = fc.sub_activities[i].alignToGrid() || move;
    }
    if(move) UI.drawDiagram(this);
  }
  
  translateGraph(dx, dy) {
    // Move all entities in the focal activity by (dx, dy) pixels.
    if(!dx && !dy) return;
    const fc = this.focal_activity;
    for(let i = 0; i < fc.sub_activities.length; i++) {
      fc.sub_activities[i].x += dx;
      fc.sub_activities[i].y += dy;
    }
    for(let i = 0; i < fc.notes.length; i++) {
      fc.notes[i].x += dx;
      fc.notes[i].y += dy;
    }
    // NOTE: force drawing, because SVG must immediately be downloadable.
    UI.drawDiagram(this);
    // If dragging, add (dx, dy) to the properties of the top "move" UndoEdit.
    if(UI.dragged_node) UNDO_STACK.addOffset(dx, dy);
  }

  //
  // Methods related to selection 
  //
  
  selectAspect(a, l) {
    // Aspects are not added to the selection, as they can not be moved.
    // Therefore, clear the selection.
    this.clearSelection();
    this.selected_aspect = a;
    this.selected_aspect_link = l;
    // NOTE: Redraw of link is needed to highlight because aspects do not
    // have their own shape.
    UI.drawObject(l);
  }
  
  deselectAspect() {
    const sa = this.selected_aspect;
    if(!sa) return;
    this.selected_aspect = null;
    // NOTE: Redraw of link is needed to de-highlight because aspects do
    // not have their own shape.
    UI.drawObject(this.selected_aspect_link);
    this.selected_aspect_link = null;
  }

  select(obj) {
    this.deselectAspect();
    obj.selected = true;
    if(this.selection.indexOf(obj) < 0) {
      this.selection.push(obj);
      UI.drawObject(obj);
    }
  }

  deselect(obj) {
    this.deselectAspect();
    obj.selected = false;
    let i = this.selection.indexOf(obj);
    if(i >= 0) {
      this.selection.splice(i, 1);
    }
    UI.drawObject(obj);
  }

  selectList(ol) {
    // Set selection to elements in `ol`
    // NOTE: first clear present selection without redrawing
    this.clearSelection(false);
    for(let i = 0; i < ol.length; i++) {
      ol[i].selected = true;
      if(this.selection.indexOf(ol[i]) < 0) this.selection.push(ol[i]);
    }
    // NOTE: does not redraw the graph -- the calling routine should do that
  }
  
  get getSelectionPositions() {
    // Return a list of tuples [X, y] for all selected nodes
    const pl = [];
    for(let i = 0; i < this.selection.length; i++) {
      let obj = this.selection[i];
      if(obj instanceof Activity) pl.push([obj.x, obj.y]);
    }
    return pl;
  }

  setSelectionPositions(pl) {
    // Set position of selected nodes to the [X, y] passed in the list
    // NOTE: iterate backwards over the selection ...
    for(let i = this.selection.length - 1; i >= 0; i--) {
      let obj = this.selection[i];
      if(obj instanceof Activity) {
        // ... and apply [X, Y] only to nodes in the selection
        const xy = pl.pop();
        obj.x = xy[0];
        obj.y = xy[1];
      }
    }
  }

  clearSelection(draw=true) {
    this.deselectAspect();
    if(this.selection.length > 0) {
      for(let i = 0; i < this.selection.length; i++) {
        const obj = this.selection[i];
        obj.selected = false;
        if(draw) UI.drawObject(obj);
      }
    }
    this.selection.length = 0;
  }

  setSelection() {
    // Set selection to contain all selected entities in the focal cluster
    // NOTE: to be called after loading a model, and after UNDO/REDO (and
    // then before drawing the diagram)
    const fa = this.focal_activity;
    this.deselectAspect();
    this.selection.length = 0;
    for(let i = 0; i < fa.sub_activities.length; i++) {
      if(fa.sub_activities[i].selected) {
        this.selection.push(fa.sub_activities[i]);
      }
    }
    for(let i = 0; i < fa.notes.length; i++) if(fa.notes[i].selected) {
      this.selection.push(fa.notes[i]);
    }
    const rl = fa.relatedLinks;
    for(let i = 0; i < rl; i++) if(rl[i].selected) {
      this.selection.push(rl[i]);
    }
  }
  
  get activityInSelection() {
    // Return TRUE if current selection contains at least one activity.
    for(let i = 0; i < this.selection.length; i++) {
      if(this.selection[i] instanceof Activity) return true;
    }
    return false;
  }

  moveSelection(dx, dy){
    // Move all selected nodes unless cursor was not moved.
    // NOTE: No undo, as moves are incremental; the original positions
    // have been stored on MOUSE DOWN.
    if(dx === 0 && dy === 0) return;
    let obj,
        minx = 0,
        miny = 0;
    for(let i = 0; i < this.selection.length; i++) {
      obj = this.selection[i];
      if(!(obj instanceof Link)) {
        obj.x += dx;
        obj.y += dy;
        minx = Math.min(minx, obj.x - obj.width / 2);
        miny = Math.min(miny, obj.y - obj.height / 2);
      }
    }
    // Translate entire graph if some elements are above and/or left of
    // the paper edge.
    if(minx < 0 || miny < 0) {
      // NOTE: limit translation to 5 pixels to prevent "run-away effect"
      this.translateGraph(Math.min(5, -minx), Math.min(5, -miny));
    } else {
      UI.drawSelection(this);
    }
    this.alignToGrid();
  }
  
  get topLeftCornerOfSelection() {
    // Return the pair [X coordinate of the edge of the left-most selected node,
    // Y coordinate of the edge of the top-most selected node]
    if(this.selection.length === 0) return [0, 0];
    let minx = VM.PLUS_INFINITY,
        miny = VM.PLUS_INFINITY;
    for(let i = 0; i < this.selection.length; i++) {
      let obj = this.selection[i];
      if(!(obj instanceof Link)) {
        minx = Math.min(minx, obj.x - obj.width / 2);
        miny = Math.min(miny, obj.y - obj.height / 2);
      }
    }
    return [minx, miny];
  }
  
  eligibleFromToActivities() {
    // Return a list of activities that are visible in the focal cluster.
    return this.focal_activity.sub_activities.slice();
  }

  get selectionAsXML() {
    // Returns XML for the selected entities, and also for the entities
    // referenced by expressions for their attributes.
    // NOTE: the name and actor name of the focal cluster are added as
    // attributes of the main node to permit "smart" renaming of
    // entities when PASTE would result in name conflicts.
    if(this.selection.length <= 0) return '';
    const
        fa_name = this.focal_activity.name,
        fa_actor = this.focal_activity.actor.name,
        entities = {
          Function: [],
          Link: [],
          Note: [],
        },
        extras = [],
        from_tos = [],
        xml = [],
        extra_xml = [],
        ft_xml = [],
        sela_xml = [],
        selected_xml = [];
    for(let i = 0; i < this.selection.length; i++) {
      const obj = this.selection[i];
      entities[obj.type].push(obj);
      if(obj instanceof Activity) sela_xml.push(
          '<sela name="', xmlEncoded(obj.name),
          '" actor-name="', xmlEncoded(obj.actor.name), '"></sela>');
      selected_xml.push(`<sel>${xmlEncoded(obj.displayName)}</sel>`);
    }
    // Expand (sub)activities by adding all their model entities to their
    // respective lists
    for(let i = 0; i < entities.Function.length; i++) {
      const a = entities.Function[i];
      // All sub-activities must be copied.
      mergeDistinct(a.allActivities, entities.Function);
      // Likewise for all related links.
      mergeDistinct(a.relatedLinks, entities.Link);
    }
    // Only add the XML for notes in the selection
    for(let i = 0; i < entities.Note.length; i++) {
      xml.push(entities.Note[i].asXML);
    }
    for(let i = 0; i < entities.Function.length; i++) {
      const a = entities.Function[i];
      xml.push(a.asXML);
    }
    // Add all links that have (implicitly via clusters) been selected
    for(let i = 0; i < entities.Link.length; i++) {
      const l = entities.Link[i];
      // NOTE: The FROM and/or TO node need not be selected; if not, put
      // them in a separate list
      if(entities.Function.indexOf(l.from_activity) < 0) {
        addDistinct(l.from_activity, from_tos);
      }
      if(entities.Function.indexOf(l.to_activity) < 0) {
        addDistinct(l.to_activity, from_tos);
      }
      xml.push(l.asXML);
    }
    for(let i = 0; i < from_tos.length; i++) {
      const a = from_tos[i];
      ft_xml.push('<from-to name="', xmlEncoded(a.name),
          '" actor-name="', xmlEncoded(a.actor.name), '"></from-to>');
    }
    for(let i = 0; i < extras.length; i++) {
      extra_xml.push(extras[i].asXML);
    }
    return ['<copy timestamp="', Date.now(),
        '" model-timestamp="', this.time_created.getTime(),
        '" parent-name="', xmlEncoded(fa_name),
        '" parent-actor="', xmlEncoded(fa_actor),
        '"><entities>', xml.join(''),
        '</entities><from-tos>', ft_xml.join(''),
        '</from-tos><extras>', extra_xml.join(''),
        '</extras><selection>', selected_xml.join(''),
        '</selection></copy>'].join('');
  }
  
  dropSelectionIntoActivity(a) {
    // Move all selected nodes to activity `a`
    let n = 0,
        rmx = a.rightMarginX,
        tlc = this.topLeftCornerOfSelection;
    for(let i = 0; i < this.selection.length; i++) {
      const obj = this.selection[i];
      if(!(obj instanceof Link)) {
        obj.setParent(a);
        obj.x += rmx + 50 - tlc[0];
        obj.y += 50 - tlc[1];
        n++;
      }
      // NOTE: ignore selected links and constraints, as these will be
      // "taken along" automatically
    }
    UI.notify(pluralS(n, 'activity') + ' moved to activity ' + a.displayName);
    // Clear the selection WITHOUT redrawing the selected entities
    // (as these will no longer be part of the graph)
    this.clearSelection(false);
    UI.drawDiagram(this);
  }
  
  cloneSelection(prefix, actor_name, renumber) {
    // Add a "clone" to the model for each entity in the selection. 
    if(this.selection.length) {
      // Add the prefix symbol ': ' only if the prefix is not blank.
      if(prefix) prefix += UI.PREFIXER;
      // Categorize selected entities and pre-validate their clone name.
      const
          notes = [],
          activities = [],
          links = [];
      for(let i = 0; i < this.selection.length; i++) {
        const obj = this.selection[i];
        if(obj instanceof Note) {
          notes.push(obj);
        } else if(obj instanceof Link) {
          links.push(obj);
        } else {
          let e = null;
          // Check whether renumbering applies.
          if(actor_name || !renumber || !obj.numberContext) {
            // NO? Then check whether prefixed name is already in use.
            let name = prefix + obj.name,
                aname = '';
            if(obj instanceof Actvity) {
              aname = (actor_name ? actor_name : obj.actor.name);
              if(aname && aname !== UI.NO_ACTOR) name += ` (${aname})`;
            }
            e = this.objectByName(name);
          }
          if(obj instanceof Activity) {
            activities.push(obj);
          }
        }
      }
      // Construct list of the cloned objects.
      const
        cloned_selection = [],
        node_dict = {};
      // First clone notes.
      for(let i = 0; i < notes.length; i++) {
        const c = this.addNote();
        if(c) {
          c.copyPropertiesFrom(notes[i], renumber);
          c.x += 100;
          c.y += 100;
          cloned_selection.push(c);
        } else {
          // Warn and exit.
          UI.warn('Failed to clone note #' + i);
          return;
        }
      }
      // Then clone activities.
      for(let i = 0; i < activities.length; i++) {
        const
            a = activities[i],
            nn = (renumber && !actor_name ? a.nextAvailableNumberName : '');
        let c;
        if(nn) {
          c = this.addActivity(nn, a.actor.name);
        } else {
          const aa = (actor_name ? actor_name : a.actor.name);
          c = this.addActivity(prefix + a.name, aa);
        }
        if(c) {
          node_dict[p.displayName] = c.displayName;
          c.copyPropertiesFrom(p);
          c.x += 100;
          c.y += 100;
          cloned_selection.push(c);
        } else {
          // Warn and exit.
          UI.warn('Failed to clone function ' + p.displayName);
          return;
        }
      }
      // Clone links.
      for(let i = 0; i < links.length; i++) {
        const l = links[i];
        // NOTE: links and constraints both have FROM and TO nodes
        let cf = l.from_activity,
            ct = l.to_activity;
        const
            nf = (node_dict[cf.displayName] ?
                node_dict[cf.displayName] : cf.displayName),
            nt = (node_dict[ct.displayName] ?
                node_dict[ct.displayName] : ct.displayName);
        // If in selection, map FROM node onto cloned node
        if(activities.indexOf(cf) >= 0) {
          let name = (nf ? nf + (cf.hasActor ? cf.actor.name : '') :
              prefix + cf.name);
          const aname = (actor_name ? actor_name : cf.actor.name);
          if(aname && aname !== UI.NO_ACTOR) name += ` (${aname})`;
          cf = this.objectByName(nf ? nf : name);
        }
        // Do likewise for the TO node
        if(activities.indexOf(ct) >= 0) {
          let name = (nt ? nt + (ct.hasActor ? ct.actor.name : '') :
              prefix + ct.name);
          const aname = (actor_name ? actor_name : ct.actor.name);
          if(aname && aname !== UI.NO_ACTOR) name += ` (${aname})`;
          ct = this.objectByName(nt ? nt : name);
        }
        // Add the new link ...
        c = this.addLink(cf, ct, l.to_connector);
        if(!c) return;
        // ... but do not add it to the clone list if it already exists 
        if(c !== l) {
          c.copyPropertiesFrom(l);
          cloned_selection.push(c);
        }
      }
      if(cloned_selection.length > 0) {
        // Make the clone the new selection (so it can be moved easily)
        this.selectList(cloned_selection);
        UI.drawDiagram(this);
      } else {
        UI.notify('No elements to clone');
      }
    }
    // Empty string indicates: no problems
    return '';
  }
  
  deleteSelection() {
    // Remove all selected nodes (with their associated links and constraints)
    // and selected links.
    // NOTE: This method implements the DELETE action, and hence should be
    // undoable. The UndoEdit is created by the calling routine; the methods
    // that actually delete model elements append their XML to the XML attribute
    // of this UndoEdit
    // NOTE: When aspect is selected, this requires different action.
    if(this.selected_aspect) {
      this.selected_aspect.removeFromLink(this.selected_aspect_link);
      this.selected_aspect = null;
      this.selected_aspect_link = null;
      return;
    }
    let obj,
        fc = this.focal_activity;
    // Update the documentation manager (GUI only) if selection contains the
    // current entity.
    if(DOCUMENTATION_MANAGER) DOCUMENTATION_MANAGER.clearEntity(this.selection);
    // First delete links and constraints.
    for(let i = this.selection.length - 1; i >= 0; i--) {
      if(this.selection[i] instanceof Link) {
        obj = this.selection.splice(i, 1)[0];
        this.deleteLink(obj);
      }
    }
    // Then delete selected nodes.
    for(let i = this.selection.length - 1; i >= 0; i--) {
      obj = this.selection.splice(i, 1)[0];
      // NOTE: when deleting a selection, this selection has been made in the
      // focal cluster
      if(obj instanceof Note) {
        fc.deleteNote(obj);
      } else {
        this.deleteNode(obj);
      }
    }
    UI.drawDiagram(this);
  }

  //
  // Methods that delete entities from the model
  //
  
  deleteActivity(a) {
    // Delete activity `a` and its associated links from the model.
    // First generate the XML for restoring the activity, but add it
    // later to the UndoEdit so that it comes BEFORE the XML of its
    // subelements.
    let xml = a.asXML;
    // Remove associated links.
    for(let l in this.links) if(this.links.hasOwnProperty(l)) {
      l = this.links[l];
      if(l.from_activity === a || l.to_activity === a) this.deleteLink(l);
    }
    for(let i = a.notes.length - 1; i >= 0; i--) {
      a.deleteNote(a.notes[i]);
    }
    for(let i = a.sub_activities.length - 1; i >= 0; i--) {
      // NOTE: Recursive call, but lower level activities will not output
      // undo-XML
      this.deleteActivity(a.sub_activities[i]); 
    }
    UI.removeShape(a.shape);
    // Remove activity from the activity containing it.
    const i = a.parent.sub_activities.indexOf(a);
    if(i >= 0) a.parent.sub_activities.splice(i, 1);
    delete this.activities[a.identifier];
    // Now insert XML for node, so that the links will be restored
    // properly.
    UNDO_STACK.addXML(xml);
  }

  deleteLink(link) {
    // Remove link from model
    // First remove link from outputs list of its FROM node.
    let i = link.from_activity.connections.O.indexOf(link);
    if(i >= 0) link.from_activity.connections.O.splice(i, 1);
    // Also remove link from inputs list of its TO node.
    for(let c in link.to_activity.connections) if('CRPIT'.indexOf(c) >= 0) {
      i = link.to_activity.connections[c].indexOf(link);
      if(i >= 0) link.to_activity.connections[c].splice(i, 1);
    }
    // Finally, remove link from the model
    UNDO_STACK.addXML(link.asXML);
    delete this.links[link.identifier];
    this.cleanUpFeedbackLinks();
  }

  cleanUpActors() {
    // Remove actors that do not occur as "owner" of any activity or
    // aspect, and update the model property `actor_list` accordingly.
    // NOTE: This actor list contains 2-tuples [id, name].
    const l = [];
    // Compile a list of all actors that are "owner" of an activity
    // and/or aspect. 
    for(let k in this.activities) if(this.activities.hasOwnProperty(k)) {
      const a = this.activities[k].actor;
      if(l.indexOf(a) < 0) l.push(a.identifier);
    }
    // Then remove actors that are NOT on this "actors in use" list
    for(let k in this.actors) if(this.actors.hasOwnProperty(k)) {
      if(l.indexOf(k) < 0) {
        const a = this.actors[k];
        // NOTE: XML for these actors must be appended to the undo because
        // actors have modeler-defined properties.
        UNDO_STACK.addXML(a.asXML);
        delete this.actors[k];
      }
    }
    // Update the sorted actor list that is used in dialogs.
    this.actor_list.length = 0;
    for(let i in this.actors) if(this.actors.hasOwnProperty(i)) {
      const a = this.actors[i];
      this.actor_list.push([a.identifier, a.displayName]);
    }
    // NOTE: sorting will automatically put "(no actor)" at the top since
    // "(" (ASCII 40) comes before "0" (ASCII 48)
    this.actor_list.sort(function(a, b) {return a[0].localeCompare(b[0]);});
  }

  makePredecessorLists() {
    // Compose for each node its lost of predecessor nodes
    // NOTE: first reset all lists, and unset the `visited` flags of links
    for(let a in this.activities) if (this.activities.hasOwnProperty(a)) {
      this.activities[a].predecessors.length = 0;
    }
    for(let l in this.links) if(this.links.hasOwnProperty(l)) {
      this.links[l].visited = false;
    }
    // Only then compute the predecessor lists
    for(let a in this.activities) if (this.activities.hasOwnProperty(a)) {
      this.activities[a].setPredecessors();
    }
  }

  cleanUpFeedbackLinks() {
    // Reset feedback property to FALSE for links that no longer close a loop
    this.makePredecessorLists();
    for(let l in this.links) if(this.links.hasOwnProperty(l)) {
      l = this.links[l];
      if(l.is_feedback) {
        l.is_feedback = (l.from_activity.predecessors.indexOf(l.to_activity) >= 0);
      }
    }
  }

  get allExpressions() {
    // Returns list of all Expression objects in this model
    const xl = [];
    for(let k in this.aspects) if(this.aspects.hasOwnProperty(k)) {
      xl.push(this.aspects[k].expression);
    }
    return xl;
  }

  //
  // Methods for loading and saving the model
  //
  
  parseXML(data) {
    // Parse data string into XML tree
//    try {
      // NOTE: Convert %23 back to # (escaped by function saveModel)
      const xml = parseXML(data.replace(/%23/g, '#'));
      // NOTE: loading, not including => make sure that IO context is NULL
      this.initFromXML(xml);
      return true;
/*
    } catch(err) {
      // Cursor is set to WAITING when loading starts
      UI.normalCursor();
      UI.alert('Error while parsing model: ' + err);
      return false;
    }
*/
  }

  initFromXML(node) {
    // Initialize a model from the XML tree with `node` as root.
    this.reset();
    this.next_activity_number = safeStrToInt(
        nodeParameterValue(node, 'next-activity-number'));
    this.next_aspect_number = safeStrToInt(
        nodeParameterValue(node, 'next-aspect-number'));
    this.last_zoom_factor = safeStrToFloat(
        nodeParameterValue(node, 'zoom'), 1);
    this.align_to_grid = nodeParameterValue(node, 'align-to-grid') === '1';
    this.show_block_arrows = nodeParameterValue(node, 'block-arrows') === '1';
    this.name = xmlDecoded(nodeContentByTag(node, 'name'));
    this.author = xmlDecoded(nodeContentByTag(node, 'author'));
    this.comments = xmlDecoded(nodeContentByTag(node, 'comments'));
    this.last_modified = new Date(
        xmlDecoded(nodeContentByTag(node, 'last-saved')));
    this.version = xmlDecoded(nodeContentByTag(node, 'version'));
    this.grid_pixels = Math.max(10,
        safeStrToInt(nodeContentByTag(node, 'grid-pixels')));
    // First create all actors (= agents).
    let n = childNodeByTag(node, 'actors');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'actor') {
          const name = xmlDecoded(nodeContentByTag(c, 'name'));
          this.addActor(name, c);
        }
      }
    }
    // Then create all aspects (= system properties).
    n = childNodeByTag(node, 'aspects');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'aspect') {
          const name = xmlDecoded(nodeContentByTag(c, 'name'));
          // NOTE: Aspects initially belong to no link. The link property
          // will be set when initializing the links of this model.
          this.addAspect(name, null, c);
        }
      }
    }
    // Only then create all activities, as these may have an actor and
    // also aspects.
    // NOTE: This may result in "orphan activities" because sub-activies
    // may be referenced that have not been created yet.
    n = childNodeByTag(node, 'activities');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'activity') {
          const
              name = xmlDecoded(nodeContentByTag(c, 'name')),
              actor = xmlDecoded(nodeContentByTag(c, 'owner')),
              a = this.addActivity(name, actor, c);
          // NOTE: Top activity will already exist, and then no `initFromHTML`
          // will be executed => initialize it explicitly.
          if(a === this.top_activity) a.initFromXML(c);
        }
      }
    }
    // Special action is needed to re-establish the activity hierarchy.
    this.rescueOrphans();
    // Now links can be added.
    n = childNodeByTag(node, 'links');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'link') {
          const
              fc = nodeContentByTag(c, 'from-code'),
              fn = this.activityByCode(fc),
              tc = nodeContentByTag(c, 'to-code'),
              tn = this.activityByCode(tc);
          if(fn && tn) {
            this.addLink(fn, tn, nodeParameterValue(c, 'connector'), c);
          } else {
            console.log('ERROR: Failed to add link from', fc, 'to', tc);
          }
        }
      }
    }
    this.focal_activity = this.top_activity;
    // Recompile expressions so that they refer to the correct aspects.
    this.compileExpressions();
  }

  get asXML() {
    let p = [' next-activity-number="', this.next_activity_number,
        '" next-aspect-number="', this.next_aspect_number,
        '" zoom="', this.last_zoom_factor, '"'].join('');
    if(this.align_to_grid) p += ' align-to-grid="1"';
    if(this.show_block_arrows) p += ' block-arrows="1"';
    let xml = this.xml_header + ['<model', p, '><name>',  xmlEncoded(this.name),
        '</name><author>', xmlEncoded(this.author),
        '</author><comments>', xmlEncoded(this.comments),
        '</comments><version>',  xmlEncoded(DIAFRAM_VERSION),
        '</version><last-saved>',  xmlEncoded(this.last_modified.toString()),
        '</last-saved><grid-pixels>', this.grid_pixels,
        '</grid-pixels><actors>'].join('');
    for(let a in this.actors) {
      // NOTE: do not to save "(no actor)"
      if(this.actors.hasOwnProperty(a) && a != UI.nameToID(UI.NO_ACTOR)) {
        xml += this.actors[a].asXML;
      }
    }
    xml += '</actors><aspects>';
    for(let a in this.aspects) {
      if(this.aspects.hasOwnProperty(a)) xml += this.aspects[a].asXML;
    }
    xml += '</aspects><activities>';
    for(let a in this.activities) {
      if(this.activities.hasOwnProperty(a)) xml += this.activities[a].asXML;
    }
    xml +='</activities><links>';
    for(let l in this.links) {
      if(this.links.hasOwnProperty(l)) xml += this.links[l].asXML;
    }
    return xml + '</links></model>';
  }
  
  rescueOrphans() {
    // Set the correct parent activities.
    for(let i = 0; i < this.orphan_list.length; i++) {
      const
          o = this.orphan_list[i],
          a = this.activityByCode(o.subact);
      if(a instanceof Activity) a.setParent(o.parent);
    }
  }
  
  get listOfAllComments() {
    const sl = [];
    sl.push('_____MODEL: ' + this.name);
    sl.push('<strong>Author:</strong> ' + this.author);
    sl.push(this.comments);
    sl.push('_____Agents');
    for(let a in this.actors) {
      if(this.actors.hasOwnProperty(a)) {
        sl.push(this.actors[a].displayName, this.actors[a].comments);
      }
    }
    sl.push('_____Functions');
    for(let a in this.activities) {
      if(this.activities.hasOwnProperty(a)) {
        sl.push(this.activities[a].displayName, this.activities[a].comments);
      }
    }
    sl.push('_____Aspects');
    for(let a in this.aspects) {
      if(this.aspects.hasOwnProperty(a)) {
        sl.push(this.aspects[a].displayName, this.aspects[a].comments);
      }
    }
    sl.push('_____Links');
    for(let l in this.links) {
      if(this.links.hasOwnProperty(l)) {
        sl.push(this.links[l].displayName, this.links[l].comments);
      }
    }
    return sl;
  }
  
  /* METHODS RELATED TO EXPRESSIONS */
  
  cleanVector(v, initial, other=VM.NOT_COMPUTED) {
    // Set an array to [0, ..., run length] of numbers initialized as
    // "not computed" to ensure that they will be evaluated "lazily"
    // NOTES:
    // (1) the first element (0) corresponds to t = 0, i.e., the model
    //     time step just prior to the time step defined by start_period.
    // (2) All vectors must be initialized with an appropriate value for
    //     element 0.
    // (3) `other` specifies value for t = 1 and beyond if vector is
    //     static and has to to be initialized to a constant (typically 0).
    v.length = this.run_length + 1;
    v.fill(other);
    v[0] = initial;
  }
  
  resetExpressions() {
    // Create a new vector for all expression attributes of all model
    // entities, using the appropriate default value.
    const ax = this.allExpressions;
    for(let i = 0; i < ax.length; i++) {
      ax[i].reset(0);
    }
  }

  compileExpressions() {
    // Compile all expression attributes of all model entities
    const ax = this.allExpressions;
    for(let i = 0; i < ax.length; i++) {
      ax[i].compile();
    }
  }
  
} // END of class diaFRAMModel


// CLASS Actor
class Actor {
  constructor(name) {
    this.name = name;
    this.comments = '';
  }

  get type() {
    return 'Agent';
  }

  get typeLetter() {
    return 'A';
  }

  get identifier() {
    return UI.nameToID(this.name);
  }
  
  get displayName() {
    return this.name;
  }
  
  get asXML() {
    return ['<actor round-flags="', this.round_flags,
        '"><name>', xmlEncoded(this.name),
        '</name><comments>', xmlEncoded(this.comments),
        '</comments></actor>'].join('');
  }
  
  initFromXML(node) {
    this.comments = nodeContentByTag(node, 'documentation');
  }
  
  rename(name) {
    // Change the name of this actor
    // NOTE: Colons are prohibited in actor names to avoid confusion
    // with prefixed entities.
    name = UI.cleanName(name);
    if(name.indexOf(':') >= 0 || !UI.validName(name)) {
      UI.warn(UI.WARNING.INVALID_ACTOR_NAME);
      return null;
    }
    // Create a new actor entry
    const
        a = MODEL.addActor(name),
        old_id = this.identifier;
    // Rename the current instance.
    // NOTE: this object should persist, as many other objects refer to it
    this.name = a.name;
    // Put it in the "actor dictionary" of the model at the place of the newly
    // created instance (which should automatically be garbage-collected)
    MODEL.actors[a.identifier] = this;
    // Remove the old entry
    delete MODEL.actors[old_id];
  }
  
} // END of class Actor


// CLASS ObjectWithXYWH (any drawable object)
class ObjectWithXYWH {
  constructor(parent) {
    this.parent = parent;
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.shape = UI.createShape(this);
  }

  alignToGrid() {
    // Align this object to the grid, and return TRUE if this involved
    // a move.
    const
        ox = this.x,
        oy = this.y,
        gr = MODEL.grid_pixels;
    this.x = Math.round((this.x + 0.49999999*gr) / gr) * gr;
    this.y = Math.round((this.y + 0.49999999*gr) / gr) * gr;
    return Math.abs(this.x - ox) > VM.NEAR_ZERO ||
        Math.abs(this.y - oy) > VM.NEAR_ZERO;
  }
  
  move(dx, dy) {
    // Move this object by updating its x, y AND shape coordinates
    // (to avoid redrawing it)
    this.x += dx;
    this.y += dy;
    UI.moveShapeTo(shape, this.x, this.y);
  }
} // END of CLASS ObjectWithXYWH


// CLASS Note
class Note extends ObjectWithXYWH {
  constructor(parent) {
    super(parent);
    const dt = new Date();
    // NOTE: use timestamp in msec to generate a unique identifier
    this.timestamp = dt.getTime();
    this.contents = '';
    this.lines = [];
  }
  
  get identifier() {
    return `#${this.parent.identifier}#${this.timestamp}#`; 
  }

  get type() {
    return 'Note';
  }
  
  get parentPrefix() {
    // Return the name of the activity containing this note, followed
    // by a colon+space, except when this activity is the top activity.
    if(this.parent === MODEL.top_activity) return '';
    return this.parent.displayName + UI.PREFIXER;
  }
  
  get displayName() {
    const
        n = this.number,
        type = (n ? `Numbered note #${n}` : 'Note');
    return `${this.parentPrefix}${type} at (${this.x}, ${this.y})`;
  }
  
  get number() {
    // Returns the number of this note if specified (e.g. as #123).
    // NOTE: this only applies to notes having note fields.
    const m = this.contents.replace(/\s+/g, ' ')
        .match(/^[^\]]*#(\d+).*\[\[[^\]]+\]\]/);
    if(m) return m[1];
    return '';
  }
  
  get asXML() {
    return ['<note><timestamp>', this.timestamp,
        '</timestamp><contents>', xmlEncoded(this.contents),
        '</contents><x-coord>', this.x,
        '</x-coord><y-coord>', this.y,
        '</y-coord><width>', this.width,
        '</width><height>', this.height,
        '</height></note>'].join(''); 
  }
  
  initFromXML(node) {
    this.timestamp = safeStrToInt(nodeContentByTag(node, 'timestamp'));
    // NOTE: legacy XML does not include the timestamp
    if(!this.timestamp) {
      // for such notes, generate a 13-digit random number
      this.timestamp = Math.floor((1 + Math.random()) * 1E12);
    }
    this.contents = xmlDecoded(nodeContentByTag(node, 'contents'));
    this.x = safeStrToInt(nodeContentByTag(node, 'x-coord'));
    this.y = safeStrToInt(nodeContentByTag(node, 'y-coord'));
    this.width = safeStrToInt(nodeContentByTag(node, 'width'));
    this.height = safeStrToInt(nodeContentByTag(node, 'height'));
  }

  setParent(pa) {
    // Place this note into the specified activity `pa`.
    if(this.parent) {
      // Remove this note from its current parent's note list.
      const i = this.parent.notes.indexOf(this);
      if(i >= 0) this.parent.notes.splice(i, 1);
      // Set its new parent pointer...
      this.parent = pa;
      // ... and add it to the new cluster's note list.
      if(pa.notes.indexOf(this) < 0) pa.notes.push(this);
    }
  }
  
  resize() {
    // Resizes the note; returns TRUE iff size has changed.
    let txt = this.contents;
    const
        w = this.width,
        h = this.height,
        // Minimumm note width of 10 characters.
        n = Math.max(txt.length, 10),
        fh = UI.textSize('hj').height;
    // Approximate the width to obtain a rectangle.
    // NOTE: 3:1 may seem exagerated, but characters are higher than wide,
    // and there will be more (short) lines due to newlines and wrapping.
    let tw = Math.ceil(3*Math.sqrt(n)) * fh / 2;
    this.lines = UI.stringToLineArray(txt, tw).join('\n');
    let bb = UI.textSize(this.lines, 8);
    // Aim to make the shape wider than tall.
    let nw = bb.width,
        nh = bb.height;
    while(bb.width < bb.height * 1.7) {
      tw *= 1.2;
      this.lines = UI.stringToLineArray(txt, tw).join('\n');
      bb = UI.textSize(this.lines, 8);
      // Prevent infinite loop.
      if(nw <= bb.width || nh > bb.height) break;
    }
    this.height = 1.05 * (bb.height + 6);
    this.width = bb.width + 6;
    // Boolean return value indicates whether size has changed.
    return this.width != w || this.height != h;
  }
  
  containsPoint(mpx, mpy) {
    // Returns TRUE iff given coordinates lie within the note rectangle.
    return (Math.abs(mpx - this.x) <= this.width / 2 &&
        Math.abs(mpy - this.y) <= this.height / 2);
  }

  copyPropertiesFrom(n, renumber=false) {
    // Sets properties to be identical to those of note `n`.
    this.x = n.x;
    this.y = n.y;
    let cont = n.contents;
    if(renumber) {
      // Renumbering only applies to notes having note fields; then the
      // note number must be denoted like #123, and occur before the first
      // note field.
      const m = cont.match(/^[^\]]*#(\d+).*\[\[[^\]]+\]\]/);
      if(m) {
        const nn = this.parent.nextAvailableNoteNumber(m[1]);
        cont = cont.replace(/#\d+/, `#${nn}`);
      }
    }
    this.contents = cont;
  }

} // END of class Note


// CLASS NodeBox (superclass for activities)
class NodeBox extends ObjectWithXYWH {
  constructor(parent, name, actor) {
    super(parent);
    this.name = name;
    this.actor = actor;
    this.name_lines = nameToLines(name);
    this.comments = '';
    // Nodeboxes are assigned a unique code as "shorthand notation".
    // NOTE: Decimal numbers for activities, Excel-style letter codes for
    // aspects, i.e., A, ..., Z, AA, AB, etc.
    this.code = null;
    this.frame_width = 0;
    this.frame_height = 0;
    this.selected = false;
  }
  
  get hasActor() {
    return this.actor && (this.actor.name != UI.NO_ACTOR);
  }

  get displayName() {
    if(this.hasActor) return `${this.name} (${this.actor.name})`;
    return this.name;
  }
  
  get infoLineName() {
    return `<em>${this.type}:</em> ${this.displayName}`;
  }

  get identifier() {
    // Preserve names starting with an underscore (typically system variables)
    if(this.name.startsWith('_')) return UI.nameToID(this.name);
    // Otherwise, interpret underscores as hard spaces
    return UI.nameToID(this.displayName);
  }
  
  get numberContext() {
    // Return the string to be used to evaluate #, so for activities
    // and aspects this is their "tail number".
    return UI.tailNumber(this.name);
  }
  
  rename(name, actor_name='') {
    // Change the name and/or actor name of this node (activity or aspect).
    // NOTE: Return TRUE if rename was successful, FALSE on error, and
    // an activity or aspect if such entity having the new name already
    // exists.
    name = UI.cleanName(name);
    if(!UI.validName(name)) {
      UI.warningInvalidName(name);
      return false;
    }
    // Check whether a non-node entity has this name.
    const nne = MODEL.namedObjectByID(UI.nameToID(name));
    if(nne && nne !== this) {
      UI.warningEntityExists(nne);
      return false;
    }
    // Compose the full name.
    if(actor_name === '') actor_name = UI.NO_ACTOR;
    let fn = name;
    if(actor_name != UI.NO_ACTOR) fn += ` (${actor_name})`;
    // Get the ID (derived from the full name) and check if MODEL already
    // contains another entity with this ID.
    const
        old_id = this.identifier,
        new_id = UI.nameToID(fn),
        n = MODEL.nodeBoxByID(new_id);
    // If so, do NOT rename, but return this object instead.
    // NOTE: If entity with this name is THIS entity, it typically means
    // a cosmetic name change (upper/lower case) which SHOULD be performed.
    if(n && n !== this) return n;
    // Otherwise, if IDs differ, add this object under its new key, and
    // remove its old entry.
    if(old_id != new_id) {
      if(this instanceof Activity) {
        MODEL.activities[new_id] = this;
        delete MODEL.activities[old_id];
      } else if(this instanceof Aspect) {
        MODEL.aspects[new_id] = this;
        delete MODEL.aspects[old_id];
      } else {
        // NOTE: This should never happen => report an error.
        UI.alert('Can only rename activities and aspects');
        return false;
      }
    }
    // Change this object's name and actor.
    this.actor = MODEL.addActor(actor_name);
    this.name = name;
    // Update actor list in case some actor name is no longer used.
    MODEL.cleanUpActors();
    // NOTE: Renaming may affect the node's display size.
    if(this.resize()) UI.drawSelection(MODEL);
    // NOTE: Only TRUE indicates a successful (cosmetic) name change.
    return true;
  }
  
  resize() {
    // Resizes this node; returns TRUE iff size has changed.
    // Therefore, keep track of original width and height.
    const
        ow = this.width,
        oh = this.height,
        an = (this.hasActor ? this.actor.name : ''),
        ratio = (this instanceof Activity ? 0.45 : 0.3);
    this.name_lines = nameToLines(this.name, an, ratio);
    this.bbox = UI.textSize(this.name_lines, 10);
    if(this instanceof Aspect) {
      this.width = this.bbox.width + 6;
      this.height = this.bbox.height + 6;
      this.frame_width = this.width;
    } else {
      this.frame_width = Math.max(50, this.bbox.width, this.bbox.height,
          UI.textSize(an).width) + 7;
      this.width = Math.max(80, this.frame_width + 20);
      this.height = this.width * Math.sqrt(3) / 2;
    }
    return this.width != ow || this.height != oh;
  }

  get nextAvailableNumberName() {
    // Returns node name ending with the first number > its present number,
    // provided that the name ends with a number; otherwise an empty string
    const nc = this.numberContext;
    if(!nc) return '';
    const
        base = this.name.slice(0, -nc.length),
        aname = (this.hasActor ? ` (${this.actor.name})` : '');
    let n = parseInt(nc),
        nn,
        e = this;
    while(e) {
      n++;
      nn = base + n;
      e = MODEL.objectByName(nn + aname);
    }
    return nn;
  }

} // END of class NodeBox


// CLASS Aspect
class Aspect extends NodeBox {
  // The parent of an aspect is the activity (= function) to which it
  // relates via some link.
  constructor(name, activity=null) {
    super(activity, name, null);
    this.expression = new Expression(this, '');
  }

  get type() {
    return 'Aspect';
  }

  get typeLetter() {
    return 'A';
  }

  setCode() {
    // Aspects are assigned a unique number code for shorthand display of links.
    if(!this.code) {
      this.code = (MODEL ? MODEL.newAspectCode : '?');
    }
  }

  get asXML() {
    return ['<aspect code="', this.code, '">',
        '<name>',  xmlEncoded(this.name),
        '</name><comments>', xmlEncoded(this.comments),
        '</comments><expression>', xmlEncoded(this.expression.text),
        '</expression></aspect>'].join('');
  }
  
  initFromXML(node) {
    this.code = nodeParameterValue(node, 'code');
    this.resize();
    this.comments = xmlDecoded(nodeContentByTag(node, 'comments'));
    this.expression.text = xmlDecoded(nodeContentByTag(node, 'expression'));
  }
  
  removeFromLink(l) {
    // Remove this aspect from its parent link, and also from the model
    // if this link is the only one having this aspect.
    // @@TO DO: prepare for undo!
    if(!l) return;
    const n = l.aspects.indexOf(this);
    // Remove aspect from list.
    if(n >= 0) l.aspects.splice(n, 1);
    // NOTE: Aspect can only occur within its parent activity scope.
    const ais = this.parent.aspectsInScope;
    if(ais.indexOf(this) < 0) {
      // No more occurrence => remove aspect from model.
      const msg = `Aspect "${this.displayName}" removed from model`;
      delete MODEL.aspects[this.identifier];
      UI.notify(msg);
    }
    UI.drawObject(l);
    UI.updateButtons();
  }
  
} // END of CLASS Aspect


// CLASS Activity
class Activity extends NodeBox {
  constructor(parent, name, actor) {
    super(parent, name, actor);
    this.sub_activities = [];
    this.connections = {C: [], O: [], R: [], P: [], I: [], T: [], S: []};
    this.notes = [];
    this.predecessors = [];
  }
  
  get type() {
    // NOTE: The standard FRAM terminology does not speak of activities
    // but of functions. Hence in all communication with the modeler,
    // activities appear as "functions".
    return 'Function';
  }

  get typeLetter() {
    // The F of "function" (see comment above).
    return 'F';
  }
  
  get countLinksInOut() {
    // Return object with the number of incoming and outgoing links
    // of this activity as properties.
    const io = {incoming: 0, outgoing: 0};
    for(let c in this.connections) if('CORPIT'.indexOf(c) >= 0) {
      const n = this.connections[c].length;
      if(c === 'O') {
        io.outgoing += n;
      } else {
        io.incoming += n;
      }
    }
    return io;
  }
  
  get isBackground() {
    // Return TRUE when this activity does not have at least one incoming
    // linc and at least one output link.
    const l = this.countLinksInOut;
    return !l.incoming || !l.outgoing;
  }
  
  setPredecessors() {
    // Recursive function to create list of all nodes that precede this one.
    for(let c in this.connections) if('CRPIT'.indexOf(c) >= 0) {
      for(let i = 0; i < this.connections[c].length; i++) {
        const l = this.connections[c][i];
        if(!l.visited) {
          l.visited = true;
          const n = l.from_activity;
          if(this.predecessors.indexOf(n) < 0) {
            this.predecessors.push(n);
          }
          const pp = n.setPredecessors();  // Recursion!
          for(let j = 0; j < pp.length; j++) {
            const n = pp[j];
            if(this.predecessors.indexOf(n) < 0) {
              this.predecessors.push(n);
            }
          }
        }
      }
    }
    return this.predecessors;
  }
  
  get nestingLevel() {
    // Return the "depth" of this activity in the activity hierarchy.
    if(this.parent) return this.parent.nestingLevel + 1; // recursion!
    return 0;
  }
  
  get rightMarginX() {
    // Return the horizontal position 50px right of the edge of the right-most
    // node in the diagram for this activity
    let max = 0;
    for(let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      max = Math.max(max, n.x + n.width / 2);
    }
    for(let i = 0; i < this.sub_activities.length; i++) {
      const sa = this.sub_activities[i];
      max = Math.max(max, sa.x + sa.width / 2);
    }
    return max;
  }
  
  setCode() {
    // Activities are assigned a unique number code for shorthand display of links
    if(!this.code) {
      this.code = (MODEL ? MODEL.newActivityCode : '0');
    }
  }

  get asXML() {
    const xml = ['<activity code="', this.code, '">',
        '<name>',  xmlEncoded(this.name),
        '</name><owner>', xmlEncoded(this.actor.name),
        '</owner><comments>', xmlEncoded(this.comments),
        '</comments><x-coord>', this.x,
        '</x-coord><y-coord>', this.y,
        '</y-coord><sub-activities>'];
    for(let i = 0; i < this.sub_activities.length; i++) {
      xml.push(`<activity-code>${this.sub_activities[i].code}</activity-code>`);
    }
    xml.push('</sub-activities><notes>');
    for(let i = 0; i < this.notes.length; i++) {
      xml.push(this.notes[i].asXML);
    }
    xml.push('</notes></activity>');
    return xml.join('');
  }

  initFromXML(node) {
    this.code = nodeParameterValue(node, 'code');
    this.resize();
    this.comments = xmlDecoded(nodeContentByTag(node, 'comments'));
    this.x = safeStrToInt(nodeContentByTag(node, 'x-coord'));
    this.y = safeStrToInt(nodeContentByTag(node, 'y-coord'));
    let n = childNodeByTag(node, 'sub-activities');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'activity-code') {
          const
              code = nodeContent(c),
              a = MODEL.activityByCode(code);
          if(a) {
            // Sub-activity already exists => set this activity as its
            // parent.
            a.setParent(this);
          } else {
            // Sub-activity not created yet => add code of sub-activity
            // to the orphan list with this activity as its future parent.
            MODEL.orphan_list.push({subact: code, parent: this});
          }
        }
      }
    }
    n = childNodeByTag(node, 'notes');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'note') {
          const note = new Note(this);
          note.initFromXML(c);
          this.notes.push(note);
        }
      }
    }
  }
  
  setParent(pa) {
    // Place this activity into the specified parent activity `pa`.
    // NOTE: An activity must be part of exactly ONE parent activity.
    if(this.parent) {
      // Remove this activity from its current parent's activity list.
      const i = this.parent.sub_activities.indexOf(this);
      if(i >= 0) this.parent.sub_activities.splice(i, 1);
      // Set its new activity pointer...
      this.parent = pa;
      // ... and add it to the new parent's activity list.
      addDistinct(this, pa.sub_activities);
    }
  }
  
  get aspectsInScope() {
    // Return list of all aspects that are related to this activity.
    // NOTE: Output aspects can be used to compute other output aspects
    // of the same function; the VM will report circularity problems.
    let ais = [];
    for(let c in this.connections) if('CORPIT'.indexOf(c) >= 0) {
      const cc = this.connections[c];
      for(let i = 0; i < cc.length; i++) {
        const la = cc[i].aspects;
        for(let j = 0; j < la.length; j++) {
          addDistinct(la[j], ais);
        }
      }
    }
    return ais;
  }

  containsActivity(a) {
    // Return the subactivity of this activity that contains activity `a`,
    // or NULL.
    if(a.parent === this) return this;
    for(let i = 0; i < this.sub_activities.length; i++) {
      if(this.sub_activities[i].containsActivity(a)) {  // recursion!
        return this.sub_activities[i];
      }
    }
    return null;
  }

  get allActivities() {
    // Return the set of all activities in this activity and its subactivities.
    let sa = this.sub_activities.slice();
    for(let i = 0; i < this.sub_activities.length; i++) {
      sa = sa.concat(this.sub_activities[i].allActivities); // recursion!
    }
    return sa;
  }
  
  get isLeaf() {
    // Return TRUE if this activity has no sub-activities.
    return this.sub_activities.length === 0;
  }
  
  get leafActivities() {
    // Return the set of all descendant activities of this activity
    // that themselves have no subactivities.
    let la = [];
    for(let i = 0; i < this.sub_activities.length; i++) {
      const sa = this.sub_activities[i];
      if(sa.isLeaf) {
        la.push(sa);
      } else {
        la = la.concat(sa.leafActivities); // recursion!
      }
    }
    return la;    
  }

  get relatedLinks() {
    const
        aa = this.allActivities,
        rl = [];
    for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
      const l = MODEL.links[k];
      if(aa.indexOf(l.from_activity) >= 0 || aa.indexOf(l.to_activity) >= 0) {
        rl.push(l);
      }
    }
    return rl;
  }
  
  get visibleLinks() {
    const vl = [];
    for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
      const l = MODEL.links[k];
      if(this.sub_activities.indexOf(l.from_activity) >= 0 &&
          this.sub_activities.indexOf(l.to_activity) >= 0) {
        vl.push(l);
      }
    }
    return vl;
  }
  
  deepLinks(a) {
    // Return a lookup-object of all links that connect some sub-activity
    // of the parent of this activity with activity `a` or any of its
    // sub-activities. The lookup-object categorizes links by their
    // connector.
    const dl = {C: [], O: [], R: [], P: [], I: [], T: []};
    if(!a.parent) return dl;
    const
        sa = a.parent.sub_activities,
        aa = a.allActivities;
    aa.push(a);
    for(let k in MODEL.links) if(MODEL.hasOwnProperty(k)) {
      const
          l = MODEL.links(k),
          fa = l.from_activity,
          ta = l.to_activity;
      if(sa.indexOf(ta) >= 0) {
        dl.O.push(l);
      } else if(sa.indexOf(fa) >= 0) {
        dl[l.connector].push(l);
      }
    }
    return dl;
  }

  containsLink(l) {
    // Returns TRUE iff link `l` is related to some activty in this activity.
    return this.relatedLinks.indexOf(l) >= 0;
  }
  
  linkInList(l, list) {
    // Returns TRUE iff both the FROM node and the TO node of link/constraint
    // `l` are elements of `list`
    // NOTE: this method used in diafram-ctrl.js to see which links are
    // to be included when the modeler performs a "rectangular area select".
    const
        f_in = list.indexOf(l.from_activity) >= 0,
        t_in = list.indexOf(l.to_activity) >= 0;
    return f_in && t_in;
  }

  containsPoint(mpx, mpy) {
    // Return TRUE if cursor lies within inner circle of the hexagon.
    const
        dx = mpx - this.x,
        dy = mpy - this.y,
        r = this.width / 2 - 3;
    if(dx * dx + dy * dy < r * r) {
      return true;
    }
    return false;
  }
  
  drawWithLinks() {
    if(this.parent !== MODEL.focal_activity) return;
    UI.drawObject(this);
    // Draw related links.
    for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
      const l = MODEL.links[k];
      if(l.from_activity === this || l.to_activity === this) UI.drawObject(l);
    }
  }
  
  copyPropertiesFrom(a) {
    // Set properties to be identical to those of activity `a`.
    this.x = a.x;
    this.y = a.y;
    this.comments = a.comments;
  }

  deleteNote(n, with_xml=true) {
    // Remove note `n` from this activity's note list.
    let i = this.notes.indexOf(n);
    if(i >= 0) {
      if(with_xml) UNDO_STACK.addXML(n.asXML);
      this.notes.splice(i, 1);
    }
    return i > -1;
  }

  get allNotes() {
    // Return the set of all notes in this activity and its subactivities.
    let notes = this.notes.slice();
    for(let i = 0; i < this.sub_activities.length; i++) {
      notes = notes.concat(this.sub_activities[i].allNotes); // recursion!
    }
    return notes;
  }

  nextAvailableNoteNumber(n) {
    // Returns the first integer greater than `n` that is not already in
    // use by a note of this cluster.
    let nn = parseInt(n) + 1;
    const nrs = [];
    for(let i = 0; i < this.notes.length; i++) {
      const nr = this.notes[i].number;
      if(nr) nrs.push(parseInt(nr));
    }
    while(nrs.indexOf(nn) >= 0) nn++;
    return nn;
  }

} // END of class Activity


// CLASS Link
class Link {
  constructor (from_a, to_a, to_c) {
    this.comments = '';
    this.from_activity = from_a;
    this.to_activity = to_a;
    this.to_connector = to_c;
    this.aspects = [];
    // other properties are used for drawing, editing, etc.
    this.from_x = 0;
    this.from_y = 0;
    this.to_x = 0;
    this.to_y = 0;
    this.is_feedback = false;
    this.visited = false;
    this.selected = false;
    // For drawing, a link has its own shape (mouse responsive)
    this.shape = UI.createShape(this);
  }

  get type() {
    return 'Link';
  }

  get typeLetter() {
    return 'L';
  }

  get displayName() {
    return this.from_activity.displayName + UI.LINK_ARROW +
        circledLetter(this.to_connector) + this.to_activity.displayName;
  }

  get identifier() {
    // NOTE: link IDs are based on the node codes rather than IDs, as this
    // prevents problems when nodes are renamed
    return this.from_activity.code + '___' + circledLetter(this.to_connector) +
        this.to_activity.code;
  }

  get asXML() {
    const
        fa = this.from_activity,
        ta = this.to_activity,
        asp = [];
    for(let i = 0; i < this.aspects.length; i++) {
      asp.push(`<aspect-code>${this.aspects[i].code}</aspect-code>`);
    }
    return ['<link connector="', this.to_connector,
        '"><from-code>', fa.code,
      '</from-code><to-code>', ta.code,
      '</to-code><comments>', xmlEncoded(this.comments),
      '</comments><aspects>', asp.join(''),
      '</aspects></link>'].join('');
  }

  initFromXML(node) {
    this.comments = xmlDecoded(nodeContentByTag(node, 'comments'));
    let n = childNodeByTag(node, 'aspects');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'aspect-code') {
          const
              ac = nodeContent(c),
              a = MODEL.aspectByCode(ac);
          if(a) {
            // The FROM node of the link being initialized is the "parent"
            // of its aspects.
            a.parent = this.from_activity;
            // NOTE: Aspects are recorded as model entities, and only
            // *referenced* by links (so the same aspect can appear
            // on multiple links).
            this.aspects.push(a);
          } else {
            console.log('ERROR: Faild to add aspect', ac, 'to link',
                this.displayName);
          }
        }
      }
    }
  }

  copyPropertiesFrom(l) {
    // Set properties to be identical to those of link `l`
    this.comments = l.comments;
  }
  
  get visibleNodes() {
    // Returns tuple [from, to] where TRUE indicates that this node is
    // visible in the focal activity.
    const
        fa = MODEL.focal_activity,
        fv = (fa.sub_activities.indexOf(this.from_activity) >= 0),
        tv = (fa.sub_activities.indexOf(this.to_activity) >= 0);
    return [fv, tv];
  }
  
  get hasArrow() {
    // Returns TRUE if both nodes are visible
    const vn = this.visibleNodes;
    return vn[0] && vn[1];
  }

  containsPoint(x, y) {
    // Returns TRUE if the point (x, y) lies within the 12x12 thumbnail
    // chart area of this constraint (either in the middle of the curved
    // arrow or at the top of its one visible node)
    return this.midpoint && Math.abs(x - this.midpoint[0]) <= 6 &&
        Math.abs(y - this.midpoint[1]) <= 6;
  }
  
} // END of class Link

