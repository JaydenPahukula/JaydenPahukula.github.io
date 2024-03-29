import { global } from "./globals.js";
import * as vec from "./Vector.js";
import * as rand from "./random.js";


// ================= FISH PARAMETERS =================
// body
const MAX_SIZE = 1.9;
const MIN_SIZE = 0.7;
const BODY_WIDTH = 24;
const SEGMENT_LENGTH = 5;
const COLORS = ["#E6E6E6","#E6E6E6","#EB4A2A","#EB4A2A","#F49D2C","#313130"];
const NUM_SEGMENTS = 20;
const BODY_PROFILE = [0.00, 0.65, 0.85, 0.96, 1.00, 1.00, 0.98, 0.96, 0.93, 0.87,
                      0.80, 0.70, 0.59, 0.50, 0.41, 0.32, 0.21, 0.12, 0.05, 0.00];
// design
const MIN_NUM_SPOTS = 2;
const MAX_NUM_SPOTS = 5;
const MIN_SPOT_HEIGHT = 3;
const MAX_SPOT_HEIGHT = 6;
const MIN_SPOT_DEPTH = 0.2;
const MAX_SPOT_DEPTH = 2.9;
// shadow
const SHADOW_OPACITY = 30; //0-255
const SHADOW_OFFSET_X = 6;
const SHADOW_OFFSET_Y = 6;
// movement
const MAX_VEL = 4;
const MIN_VEL = 1;
const THRUST_STRENGTH = 3.5;
const RESISTANCE_VAL = 0.956;
const TURN_SPEED = 0.1;
const MAX_TURN_ANGLE = Math.PI/3;//rads
// behavior
const OSCILLATION_PERIOD = 15;
const OSCILLATION_AMPLITUDE = 0.04;
const RANDOM_TURN_PROB = 0.007;
const SIGHT_RANGE = 200;
const SEPERATION_COEF = 0.7;
const ALIGNMENT_COEF = 1.8;
const COHESION_COEF = 1;
const BEHAVIOR_STRENGTH = 0.000015;
// ===================================================


export class Fish {

  constructor(){
    // start at random spot
    let posx = rand.int(-global.CANVAS_MARGIN, global.canvas_width+global.CANVAS_MARGIN);
    let posy = rand.int(-global.CANVAS_MARGIN, global.canvas_height+global.CANVAS_MARGIN);
    this.pos = new vec.Vector(posx,posy);
    this.outOfBounds = this.#checkOutOfBounds();
    
    // start swimming at random angle
    this.angle = 0;
    let startAngle = rand.float(0, 2*Math.PI);
    this.vel = new vec.Vector(MAX_VEL*Math.cos(startAngle),MAX_VEL*Math.sin(startAngle));
    
    // this.size is used for scaling all other attributes
    this.size = rand.float(MIN_SIZE, MAX_SIZE)
    
    // body
    this.segment_length = this.size * SEGMENT_LENGTH;
    this.body_width = this.size * BODY_WIDTH;
    this.body = []
    for (let i = 0; i < NUM_SEGMENTS; i++){
      this.body.push(this.pos.copy());
    }
    // these store the points along the side of the body
    this.body_left = [];
    this.body_right = [];
    
    // colors
    let color1 = rand.int(0, COLORS.length);
    let color2 = rand.int(0, COLORS.length);
    while (color1 == color2){
      color2 = rand.int(0, COLORS.length);
    }
    this.primary_color = COLORS[color1];
    this.secondary_color = COLORS[color2];

    // behavior
    this.thrust_strength = THRUST_STRENGTH * Math.sqrt(this.size);
    this.oscillation_period = OSCILLATION_PERIOD * this.size;
    this.oscillation_amplitude = OSCILLATION_AMPLITUDE / this.size;
    this.oscillation_offset = rand.float(0, 2*Math.PI*this.oscillation_period);
    this.random_turn_prob = RANDOM_TURN_PROB / this.size;
    this.behavior_strength = BEHAVIOR_STRENGTH / this.size;
    
    // add spots
    this.spots = [];
    let num_spots = rand.int(MIN_NUM_SPOTS, MAX_NUM_SPOTS+1);
    for (let i = 0; i < num_spots; i++){
      this.spots.push({
        // which segment the center of the spot is
        loc: rand.int(1, NUM_SEGMENTS-1),
        // how many segments the spot spans up and down the fish
        height: rand.int(MIN_SPOT_HEIGHT, MAX_SPOT_HEIGHT+1),
        // how far the spot etends onto the body (1 = to the center, 2 = whole fish)
        depth: rand.float(MIN_SPOT_DEPTH, MAX_SPOT_DEPTH),
         // which side the spot is on
        side: rand.bool()
      });
    }
    
    // take 100 steps to make sure fish is not crumpled up when spawned
    for (let i = 0; i < 100; i++){
      this.move([]);
    }
  }
  
  
  // move the fish
  move(arr){

    // update acceleration
    let behavior = this.#getBehavior(arr);
    let behavior_angle = vec.boundAngle(behavior.direction());
    this.angle += (behavior_angle - this.angle) * this.behavior_strength * behavior.magnitude();
    // apply oscillations
    let oscillation = Math.sin(global.t / this.oscillation_period + this.oscillation_offset) * this.oscillation_amplitude;
    this.angle += oscillation;
    // apply random turn
    if (rand.int(0, Math.floor(1/this.random_turn_prob)) == 0){
      let randomTurn = rand.float(-MAX_TURN_ANGLE, MAX_TURN_ANGLE);
      this.angle += randomTurn;
    }
    // clamp turn angle
    let angleBetween = vec.boundAngle(this.angle - this.vel.direction());
    if (angleBetween < Math.PI && angleBetween > MAX_TURN_ANGLE){
      this.angle = this.vel.direction() + MAX_TURN_ANGLE;
    } else if (angleBetween > Math.PI && angleBetween < 2*Math.PI-MAX_TURN_ANGLE){
      this.angle = this.vel.direction() - MAX_TURN_ANGLE;
    }
    
    // update velocity
    let turn = (this.angle - this.vel.direction()) * TURN_SPEED;
    this.vel = vec.rotated(this.vel, (this.angle-this.vel.direction())*TURN_SPEED);
    // turns produce thrust
    let thrust = (1 - Math.pow(2, -Math.abs(turn))) * this.thrust_strength;
    this.vel = vec.scale(this.vel, 1+thrust);
    // resistance
    this.vel = vec.scale(this.vel, RESISTANCE_VAL);
    // bound velocity
    if (this.vel.magnitude() > MAX_VEL){
      this.vel = vec.scale(this.vel, MAX_VEL/this.vel.magnitude());
    } else if (this.vel.magnitude() < MIN_VEL){
      this.vel = vec.scale(this.vel, MIN_VEL/this.vel.magnitude());
    }
    
    // update position
    this.pos = vec.add(this.pos, this.vel);
    // wrap around canvas
    if (this.pos.x < -global.CANVAS_MARGIN) this.pos.x = global.canvas_width+global.CANVAS_MARGIN;
    if (this.pos.x > global.canvas_width+global.CANVAS_MARGIN) this.pos.x = -global.CANVAS_MARGIN;
    if (this.pos.y < -global.CANVAS_MARGIN) this.pos.y = global.canvas_height+global.CANVAS_MARGIN;
    if (this.pos.y > global.canvas_height+global.CANVAS_MARGIN) this.pos.y = -global.CANVAS_MARGIN;
    
    // move the rest of the body
    this.body[0] = this.pos;
    for (let i = 1; i < NUM_SEGMENTS; i++){
      // pull next body segment along (clamp distance to be <= this.segment_length)
      let diff = vec.subtract(this.body[i], this.body[i-1]);
      if (diff.magnitude() >= this.segment_length){
        diff = vec.scale(diff, this.segment_length/diff.magnitude());
        this.body[i] = vec.add(this.body[i-1], diff);
      }
    }
    
    // update body points
    this.body_left[0] = this.body[0];
    this.body_right[0] = this.body[0];
    for (let i = 1; i < NUM_SEGMENTS; i++){
      let vector = vec.orth(vec.subtract(this.body[i-1], this.body[i])); // get orthogonal vector
      vector = vec.scale(vec.norm(vector), BODY_PROFILE[i]*this.body_width/2); // normalize and scale
      this.body_left[i] = vec.add(this.body[i], vector);
      this.body_right[i] = vec.subtract(this.body[i], vector);
    }

    // update out of bounds
    this.outOfBounds = this.#checkOutOfBounds();
  }
  
  
  // draw the fish
  draw(sketch){
    // do not draw if out of bounds
    if (this.outOfBounds) return;

    // draw body
    sketch.noStroke();
    sketch.fill(this.primary_color);
    sketch.beginShape();
    // left side of body
    for (let i = 0; i < NUM_SEGMENTS; i++){
      sketch.vertex(this.body_left[i].x, this.body_left[i].y);
    }
    // right side of body
    for (let i = NUM_SEGMENTS-1; i > 0; i--){
      sketch.vertex(this.body_right[i].x, this.body_right[i].y);
    }
    sketch.endShape();
    
    // draw spots (unless primary and secondary colors are the same)
    if (this.primary_color != this.secondary_color){
      sketch.fill(this.secondary_color);
      for (let i = 0; i < this.spots.length; i++){
        let spot = this.spots[i];
        sketch.beginShape();
        // add vertexes along the side of the body
        for (let j = Math.max(1, spot.loc-spot.height); j < Math.min(NUM_SEGMENTS, spot.loc+spot.height+1); j++){
          if (spot.side){
            sketch.vertex(this.body_left[j].x, this.body_left[j].y);
          } else {
            sketch.vertex(this.body_right[j].x, this.body_right[j].y);
          }
        }
        // add shape vertexes on the body
        for (let j = Math.min(NUM_SEGMENTS-1, spot.loc+spot.height); j > Math.max(1, spot.loc-spot.height); j--){
          let spotDepth = spot.depth*(Math.pow((j-spot.loc)/spot.height,2)-1)+1;
          let actualDepth = Math.max(BODY_PROFILE[j]*spotDepth, -BODY_PROFILE[j])
          let vector = vec.orth(vec.subtract(this.body[j-1], this.body[j])); // get vec.orthogonal vector
          vector = vec.scale(vec.norm(vector), (spot.side?1:-1)*actualDepth*this.body_width/2); // normalize and scale
          let shapePoint = vec.add(this.body[j], vector);
          sketch.vertex(shapePoint.x, shapePoint.y);
        }
        sketch.endShape();
      }
    }
    // for testing
    // sketch.strokeWeight(2);
    // sketch.stroke("#FFFFFF");
    // let len = SIGHT_RANGE;
    // sketch.line(this.pos.x, this.pos.y, this.pos.x+len*Math.cos(this.angle), this.pos.y+len*Math.sin(this.angle));
  }
  
  
  // draw the fish's shadow
  drawShadow(sketch){
    // do not draw if out of bounds
    if (this.outOfBounds) return;

    sketch.noStroke();
    sketch.fill(0,0,0,SHADOW_OPACITY);
    sketch.translate(SHADOW_OFFSET_X, SHADOW_OFFSET_Y);
    sketch.beginShape();
    // left side
    for (let i = 0; i < NUM_SEGMENTS-1; i++){
      sketch.vertex(this.body_left[i].x, this.body_left[i].y);
    }
    // right side
    for (let i = NUM_SEGMENTS-1; i > 0; i--){
      sketch.vertex(this.body_right[i].x, this.body_right[i].y);
    }
    sketch.endShape();
    sketch.translate(-SHADOW_OFFSET_X, -SHADOW_OFFSET_Y);
  }

  // check if fish is in bounds (can be seen)
  #checkOutOfBounds(){
    const dy = global.scroll_y;
    return this.pos.y < -global.CANVAS_MARGIN + dy ||
      this.pos.y > global.screen_height + global.CANVAS_MARGIN + dy;
  }
  
  // calculate fish's behavior (boids)
  #getBehavior(fishArr){
    let count = 0;
    let seperation = new vec.Vector(0,0);
    let alignment = new vec.Vector(0,0);
    let cohesion = new vec.Vector(0,0);

    for (let i = 0; i < fishArr.length; i++){
      // do not compare against self
      let other = fishArr[i];
      if (other == this) continue;
      // do not compare against fish out of bounds
      if (other.outOfBounds) continue;
      // check if in sight range
      let diff = vec.subtract(this.pos, other.pos);
      if (diff.magnitude() > SIGHT_RANGE) continue;
      
      // add to calculations
      seperation = vec.add(seperation, vec.scale(diff, -1/diff.magnitude()));
      alignment = vec.add(alignment, other.vel);
      cohesion = vec.add(cohesion, other.pos);
      count += 1;
    }

    // average and weight
    if (count > 0){
      seperation = vec.scale(seperation, SEPERATION_COEF/count);
      alignment = vec.scale(alignment, ALIGNMENT_COEF/count);
      cohesion = vec.scale(cohesion, COHESION_COEF/count);
    }
    // add together
    let behavior = vec.add(seperation, alignment, cohesion);

    return behavior;
  }
  
}
