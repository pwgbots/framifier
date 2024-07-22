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
    this.run_length = 10;
    this.last_zoom_factor = 1;
    
    // Diagram editor related properties.
    this.selected_aspect = null;
    this.selected_aspect_link = null;
    this.selection = [];
    // Set the indicator that the model has not been executed yet.
    this.set_up = false;
    this.solved = false;
    // t is the time step ("tick") shown.
    this.t = 0;
    // Clock time is a vector with for each "tick" the clock time in hours.
    this.clock_time = [];
    this.cleanVector(this.clock_time, 0);
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

  get simulationTime() {
    // Return the simulated clock time for the current "tick" (= cycle).
    return this.clock_time[this.t];
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
          fa = this.objectByName(nn[0]),
          // NOTE: Link names have connector symbol after arrow...
          tac = [...nn[1]],
          // ... so this has to be removed...
          c = tac.shift(),
          // ... before we can look up the activity name.
          ta = this.objectByName(tac.join(''));
      if(i === 0) {
        if(fa && ta) return this.linkByID(UI.linkIdentifier(fa, ta, c));
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
    let obj = this.namedObjectByID(UI.nameToID(name));
    if(obj) {
      // If aspect by this name already exists, add it to the link
      // (if specified) and return it.
      if(obj instanceof Aspect) {
        if(link) {
          addDistinct(obj, link.aspects);
          // NOTE: Aspect may have been restored after deletion, and then
          // have no parent yet.
          obj.parent = link.from_activity;
        }
        return obj;
      }
      // Otherwise, warn the modeler.
      UI.warningEntityExists(obj);
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
    // Add link between FROM and TO activity with specified connector.
    let l = this.linkByID(UI.linkIdentifier(from_a, to_a, to_c));
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
    if(l.is_feedback) this.cleanUpFeedbackLinks();
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
    // NOTE: Before doing that, check whether `l` was drawn as a deep
    // link, and if so, redraw the deep link.
    let dl;
    if(UI.aspect_ddl_id) {
      dl = UI.paper.drawn_deep_links[UI.aspect_ddl_id];
    } else {
      dl = UI.paper.comprisingDeepLink(l);
      // NOTE: After delete aspect - undo delete, the deep link will not
      // have this aspect anymore, so add it to its aspect list.  
      if(dl) addDistinct(a, dl.aspects);
    }
    this.clearSelection();
    this.selected_aspect = a;
    this.selected_aspect_link = l;
    // NOTES:
    // (1) Redraw of link is needed to highlight because aspects do not
    //     have their own shape.
    // (2) Link may be a deep link that should be drawn as such.
    UI.paper.drawLink(dl || l);
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
    UI.notify(pluralS(n, 'function') + ' moved to function ' + a.displayName);
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
      this.deselectAspect();
      return;
    }
    let obj,
        fc = this.focal_activity;
    // Update the documentation manager if selection contains the
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
        this.deleteActivity(obj);
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
    // Compose for each node its list of predecessor nodes.
    // NOTE: First reset all lists, and unset the `visited` flags of links.
    for(let a in this.activities) if (this.activities.hasOwnProperty(a)) {
      this.activities[a].predecessors.length = 0;
    }
    for(let l in this.links) if(this.links.hasOwnProperty(l)) {
      this.links[l].visited = false;
    }
    // Only then compute the predecessor lists.
    for(let a in this.activities) if (this.activities.hasOwnProperty(a)) {
      this.activities[a].setPredecessors();
    }
  }

  cleanUpFeedbackLinks() {
    // Set feedback property for all links that are part of a loop,
    // and return TRUE when a change has occurred.
    this.makePredecessorLists();
    let redraw = false;
    for(let k in this.links) if(this.links.hasOwnProperty(k)) {
      const
          l = this.links[k],
          fb = l.is_feedback;
      l.is_feedback = (l.from_activity.predecessors.indexOf(l.to_activity) >= 0);
      redraw = redraw || (fb !== l.is_feedback);
    }
    if(redraw) UI.drawDiagram(this);
  }
  
  get triggerSequence() {
    // Return a lookup of lists of activities, where seq[0] holds all
    // entry functions, seq[1] the immediate successors of thes entry
    // functions, etc., and seq['NR'] the functions that can *not* be
    // reached from any entry function.
    const
        aa = this.top_activity.leafActivities,
        al = [],
        seq = [];
    let n = 0;
    for(let i = aa.length - 1; i >= 0; i--) {
      if(aa[i].isEntry) al.push(aa.splice(i, 1)[0]);
    }
    while(al.length) {
      const pl = al.slice();
      seq[n] = pl;
      n++;
      al.length = 0;
      for(let i = aa.length - 1; i >= 0; i--) {
        if(aa[i].hasIncomingFrom(pl)) al.push(aa.splice(i, 1)[0]);
      }
    }
    if(aa.length) {
      seq.unreachable = aa;
    }
    return seq;
  }

  //
  // Methods for loading and saving the model
  //
  
  parseXML(data) {
    // Parse data string into XML tree
//    try {
      // NOTE: Convert %23 back to # (escaped by function saveModel)
      const xml = parseXML(data.replace(/%23/g, '#'));
      if(xml.nodeName === 'FM') {
        this.initFromFMV(xml);
      } else {
        this.initFromXML(xml);
      }
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
    this.run_length = safeStrToInt(nodeParameterValue(node, 'run-length'), 10);
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
              fa = this.activityByCode(fc),
              tc = nodeContentByTag(c, 'to-code'),
              ta = this.activityByCode(tc);
          if(fa && ta) {
            this.addLink(fa, ta, nodeParameterValue(c, 'connector'), c);
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
        '" zoom="', this.last_zoom_factor,
        '" run-length="', this.run_length, '"'].join('');
    if(this.align_to_grid) p += ' align-to-grid="1"';
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
  
  initFromFMV(node) {
    // Initialize model from FRAM Model Visualizer XML with `node` as root.
    this.reset();
    // Ensure that top activity has code "0", as all N FMV functions have
    // ID number 0, ..., N-1 to which 1 will be added.
    this.top_activity.code = '0';
    // Create all activities.
    let max_acode = 1,
        n = childNodeByTag(node, 'Functions');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'Function') {
          const
              name = nodeContentByTag(c, 'IDName'),
              a = this.addActivity(name, UI.NO_ACTOR);
          if(a) {
            a.parent = this.top_activity;
            // NOTE: Add 1 to function ID because top activity has code 0.
            const acode = safeStrToInt(nodeContentByTag(c, 'IDNr')) + 1;
            max_acode = Math.max(max_acode, acode);
            a.code = acode.toString();
            const desc = nodeContentByTag(c, 'Description');
            if(desc !== 'null') a.comments = desc;
            a.x = safeStrToFloat(nodeParameterValue(c, 'x'));
            a.y = safeStrToFloat(nodeParameterValue(c, 'y'));
          }
        }
      }
    }
    this.next_activity_number = max_acode + 1;
    // Establish the sub-activity hierarchy.
    n = childNodeByTag(node, 'Groups');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'Group') {
          const
              code = addOne(nodeContentByTag(c, 'FunctionIDNr')),
              pa = this.activityByCode(code),
              subs = nodeContentByTag(c, 'CHILD').split('|');
          if(pa) {
            // Create a "container" activity having the name of the
            // parent activity suffixed by a black hexagon.
            const ca = this.addActivity(pa.name + '\u2B23', UI.NO_ACTOR);
            ca.x = pa.x;
            ca.y = pa.y;
            pa.setParent(ca);
            for(let j = 0; j < subs.length; j++) {
              const sa = this.activityByCode(addOne(subs[j]));
              if(sa) sa.setParent(ca);
            }
          }
        }
      }
    }
    // Get all aspects from the aspect nodes.
    const
        corpits = {
          Control: {},
          Input: {},
          Output: {},
          Precondition: {},
          Resource: {},
          Time: {}
        },
        tags = Object.keys(corpits);
    for(let j = 0; j < tags.length; j++) {
      const tag = tags[j];
      n = childNodeByTag(node, tag + 's');
      if(n && n.childNodes) {
        for(let i = 0; i < n.childNodes.length; i++) {
          const c = n.childNodes[i];
          if(c.nodeName === tag) {
            const
                name = nodeContentByTag(c, 'IDName'),
                obj = this.objectByName(name),
                // NOTE: FMV files appear not to enforce name uniqueness,
                // so aspects and function can have the same name. When
                // this is detected, aspect names are suffixed by a 6-pointed
                // star symbol.
                mark = (obj && !(obj instanceof Aspect) ? '\u2736' : ''),
                desc = nodeContentByTag(c, 'Description'),
                act = this.activityByCode(
                    addOne(nodeContentByTag(c, 'FunctionIDNr'))),
                asp = this.addAspect(name + mark);
            if(asp) {
              asp.setCode();
              asp.resize();
              if(desc && desc !== 'null') asp.comments = desc;
              corpits[tag][asp.identifier] = act;
            }            
          }
        }
      }
    }
    // Infer links from the CORPIT index by looking for function pairs
    // (F1, F2) where F1 has aspect A as output and F2 has it as some
    // incoming aspect. Do this by iterating only over the outputs (so
    // orphan incoming aspects will be ignored).
    for(let k in corpits.Output) if(corpits.Output.hasOwnProperty(k)) {
      const fa = corpits.Output[k];
      for(let i = 0; i < tags.length; i++) if(tags[i] !== 'Output') {
        const ta = corpits[tags[i]][k];
        if(ta) {
          const
              c = tags[i].charAt(0),
              l = this.addLink(fa, ta, c),
              a = this.aspects[k];
          // Add aspect (if indeed defined) to link (if indeed created).
          if(l && a) addDistinct(a, l.aspects);
        }
      }
    }
    this.focal_activity = this.top_activity;
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
  
  get allExpressions() {
    // Return list of all Expression objects in this model.
    const xl = [];
    // Each aspect has an expression.
    for(let k in this.aspects) if(this.aspects.hasOwnProperty(k)) {
      xl.push(this.aspects[k].expression);
    }
    // Activities may have an expression for their CRPIT connections.
    for(let k in this.activities) if(this.activities.hasOwnProperty(k)) {
      const
          ix = this.activities[k].incoming_expressions,
          ic = Object.keys(ix);
      for(let i = 0; i < ic.length; i++) xl.push(ix[ic[i]]);
    }
    return xl;
  }

  resetExpressions() {
    // Create a new vector for all expressions in the model, setting their
    // initial value (t=0) to "undefined" and for all other cycles ("ticks")
    // to "not computed".
    const ax = this.allExpressions;
    for(let i = 0; i < ax.length; i++) {
      ax[i].reset(VM.UNDEFINED);
    }
    //
    for(let k in this.activities) if(this.activities.hasOwnProperty(k)) {
      const
          a = this.activities[k],
          s = a.state;
      for(let c in s) if(s.hasOwnProperty(c)) {
        this.cleanVector(s[c], VM.UNDEFINED);
      }
      a.active_since = -1;
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
    this.color = '#ffffff';
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
  
  get leafCount() {
    // Return the number of leaf activities "owned" by this actor.
    const la = MODEL.top_activity.leafActivities;
    let n = 0;
    for(let i = 0; i < la.length; i++) {
      if(la[i].actor === this) n++;
    }
    return n;
  }
  
  get asXML() {
    return ['<actor color="', this.color.substring(1, 7), 
        '"><name>', xmlEncoded(this.name),
        '</name><comments>', xmlEncoded(this.comments),
        '</comments></actor>'].join('');
  }
  
  initFromXML(node) {
    this.color = '#' + (nodeParameterValue(node, 'color') || 'ffffff');
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
    return this;
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
  
  get identifier() {
    let id = this.name;
    if(this.hasActor) id += ` (${this.actor.name})`;
    return UI.nameToID(id);
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
    // Check whether the actor name does not refer to a non-actor entity.
    const ane = MODEL.namedObjectByID(UI.nameToID(actor_name));
    if(ane && !(ane instanceof Actor)) {
      UI.warningEntityExists(ane);
      return false;      
    }
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
        ratio = (this instanceof Activity ? 0.5 : 0.25);
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

  get infoLineName() {
    let extra = '';
    if(this.parent) {
       extra = '<span class="extra">(scope: '+ this.parent.displayName +
            ')</span>';
    }
    const x = this.expression;
    if(x.defined) {
      if(MODEL.solved) {
        const
           r = x.result(MODEL.t),
           rs = VM.sig4Dig(r),
           rp = r === VM.PENDING,
           xrt = (rp ? x.after_points[MODEL.t] : x.until_points[MODEL.t]),
           sym = (rp ? '' : ' \u25D4'),
           xrs = (!xrt && xrt !== 0 ? '' :
              `<span style="color: #f07000">${sym}${UI.clockTime(xrt)}</span>`);
        extra += ` = <span style="color: blue">${rs}${xrs}</span>`;
      }
      extra += `<code style="color: gray"> &#x225C; ${x.text}</code>`;
    }
    return `<em>System aspect:</em> ${this.displayName}${extra}`;
  }
  
  value(t) {
    // Return the computed value of this aspect.
    const x = this.expression;
    if(x.defined && (x.isStatic || MODEL.solved)) {
      return this.expression.result(t);
    }
    return VM.UNDEFINED;
  }

  setCode() {
    // Aspects are assigned a unique number code for shorthand display of links.
    if(!this.code) {
      this.code = (MODEL ? MODEL.newAspectCode : '?');
    }
  }

  get asXML() {
    return ['<aspect code="', this.code, '">',
        '<name>', xmlEncoded(this.name),
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
  
  get isTimeAspect() {
    // Return TRUE if this aspect occurs only on links that relate to Time.
    const ol = this.parent.connections.O;
    for(let i = 0; i < ol.length; i++) {
      if(ol[i].to_connector !== 'T' && ol[i].aspects.indexOf(this) >= 0) {
        return false;
      }
    }
    return true;
  }
  
  isLasting(t) {
    // Return TRUE if this aspect has a "lasting" value due to some
    // UNTIL operator.
    const
        x = this.expression,
        up = x.defined && x.until_points[t];
    // NOTE: A setpoint of 0 is meaningful, so do not return FALSE then. 
    return up || up === 0;
  }
  
  removeFromLink(l) {
    // Remove this aspect from its parent link, and also from the model
    // if this link is the only one having this aspect.
    // @@TO DO: Add undo data!
    if(!l) return;
    const n = l.aspects.indexOf(this);
    let xml = '';
    // Remove aspect from list.
    if(n >= 0) {
      l.aspects.splice(n, 1);
      xml = `<link-aspect code="${this.code}" link="${l.identifier}"></link-aspect>`;
    }
    // NOTE: Aspect can only occur within its parent activity scope.
    const ais = this.parent.aspectsInScope;
    if(ais.indexOf(this) < 0) {
      // No more occurrence => remove aspect from model.
      const msg = `Aspect "${this.displayName}" removed from model`;
      xml = this.asXML + xml;
      delete MODEL.aspects[this.identifier];
      UI.notify(msg);
    }
    // Also remove aspect from comprising deep link (if any).
    const cdl = UI.paper.comprisingDeepLink(l);
    if(cdl) {
      const ndl = l.aspects.indexOf(this);
      if(ndl) cdl.aspects.splice(n, 1);
    }
    UNDO_STACK.addXML(xml);
    UI.paper.drawLink(cdl || l);
    UI.updateButtons();
  }
  
} // END of CLASS Aspect


// CLASS Activity
class Activity extends NodeBox {
  constructor(parent, name, actor) {
    super(parent, name, actor);
    this.sub_activities = [];
    // Connections hold related links per aspect type.
    this.connections = {};
    // Connections hold optional expressions per CRPIT aspect type.
    this.incoming_expressions = {};
    this.notes = [];
    this.predecessors = [];
    // The state of an activity comprises one vector per aspect type.
    this.state = {};
    for(let i = 0; i < 6; i++) {
      const c = 'CORPIT'.charAt(i);
      this.connections[c] = [];
      this.state[c] = [];
      if(c !== 'O') {
        this.incoming_expressions[c] = new Expression(this, '');
      }
    }
    // To visualize the time since last activation, the green rim color
    // of activities turns gradually more black.
    this.active_since = -1;
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
  
  get infoLineName() {
    let extra = '';
    if(this.sub_activities.length) {
       extra = `<span class="extra">(${pluralS(this.leafActivities.length,
            'function')})</span>`;
    }
    return `<em>Function:</em> ${this.displayName}${extra}`;
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
    // link and at least one output link.
    if(this.sub_activities.length) return false;
    const l = this.countLinksInOut;
    return !l.incoming || !l.outgoing;
  }
  
  get isEntry() {
    // Return TRUE when this activity is an entry function.
    if(this.sub_activities.length) return false;
    const l = this.countLinksInOut;
    return !l.incoming && l.outgoing;
  }
  
  get isExit() {
    // Return TRUE when this activity is an entry function.
    if(this.sub_activities.length) return false;
    const l = this.countLinksInOut;
    return l.incoming && !l.outgoing;
  }
  
  hasIncomingFrom(acts) {
    // Return TRUE when this activity has an incoming link from any of
    // the activities in list `acts`.
    for(let i = 0; i < acts.length; i++) {
      const aoc = acts[i].connections.O;
      for(let j = 0; j < aoc.length; j++) {
        if(aoc[j].to_activity === this) return true;
      }
    }
    return false;
  }
  
  setPredecessors() {
    // Recursive function to create list of all activities that precede
    // this one.
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
        '</y-coord><incoming-expressions>'];
    for(let c in this.connections) if('CRPIT'.indexOf(c) >= 0) {
      xml.push('<incoming-x connection="', c, '">',
          xmlEncoded(this.incoming_expressions[c].text),
          '</incoming-x>');
    }
    xml.push('</incoming-expressions><sub-activities>');
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
    let n = childNodeByTag(node, 'incoming-expressions');
    if(n && n.childNodes) {
      for(let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if(c.nodeName === 'incoming-x') {
          const
              con = nodeParameterValue(c, 'connection'),
              txt = xmlDecoded(nodeContent(c));
          this.incoming_expressions[con].text = txt;
        }
      }
    }
    n = childNodeByTag(node, 'sub-activities');
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
  
  incomingAspects(connector) {
    // Return list of all aspects for this activity that are incoming
    // via `connector`.
    const
        ia = [],
        cc = this.connections[connector];
    for(let i = 0; i < cc.length; i++) {
      const la = cc[i].aspects;
      for(let j = 0; j < la.length; j++) {
        addDistinct(la[j], ia);
      }
    }
    return ia;
  }
  
  aspectOfIncomingExpression(x) {
    // Return the aspect letter if `x` is an incoming expression of this
    // activity, or otherwise an empty string.
    for(let k in this.incoming_expressions) {
      if(this.incoming_expressions.hasOwnProperty(k) &&
          this.incoming_expressions[k] === x) {
        return k;
      }
    }
    return '';
  }
  
  stateChanged(t) {
    // Return TRUE if any of the aspects has changed compared to tick t-1.
    let change = false;
    for(let i = 0; i < 6; i++) {
      const
          // NOTE: Start with aspect O for efficiency.
          k = 'ORPITC'.charAt(i), 
          ps = (t <= 0 ? null : this.state[k][t - 1]),
          cs = this.state[k][t];
      if(cs !== ps) {
        change = true;
        // Set or clear "active since" tick. 
        if(k === 'O') {
          if(cs && cs <= VM.EXCEPTION) {
            this.active_since = t;
          } else {
            this.active_since = -1;
          }
        }
        break;
      }
    }
    return change;
  }

  stateChanges(t) {
    // Return changes in aspectscompared to tick t-1 as a string.
    let changes = [];
    for(let i = 0; i < 6; i++) {
      const
          // NOTE: Input first, Output last.
          k = 'IPTCRO'.charAt(i), 
          ps = (t <= 0 ? null : this.state[k][t - 1]),
          cs = this.state[k][t];
      if(cs !== ps) changes.push(
          `${UI.aspect_type[k]} ${VM.sig4Dig(ps)} \u2192 ${VM.sig4Dig(cs)}`);
    }
    return changes.join(', ');
  }

  activated(t) {
    // Return TRUE iff O aspect is TRUE for tick t but not for tick t-1.
    return (MODEL.solved && this.state.O[t] === 1 &&
        (t === 0 || this.state.O[t - 1] !== 1));
  }
  
  isActive(t) {
    return (MODEL.solved && this.state.O[t] === 1);
  }
  
  activeColor(t) {
    if(this.activated(t)) return UI.color.activated;
    if(this.active_since < 0) return UI.color.rim;
    const green = Math.min(176,
        Math.max(64, 160 - 8 * (t - this.active_since)));
    return `rgb(32, ${green}, 48)`;
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
  
  get deepVisibleLinks() {
    // Return a list with data on all links within this activity that
    // connect a leaf of a non-leaf sub-activity A to a leaf of another
    // non-leaf subactivity B, but are not visible as "normal" links.
    // The data is stored as instances of class Link having the visible
    // activities as FROM and TO plus a list of constituing links. When
    // drawn, this list signals "this is a deep link" when it is non-empty.
    const
        la = this.leafActivities,
        nla = {},
        dvl = {};
    // Create lookup with per non-leaf the list of its leaves. 
    for(let i = 0; i < this.sub_activities.length; i++) {
      const sa = this.sub_activities[i];
      if(!sa.isLeaf) {
        nla[sa.identifier] = sa.leafActivities;
      }
    }
    // Peruse all links in the model.
    for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
      const
          l = MODEL.links[k],
          fa = l.from_activity,
          ta = l.to_activity;
      let vfa = null,
          vta = null,
          deep = false;
      if(la.indexOf(fa) >= 0 && la.indexOf(ta) >= 0) {
        // Link `l` connects two leaf activities in this activity.
        // Now determine the visible nodes for this link.
        if(this.sub_activities.indexOf(fa) >= 0) {
          // FROM node is a leaf of this activity.
          vfa = fa;
        } else {
          // Find non-leaf that contains the FROM node.
          for(let k in nla) if(nla.hasOwnProperty(k)) {
            if(nla[k].indexOf(fa) >= 0) {
              vfa = MODEL.activities[k];
              break;
            }
          }
          // If not an immediate sub-activity, it is a "deep" link.
          if(vfa) deep = true;
        }
        // Do likewise for the TO node.
        if(this.sub_activities.indexOf(ta) >= 0) {
          // FROM node is a leaf of this activity.
          vta = ta;
        } else {
          // Find non-leaf that contains the FROM node.
          for(let k in nla) if(nla.hasOwnProperty(k)) {
            if(nla[k].indexOf(ta) >= 0) {
              vta = MODEL.activities[k];
              break;
            }
          }
          // Not an immediate sub-activity, so it is a "deep" link.
          if(vta) deep = true;
        }
        if(deep) {
          if(!vfa || !vta) {
            // This anomaly should not occur => throw exception.
            throw 'ERROR: link node(s) not found for ' + l.displayName;
          }
          if(vfa !== vta) {
            // Two *different* nodes found, and at least one is "deep".
            const dlid = UI.linkIdentifier(vfa, vta, l.to_connector);
            let dl = dvl[dlid];
            if(!dl) {
              // Create a new virtual link and add link to its set.
              dl = new Link(vfa, vta, l.to_connector);
              dvl[dlid] = dl;
            }
            dl.deep_links.push(l);
            // Add all aspects of `l` to those of `dl`.
            for(let j = 0; j < l.aspects.length; j++) {
              addDistinct(l.aspects[j], dl.aspects);
            }
          }
        }
      }
    }
    return dvl;
  }

  containsLink(l) {
    // Returns TRUE iff link `l` is related to some activty in this activity.
    return this.relatedLinks.indexOf(l) >= 0;
  }
  
  get contextualLinks() {
    // Return a lookup object with for each connector the list of links
    // that connect to this connector but are not visible in the focal
    // activity diagram.
    const
        ala = MODEL.top_activity.leafActivities,
        pla = this.parent.leafActivities,
        ca = complement(ala, pla),
        la = this.leafActivities,
        cl = {C: [], O: [], R: [], P: [], I: [], T: []};
    // NOTE: This activity may itself be a leaf. 
    la.push(this);
    for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
      const l = MODEL.links[k];
      // Only consider contextual links.
      if(ca.indexOf(l.from_activity) >= 0 || ca.indexOf(l.to_activity) >= 0) {
        if(la.indexOf(l.to_activity) >= 0) {
          cl[l.to_connector].push(l);
        } else if(la.indexOf(l.from_activity) >= 0) {
          cl.O.push(l);
        }
      }
    }
    // Store the result so that it can be reused when appropriate.
    // NOTE: Use with care! It will be updated only when this activity
    // is redrawn.
    this.contextual_links = cl;
    return cl;
  }
  
  linkInList(l, list) {
    // Return TRUE iff both the FROM node and the TO node of link `l`
    // are elements of `list`.
    // NOTE: This method used in diafram-controller.js to see which links
    // are to be included when the modeler performs a "rectangular area
    // selection".
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
    if(this.isLeaf) {
      for(let k in MODEL.links) if(MODEL.links.hasOwnProperty(k)) {
        const l = MODEL.links[k];
        if(l.from_activity === this || l.to_activity === this) UI.drawObject(l);
      }
    } else {
      const dvl = this.deepVisibleLinks;
      for(let k in dvl) if(dvl.hasOwnProperty(k)) {
        this.drawLink(dvl[k]);
      }
    }
  }
  
  copyPropertiesFrom(a) {
    // Set properties to be identical to those of activity `a`.
    this.x = a.x;
    this.y = a.y;
    this.comments = a.comments;
  }

  deleteNote(n) {
    // Remove note `n` from this activity's note list.
    let i = this.notes.indexOf(n);
    if(i >= 0) {
      UNDO_STACK.addXML(n.asXML);
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
  
  updateState(t) {
    // Determine whether this activity is "active" in the current cycle
    // ("tick" t).
    const
        entry = this.isEntry,
        s = this.state,
        ix = this.incoming_expressions;
    // First calculate the expressions (if any) associated with the CRPIT
    // of this activity. When such expressions are defined, the default
    // rules are not applied *unless* they result in an exceptional value.
    for(let k in ix) if(ix.hasOwnProperty(k)) {
      s[k][t] = ix[k].result(t);
    }
    // Review all CRPIT, and apply the default rules if their state still
    // is "not computed" or "undefined".
    for(let k in s) if('CRPIT'.indexOf(k) >= 0) {
      if(s[k][t] >= VM.EXCEPTION) {
        // No incoming expression result => set aspect to 0 and then check
        // incoming link aspects (only when t > 0).
        // NOTE: Entry functions by default satisfy all aspects.
        s[k][t] = (entry ? 1 : 0);
        if(t > 0) {
          // When multiple links are incoming for this function aspect, they must
          // *all* "satisfy" by having at least one TRUE associated aspect value.
          const n = this.connections[k].length;
          let allset = true;
          for(let i = 0; i < n; i++) {
            const
                l = this.connections[k][i],
                fa = l.from_activity;
            // When the FROM activity is active, calculate all aspects on
            // this link, and assume that one non-zero result (TRUE) suffices
            // to "satisfy" this incoming link.
            if(fa.state.O[t - 1] === 1) {
              let cset = 0;
              for(let j = 0; j < l.aspects.length; j++) {
                // NOTE: Aspects are calculated for "tick" t, not t-1.
                const
                    x = l.aspects[j].expression,
                    // Aspects without associated expression are TRUE.
                    r = (x.defined ? x.result(t) : 1);
                // Aspects with expressions must evaluate to TRUE; when
                // PENDING, this is interpreted as FALSE until the setpoint
                // has been reached.
                cset += (r > VM.ERROR && r < VM.EXCEPTION ? r : 0);
              }
              allset = allset && cset > 0;
            } else {
              // FROM activity not active => this incoming link not satisfied.
              allset = false;
            }
          }
          // The state for CRPT is TRUE if all links are "satisfied" even
          // when there are no incoming links. For I, there *must* be at
          // least one incoming link or this must be an "entry" activity.
          if(allset && (k !== 'I' || n > 0 || this.isEntry)) s[k][t] = 1;
        }
      }
    }
    // This activity is considered "active" when all CRPITs are satisfied.
    if(s.C[t] && s.R[t] && s.P[t] && s.I[t] && s.T[t]) {
      s.O[t] = 1;
    } else {
      s.O[t] = 0;
    }
    return this.stateChanged(t);
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
    // Deep links are inferred when drawing the links of a diagram.
    // When not empty, this indicates that this link is a "virtual
    // container" for multiple "real" links.
    this.deep_links = [];
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
    // NOTE: link IDs are based on the activity codes rather than IDs,
    // as this prevents problems when activities are renamed.
    return UI.linkIdentifier(this.from_activity, this.to_activity,
        this.to_connector);
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
  
  get containsSelected() {
    // Returns TRUE if this is a "deep link" comprising only a selected
    // link.
    return (this.deep_links.length === 1 && this.deep_links[0].selected);
  }
  
  isActivated(t) {
    return this.from_activity.activated(t - 1);
  }

  containsActivated(t) {
    // Returns TRUE if this is a "deep link" comprising one or more
    // activated links.
    if(!this.deep_links.length) return this.isActivated(t);
    let ca = false;
    for(let i = 0; i < this.deep_links.length; i++) {
      if(this.deep_links[i].isActivated(t)) ca = true;
    }
    return ca;
  }

  activeColor(t) {
    // Returns a shade of green if this is a "deep link" comprising one
    // or more active links, or the default rim color.
    let as = -1;
    if(this.deep_links.length) {
      for(let i = 0; i < this.deep_links.length; i++) {
        as = Math.max(as, this.deep_links[i].from_activity.active_since);
      }
    } else {
      as = this.from_activity.active_since;
    }
    if(as >= 0 && as < t) {
      const green = Math.min(176, Math.max(64, 160 - 8 * (t - as)));
      return `rgb(32, ${green}, 48)`;
    }
    return UI.color.rim;
  }
  
  get containsFeedback() {
    // Returns TRUE if this is a "deep link" comprising a feedback link.
    for(let i = 0; i < this.deep_links.length; i++) {
      if(this.deep_links[i].is_feedback) return true;
    }
    return false;
  }

  containsPoint(x, y) {
    // Returns TRUE if the point (x, y) lies within the 12x12 thumbnail
    // chart area of this constraint (either in the middle of the curved
    // arrow or at the top of its one visible node)
    return this.midpoint && Math.abs(x - this.midpoint[0]) <= 6 &&
        Math.abs(y - this.midpoint[1]) <= 6;
  }
  
} // END of class Link

